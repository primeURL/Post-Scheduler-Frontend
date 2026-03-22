import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { $user, clearAuth, setAuth } from "../stores/auth";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, 
  Settings, 
  User, 
  ChevronDown, 
  ExternalLink
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";

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
      // ignore
    }

    try {
      await signOut(auth);
    } catch {
      // ignore
    }

    clearAuth();
    window.location.href = "/";
  }

  if (!ready) {
    return <div className="h-10 w-10 rounded-full bg-[var(--color-elevated)] animate-pulse" />;
  }

  if (!user) {
    return (
      <Button 
        variant="default"
        size="sm"
        className="px-6 rounded-full font-bold shadow-lg shadow-[var(--color-primary)]/10"
        asChild
      >
        <a href="/login">Login</a>
      </Button>
    );
  }

  return (
    <div ref={rootRef} className="relative z-50">
      <button
        type="button"
        title={user.name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 group p-1 pr-3 rounded-full bg-[var(--color-ink)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)]/50 transition-all active:scale-[0.98]"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="size-8 rounded-full ring-2 ring-primary/20 object-cover"
          />
        ) : (
          <div className="size-8 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white font-bold text-xs">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <span className="hidden md:block text-xs font-bold text-[var(--color-cream)] max-w-24 truncate">
          {user.name}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-[var(--color-muted)] transition-transform duration-300", open ? "rotate-180" : "")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="menu"
            className="absolute right-0 mt-3 w-64 rounded-2xl border border-[var(--color-border)] bg-[var(--color-ink)]/95 backdrop-blur-xl p-2 shadow-2xl overflow-hidden shadow-black/80"
          >
            {/* User Profile Header */}
            <div className="flex items-center gap-3 px-4 py-4 mb-2 border-b border-[var(--color-border)]/50 bg-[var(--color-elevated)]/30 rounded-t-xl">
              <div className="size-10 rounded-full border border-primary/20 p-0.5">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-[var(--color-cream)] truncate leading-none mb-1">{user.name}</span>
                <span className="text-[10px] font-mono text-[var(--color-muted)] truncate">{user.email}</span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              <MenuButton href="/settings/accounts" icon={Settings} label="Dashboard Settings" />
              <MenuButton href="/settings/profile" icon={User} label="Profile Details" />
              <MenuButton href="#" icon={ExternalLink} label="Help & Support" isExternal />
            </div>

            <div className="mt-2 pt-2 border-t border-[var(--color-border)]/50">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[var(--color-danger)] font-semibold transition-all hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({ href, icon: Icon, label, isExternal }: { href: string; icon: any; label: string; isExternal?: boolean }) {
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={cn(
        "flex items-center justify-between w-full rounded-xl px-4 py-3 text-sm font-semibold text-[var(--color-cream)] transition-all hover:bg-[var(--color-elevated)] group",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
        {label}
      </div>
      {isExternal && <ExternalLink className="w-3 h-3 text-[var(--color-muted)] opacity-50" />}
    </a>
  );
}
