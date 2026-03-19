import { useEffect } from "react";
import { setAuth, clearAuth, $accessToken } from "../stores/auth";
import { api } from "../lib/api";
import type { User } from "../lib/types";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

function getCsrfToken(): string | null {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? null
  );
}

async function tryRefresh(): Promise<string | null> {
  const csrf = getCsrfToken();
  if (!csrf) return null;
  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrf },
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Restores auth state on every page load.
 *  Checks the in-memory nanostore, then falls back to /auth/refresh (via
 *  the httpOnly refresh_token cookie). Redirects to /login if unauthenticated.
 */
export default function AuthInit() {
  useEffect(() => {
    (async () => {
      let token = $accessToken.get();

      if (!token) {
        token = await tryRefresh();
        if (!token) {
          clearAuth();
          window.location.href = "/login";
          return;
        }
        $accessToken.set(token);
      }

      try {
        const user = await api.get<User>("/auth/me");
        setAuth(token, user);
      } catch {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          clearAuth();
          window.location.href = "/login";
          return;
        }
        $accessToken.set(refreshed);
        try {
          const user = await api.get<User>("/auth/me");
          setAuth(refreshed, user);
        } catch {
          clearAuth();
          window.location.href = "/login";
        }
      }
    })();
  }, []);

  return null;
}
