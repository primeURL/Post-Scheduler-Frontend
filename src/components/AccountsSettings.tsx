import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { ConnectedAccount, XConnectResponse, SubscriptionTier } from "../lib/types";
import PremiumBadge from "./PremiumBadge";
import ErrorBoundary from "./ErrorBoundary";

type Banner =
  | { tone: "success"; text: string }
  | { tone: "error"; text: string }
  | null;

const ERROR_MESSAGES: Record<string, string> = {
  x_auth_expired: "The X authorization session expired. Please try connecting again.",
  x_token_exchange_failed: "X did not return tokens for this account. Please try again.",
  x_userinfo_failed: "Your X account connected, but profile lookup failed. Please retry.",
};

export default function AccountsSettings() {
  const user = useStore($user);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [banner, setBanner] = useState<Banner>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  async function loadAccounts() {
    const data = await api.get<ConnectedAccount[]>("/accounts");
    setAccounts(data.filter((a) => a.platform === "x"));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected === "x") {
      setBanner({ tone: "success", text: "Your X account is connected. You can schedule posts now." });
    } else if (error) {
      setBanner({ tone: "error", text: ERROR_MESSAGES[error] ?? "Connecting your X account failed." });
    }

    loadAccounts().catch((err) => {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not load connected accounts.",
      });
    });
  }, []);

  async function handleConnect() {
    try {
      setConnecting(true);
      const data = await api.get<XConnectResponse>("/accounts/x/connect?next=/settings/accounts");
      window.location.href = data.authorization_url;
    } catch (err) {
      setConnecting(false);
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not start the X connection flow.",
      });
    }
  }

  async function handleDisconnect(accountId: string) {
    try {
      setDisconnectingId(accountId);
      await api.delete(`/accounts/${accountId}`);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setBanner({ tone: "success", text: "X account disconnected." });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not disconnect this X account.",
      });
    } finally {
      setDisconnectingId(null);
    }
  }

  const xConnected = accounts.length > 0;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto w-full">

      <div className="flex flex-col md:flex-row gap-8">

        {/* ── Sidebar nav ── */}
        <aside className="w-full md:w-56 shrink-0 flex flex-col gap-2">
          <nav className="flex flex-col gap-1">
            <a
              href="/settings/accounts"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/15 text-primary font-semibold text-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>manage_accounts</span>
              Account Settings
            </a>
            {[
              { icon: "calendar_month", label: "Schedules", href: "/calendar" },
              { icon: "bar_chart", label: "Performance", href: "/analytics" },
              { icon: "credit_card", label: "Billing & Plans", href: "#" },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-muted hover:text-cream hover:bg-elevated transition-colors text-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
                {label}
              </a>
            ))}
          </nav>

          {/* Usage meter */}
          <div
            className="mt-6 p-4 rounded-xl"
            style={{ background: "rgba(123,97,255,0.06)", border: "1px solid rgba(123,97,255,0.15)" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Usage</p>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Monthly Posts</span>
              <span className="font-medium text-cream">420 / 1000</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
              <div className="h-full w-[42%] rounded-full bg-primary" />
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col gap-6">

          {/* Banner */}
          {banner && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{
                background: banner.tone === "success" ? "rgba(78,204,128,0.1)" : "rgba(240,112,80,0.1)",
                border: banner.tone === "success" ? "1px solid rgba(78,204,128,0.3)" : "1px solid rgba(240,112,80,0.3)",
                color: banner.tone === "success" ? "#4ECC80" : "#F07050",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {banner.tone === "success" ? "check_circle" : "error"}
              </span>
              {banner.text}
            </div>
          )}

          {/* ── Connect X section ── */}
          <section
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(123,97,255,0.04)", border: "1px solid rgba(123,97,255,0.2)" }}
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">

              {/* Left copy */}
              <div className="flex-1 space-y-4">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                  style={{ background: "rgba(139,151,255,0.1)", color: "#8B97FF" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
                  Social Integration
                </div>

                <h2 className="text-2xl font-bold text-cream">Connect your X account</h2>
                <p className="text-sm text-muted leading-relaxed max-w-md">
                  Schedule posts, track engagement, and manage your presence on X (formerly Twitter)
                  directly from your dashboard. We use industry-standard OAuth 2.0 to ensure your
                  credentials remain private.
                </p>

                <div className="flex flex-col gap-2.5 py-2">
                  {[
                    { icon: "verified_user", text: "Secure OAuth 2.0 Connection" },
                    { icon: "lock", text: "We never store your password" },
                    { icon: "sync_saved_locally", text: "Auto-sync engagement metrics every 15 mins" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-3 text-sm text-muted">
                      <span className="material-symbols-outlined text-success" style={{ fontSize: 18 }}>{icon}</span>
                      {text}
                    </div>
                  ))}
                </div>

                {xConnected ? (
                  /* Connected accounts list */
                  <div className="flex flex-col gap-3 pt-2">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: "rgba(78,204,128,0.07)", border: "1px solid rgba(78,204,128,0.2)" }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {account.avatar_url ? (
                            <img
                              src={account.avatar_url}
                              alt={`@${account.platform_username}`}
                              className="size-11 rounded-full object-cover ring-2 ring-success/30"
                            />
                          ) : (
                            <div
                              className="size-11 rounded-full flex items-center justify-center font-bold text-sm"
                              style={{ background: "rgba(123,97,255,0.2)", color: "#7b61ff" }}
                            >
                              {account.platform_username[0].toUpperCase()}
                            </div>
                          )}

                          {/* Account info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-cream">@{account.platform_username}</p>
                              <ErrorBoundary fallback={null}>
                                {account.subscription_type && (
                                  <PremiumBadge tier={account.subscription_type} size="sm" />
                                )}
                              </ErrorBoundary>
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                              Connected {new Date(account.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnectingId === account.id}
                          className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-danger/10"
                          style={{ color: "#F07050", border: "1px solid rgba(240,112,80,0.3)" }}
                        >
                          {disconnectingId === account.id ? "Disconnecting…" : "Disconnect"}
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="mt-1 flex w-fit items-center gap-2.5 rounded-xl border border-border bg-elevated px-6 py-3 text-sm font-bold text-cream transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="size-5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
                      </svg>
                      {connecting ? "Redirecting…" : "Add Another Account"}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full md:w-auto flex items-center justify-center gap-3 rounded-xl px-8 py-4 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                      style={{ background: "#1A1D28", color: "#DED9CE", border: "1px solid rgba(123,97,255,0.3)", boxShadow: "0 4px 20px rgba(123,97,255,0.15)" }}
                    >
                      <svg className="size-6 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
                      </svg>
                      {connecting ? "Redirecting…" : "Connect X Account"}
                    </button>
                    <p className="text-xs text-muted">
                      By connecting, you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </div>
                )}
              </div>

              {/* Right decorative panel */}
              <div className="hidden md:flex w-1/3 justify-center">
                <div className="relative">
                  <div
                    className="absolute -inset-4 rounded-full blur-3xl"
                    style={{ background: "rgba(123,97,255,0.15)" }}
                  />
                  <div
                    className="relative p-8 rounded-3xl rotate-3"
                    style={{ background: "#11141C", border: "1px solid rgba(123,97,255,0.25)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className="size-20 rounded-2xl flex items-center justify-center"
                        style={{ background: "#0A0C10", border: "1px solid #252B3C" }}
                      >
                        <svg className="size-10 fill-cream" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="h-2 w-24 rounded-full mx-auto mb-2 bg-elevated" />
                        <div className="h-2 w-16 rounded-full mx-auto bg-surface" />
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-1 w-8 rounded-full bg-primary/30" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Profile Details + API Status ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Profile Details */}
            <div
              className="p-6 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(123,97,255,0.12)" }}
            >
              <h3 className="text-base font-bold text-cream mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>person</span>
                Profile Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Display Name</label>
                  <div
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-cream font-medium"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(123,97,255,0.15)" }}
                  >
                    {user?.name ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Email Address</label>
                  <div
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-cream font-medium"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(123,97,255,0.15)" }}
                  >
                    {user?.email ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Member Since</label>
                  <div
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-cream font-medium"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(123,97,255,0.15)" }}
                  >
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* API Status */}
            <div
              className="p-6 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(123,97,255,0.12)" }}
            >
              <h3 className="text-base font-bold text-cream mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>api</span>
                API Status
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Connection Engine", status: "OPERATIONAL", ok: true },
                  { label: "X Data Pipeline", status: xConnected ? "OPERATIONAL" : "DISCONNECTED", ok: xConnected },
                  { label: "LinkedIn API", status: "COMING SOON", ok: false },
                ].map(({ label, status, ok }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                    style={{
                      background: ok ? "rgba(78,204,128,0.05)" : "rgba(255,255,255,0.02)",
                      border: ok ? "1px solid rgba(78,204,128,0.2)" : "1px solid rgba(123,97,255,0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-2 rounded-full"
                        style={{ background: ok ? "#4ECC80" : "#545B73" }}
                      />
                      <span className={`text-sm font-medium ${ok ? "text-success" : "text-muted"}`}>
                        {label}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold tracking-wide"
                      style={{ color: ok ? "#4ECC80" : "#545B73" }}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Subscription banner ── */}
          <div
            className="p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #7b61ff 0%, #5b45d4 100%)", boxShadow: "0 8px 40px rgba(123,97,255,0.35)" }}
          >
            <div
              className="absolute top-0 right-0 size-64 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"
              style={{ background: "rgba(255,255,255,0.1)" }}
            />
            <div className="relative flex flex-col gap-2">
              <div className="px-3 py-1 rounded-full w-fit text-xs font-bold uppercase tracking-wider text-white/80"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                Current Plan
              </div>
              <h3 className="text-2xl font-black text-white">Pro Monthly Subscriber</h3>
              <p className="text-white/70 text-sm">
                Your next billing date is <span className="font-bold text-white">October 12, 2024</span>.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row gap-3">
              <button className="bg-white text-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/90 transition-colors">
                Manage Subscription
              </button>
              <button
                className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.3)" }}
              >
                View Invoices
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
