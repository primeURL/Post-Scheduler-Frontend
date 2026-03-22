import { $accessToken } from "../stores/auth";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_GET_CACHE_TTL_MS = 20_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const getResponseCache = new Map<string, CacheEntry>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

function buildCacheKey(path: string, token: string | null): string {
  return `${token ?? "anon"}::${path}`;
}

function clearApiCache(): void {
  getResponseCache.clear();
  inFlightGetRequests.clear();
}

function getAccessToken(): string | null {
  const inMemory = $accessToken.get();
  if (inMemory) return inMemory;
  if (typeof document === "undefined") return null;
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("access_token="))
      ?.split("=")[1] ?? null
  );
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? null
  );
}

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const token = getAccessToken();
  const csrf = getCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    ...(init.headers as Record<string, string>),
  };

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });

  if (resp.status === 401 && allowRetry) {
    try {
      const refreshResp = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      if (refreshResp.ok) {
        const data = (await refreshResp.json()) as { access_token?: string };
        if (data.access_token) {
          $accessToken.set(data.access_token);
          return request<T>(path, init, false);
        }
      }
    } catch {
      // ignore
    }
    return Promise.reject(new Error("Unauthenticated"));
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error((err as { detail?: string }).detail ?? "Request failed");
  }

  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const api = {
  get: async <T>(path: string, options?: { force?: boolean; cacheTtlMs?: number }) => {
    const force = options?.force ?? false;
    const ttlMs = options?.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
    const token = getAccessToken();
    const cacheKey = buildCacheKey(path, token);
    const now = Date.now();

    if (!force) {
      const cached = getResponseCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value as T;
      }
      const inFlight = inFlightGetRequests.get(cacheKey);
      if (inFlight) {
        return (await inFlight) as T;
      }
    }

    const fetchPromise = request<T>(path)
      .then((data) => {
        if (ttlMs > 0) {
          getResponseCache.set(cacheKey, {
            value: data,
            expiresAt: Date.now() + ttlMs,
          });
        }
        return data;
      })
      .finally(() => {
        inFlightGetRequests.delete(cacheKey);
      });

    inFlightGetRequests.set(cacheKey, fetchPromise as Promise<unknown>);
    return fetchPromise;
  },
  post: async <T>(path: string, body: unknown) => {
    const result = await request<T>(path, { method: "POST", body: JSON.stringify(body) });
    clearApiCache();
    return result;
  },
  patch: async <T>(path: string, body: unknown) => {
    const result = await request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
    clearApiCache();
    return result;
  },
  delete: async (path: string) => {
    const result = await request<void>(path, { method: "DELETE" });
    clearApiCache();
    return result;
  },
};
