import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { $user, clearAuth, setAuth } from "../stores/auth";
import { api } from "../lib/api";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function HeaderUser() {
  const user = useStore($user);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Silently try to restore session from refresh token cookie
  useEffect(() => {
    if (user) { setReady(true); return; }
    const csrf = getCsrfToken();
    if (!csrf) { setReady(true); return; }

    fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const { access_token } = await res.json();
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
          credentials: "include",
        });
        if (!meRes.ok) return;
        const profile = await meRes.json();
        setAuth(access_token, profile);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await api.post<void>("/auth/logout", {});
    } catch {
      // Clear local state even if the session was already invalid.
    }

    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase sign-out errors so app logout still succeeds.
    }

    clearAuth();
    window.location.href = "/";
  }

  if (!ready) {
    // Skeleton placeholder matching the size of the avatar
    return <div className="size-9 rounded-full bg-primary/10 animate-pulse" />;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:bg-primary/90"
        style={{ background: "#7b61ff" }}
      >
        Login
      </a>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        title={user.name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="block"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="size-9 rounded-full border-2 border-primary/40 object-cover"
          />
        ) : (
          <div className="size-9 rounded-full border-2 border-primary/30 bg-primary/20 flex items-center justify-center text-primary font-bold text-sm select-none">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.75rem)] w-56 rounded-2xl border border-border bg-surface p-2 shadow-2xl"
          style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}
        >
          <div className="rounded-xl px-3 py-2">
            <p className="truncate text-sm font-semibold text-cream">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <a
            href="/settings/accounts"
            role="menuitem"
            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-cream transition-colors hover:bg-elevated"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>manage_accounts</span>
            Account settings
          </a>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
