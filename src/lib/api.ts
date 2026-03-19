import { $accessToken } from "../stores/auth";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

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
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: (path: string) =>
    request<void>(path, { method: "DELETE" }),
};
