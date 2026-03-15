import { $accessToken } from "../stores/auth";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? null
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = $accessToken.get();
  const csrf = getCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    ...(init.headers as Record<string, string>),
  };

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (resp.status === 401) {
    // Token expired — try silent refresh, then give up
    // TODO: uncomment the redirect once Google OAuth is configured
    try {
      await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
    } catch {
      // ignore
    }
    // window.location.href = "/login";
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
