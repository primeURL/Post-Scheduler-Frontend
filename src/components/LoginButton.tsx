import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { api } from "../lib/api";
import { setAuth } from "../stores/auth";
import type { ConnectedAccount, User, XConnectResponse } from "../lib/types";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const resp = await fetch(`${API_BASE}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!resp.ok) throw new Error("Sign in failed");
      const { access_token } = (await resp.json()) as { access_token: string };

      const meResp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
        credentials: "include",
      });
      if (!meResp.ok) throw new Error("Could not fetch profile");
      const user = (await meResp.json()) as User;

      setAuth(access_token, user);

      const accounts = await api.get<ConnectedAccount[]>("/accounts").catch(() => []);
      const hasX = accounts.some((account) => account.platform === "x");

      if (!hasX) {
        const { authorization_url } = await api.get<XConnectResponse>("/accounts/x/connect?next=/compose");
        window.location.href = authorization_url;
        return;
      }

      window.location.href = "/compose";
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center gap-3 px-6 py-3 rounded-lg bg-[var(--color-elevated)] border border-[var(--color-border)] text-[var(--color-cream)] font-medium hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!loading && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
    </div>
  );
}
