import { useEffect } from "react";
import { setAuth, clearAuth } from "../stores/auth";
import { api } from "../lib/api";
import type { User } from "../lib/types";

/** Reads the access_token cookie set by the backend OAuth callback,
 *  stores it in the auth nanostore, and fetches the current user.
 *  Redirects to /login if auth is missing or invalid.
 *
 *  TODO: re-enable the auth check when Google OAuth is configured.
 */
export default function AuthInit() {
  useEffect(() => {
    const tokenCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("access_token="));

    const token = tokenCookie?.split("=")[1];

    // Bypass auth guard — remove this block when Google OAuth is set up
    if (!token) return;

    import("../stores/auth").then(({ $accessToken }) => {
      $accessToken.set(token);
    });

    api
      .get<User>("/auth/me")
      .then((user) => setAuth(token, user))
      .catch(() => {
        clearAuth();
        // TODO: redirect to /login once auth is configured
        // window.location.href = "/login";
      });
  }, []);

  return null;
}
