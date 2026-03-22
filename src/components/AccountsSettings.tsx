import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { ConnectedAccount, XConnectResponse } from "../lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Settings, 
  Calendar, 
  BarChart3, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon, 
  ShieldCheck, 
  Twitter, 
  Lock, 
  RefreshCcw,
  Zap,
  Globe,
  MoreVertical,
  Trash2,
  ChevronRight,
  Fingerprint,
  Plus,
  Clock
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import PremiumBadge from "./PremiumBadge";
import ErrorBoundary from "./ErrorBoundary";

type Banner =
  | { tone: "success"; text: string }
  | { tone: "error"; text: string }
  | null;

const ERROR_MESSAGES: Record<string, string> = {
  x_auth_expired: "X authorization expired. Please reconnect.",
  x_token_exchange_failed: "X handshake failed. Please try again.",
  x_userinfo_failed: "Profile lookup failed. Please retry.",
};

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
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
      setBanner({ tone: "success", text: "X account connected successfully." });
    } else if (error) {
      setBanner({ tone: "error", text: ERROR_MESSAGES[error] ?? "Connection failed." });
    }

    loadAccounts().catch((err) => {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Load failed.",
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
        text: err instanceof Error ? err.message : "Handshake failed.",
      });
    }
  }

  async function handleDisconnect(accountId: string) {
    try {
      setDisconnectingId(accountId);
      await api.delete(`/accounts/${accountId}`);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setBanner({ tone: "success", text: "Account disconnected." });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Disconnect failed.",
      });
    } finally {
      setDisconnectingId(null);
    }
  }

  const xConnected = accounts.length > 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-10"
    >
      {/* Header */}
      <div className="space-y-1">
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-[var(--color-accent)] font-mono text-xs uppercase tracking-[0.3em]">
          <Settings className="w-4 h-4" />
          General Settings
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl font-extrabold font-sans text-[var(--color-cream)] tracking-tight">
          Management
        </motion.h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Navigation Sidebar */}
        <motion.aside variants={itemVariants} className="w-full lg:w-72 shrink-0 space-y-8 sticky top-10">
          <nav className="flex flex-col gap-1.5 p-2 rounded-2xl bg-[var(--color-elevated)]/30 border border-[var(--color-border)]/50 backdrop-blur-md">
            <a
              href="/settings/accounts"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold text-sm shadow-sm"
            >
              <User className="w-4 h-4" />
              Account Connections
            </a>
            {[
              { icon: Calendar, label: "Schedules", href: "/calendar" },
              { icon: BarChart3, label: "Performance", href: "/analytics" },
              { icon: CreditCard, label: "Billing & Plans", href: "#" },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-cream)] hover:bg-[var(--color-elevated)] transition-all text-sm font-medium"
              >
                <Icon className="w-4 h-4" />
                {label}
              </a>
            ))}
          </nav>

          {/* Usage Meter */}
          <div className="p-6 rounded-2xl border border-[var(--color-border)]/50 bg-gradient-to-br from-[var(--color-elevated)]/20 to-[var(--color-accent)]/5 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-12 h-12 text-[var(--color-accent)]" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)] mb-4 font-mono">Capacity Limit</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-[var(--color-cream)]">Monthly Output</span>
              <span className="text-xs font-mono text-[var(--color-muted)]">42% used</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-ink)]/50 overflow-hidden ring-1 ring-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "42%" }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.3)]" 
              />
            </div>
            <p className="text-[10px] text-[var(--color-muted)] font-mono mt-3">420 of 1000 posts delivered</p>
          </div>
        </motion.aside>

        {/* Content Area */}
        <div className="flex-1 space-y-8 w-full">
          {/* Banner Notifications */}
          <AnimatePresence mode="wait">
            {banner && (
              <motion.div
                key={banner.text}
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-medium border shadow-lg",
                  banner.tone === "success" 
                    ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)] shadow-[var(--color-success)]/5" 
                    : "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20 text-[var(--color-danger)] shadow-[var(--color-danger)]/5"
                )}
              >
                {banner.tone === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {banner.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Integration Section */}
          <Card className="overflow-hidden border-none bg-[var(--color-elevated)]/20 backdrop-blur-xl shadow-2xl relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Twitter className="w-64 h-64 rotate-12" />
            </div>
            
            <div className="p-8 md:p-12 space-y-10 relative z-10">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="flex-1 space-y-6">
                  <Badge variant="amber" className="px-3 py-1 font-mono uppercase tracking-[0.2em]">
                    <LinkIcon className="w-3 h-3 mr-2" />
                    Connectivity
                  </Badge>
                  <h2 className="text-3xl md:text-5xl font-black text-[var(--color-cream)] tracking-tighter leading-none">
                    X-Data Pipeline
                  </h2>
                  <p className="text-base text-[var(--color-muted)] leading-relaxed font-mono max-w-xl">
                    Sync your social presence. Schedule posts, track high-fidelity engagement, and automate your X profile through our secure OAuth 2.0 tunneling system.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                    {[
                      { icon: ShieldCheck, text: "Hardened OAuth 2.0 Vault", color: "var(--color-success)" },
                      { icon: Lock, text: "Zero-Knowledge Passwords", color: "var(--color-success)" },
                      { icon: RefreshCcw, text: "Real-time Metric Syncing", color: "var(--color-accent)" },
                      { icon: Globe, text: "Global Edge Delivery", color: "var(--color-accent)" },
                    ].map(({ icon: Icon, text, color }) => (
                      <div key={text} className="flex items-center gap-3 text-sm font-medium text-[var(--color-cream)]/70">
                        <div className="p-1.5 rounded-lg bg-[var(--color-elevated)] border border-white/5">
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        {text}
                      </div>
                    ))}
                  </div>

                  {xConnected ? (
                    <div className="space-y-4">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between rounded-2xl p-5 bg-[var(--color-ink)]/60 border border-[var(--color-success)]/20 shadow-xl group hover:border-[var(--color-success)]/40 transition-all duration-300"
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              {account.avatar_url ? (
                                <img
                                  src={account.avatar_url}
                                  alt={`@${account.platform_username}`}
                                  className="size-14 rounded-full object-cover ring-2 ring-[var(--color-success)]/30 group-hover:ring-[var(--color-success)]/50 transition-all"
                                />
                              ) : (
                                <div className="size-14 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] flex items-center justify-center font-black text-xl text-white">
                                  {account.platform_username[0].toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[var(--color-ink)] border border-[var(--color-border)]">
                                <Twitter className="w-3 h-3 text-[var(--color-accent)] fill-[var(--color-accent)]" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-bold text-[var(--color-cream)]">@{account.platform_username}</h4>
                                <ErrorBoundary fallback={null}>
                                  {account.subscription_type && (
                                    <PremiumBadge tier={account.subscription_type} size="sm" />
                                  )}
                                </ErrorBoundary>
                              </div>
                              <div className="text-xs font-mono text-[var(--color-muted)] flex items-center gap-2">
                                <div className="size-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                                Synchronized since {new Date(account.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(account.id)}
                            disabled={disconnectingId === account.id}
                            className={cn(
                              "border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 hover:border-[var(--color-danger)] shrink-0",
                              disconnectingId === account.id && "animate-pulse"
                            )}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {disconnectingId === account.id ? "Dropping..." : "Disconnect"}
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        onClick={handleConnect}
                        disabled={connecting}
                        variant="secondary"
                        className="w-full md:w-auto h-12 px-8 font-bold border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 gap-2"
                      >
                        <Plus className="w-5 h-5 text-[var(--color-accent)]" />
                        {connecting ? "Handshaking..." : "Integrate Another Identity"}
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-4 space-y-4">
                      <Button
                        onClick={handleConnect}
                        disabled={connecting}
                        size="lg"
                        className="w-full md:w-auto px-10 py-7 text-lg font-black bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 shadow-2xl shadow-[var(--color-primary)]/20 group"
                      >
                        <Twitter className="w-6 h-6 mr-3 transition-transform group-hover:scale-125" fill="#0f1117" stroke="none" />
                        {connecting ? "Handshaking..." : "Authorize with X"}
                        <ChevronRight className="ml-3 w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <p className="text-xs text-[var(--color-muted)] font-mono">
                        Vault protected by enterprise-grade SOC-2 encryption standards.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Secondary Details Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <Card className="bg-[var(--color-elevated)]/20 border-none backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Fingerprint className="w-5 h-5 text-[var(--color-primary)]" />
                  Operator Profile
                </CardTitle>
                <CardDescription>Core identity markers for your account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { label: "Display Identity", value: user?.name, icon: User },
                  { label: "Neural Access Point", value: user?.email, icon: Globe },
                  { label: "Activation Date", value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : null, icon: Clock }
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="space-y-2">
                    <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.2em] font-mono">{label}</label>
                    <div className="group flex items-center justify-between p-4 rounded-xl bg-[var(--color-ink)]/40 border border-white/5 transition-all hover:bg-[var(--color-ink)]/60">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-cream)] transition-colors" />
                        <span className="text-sm font-bold text-[var(--color-cream)] font-mono">{value ?? "N/A"}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-[var(--color-elevated)]/20 border-none backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" />
                  Service Health
                </CardTitle>
                <CardDescription>Real-time status of integrated API nodes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Connection Engine", status: "OPERATIONAL", ok: true },
                  { label: "X Data Pipeline", status: xConnected ? "ACTIVE" : "OFFLINE", ok: xConnected },
                  { label: "LinkedIn API Node", status: "PENDING", ok: false },
                  { label: "Content Store (Edge)", status: "LOW LATENCY", ok: true },
                ].map(({ label, status, ok }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-4 rounded-xl transition-all duration-300 bg-[var(--color-ink)]/40 border border-white/5 hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-3 rounded-full shadow-[0_0_8px_currentColor]",
                        ok ? "text-[var(--color-success)] bg-current" : "text-[var(--color-muted)] bg-current"
                      )} />
                      <span className="text-sm font-bold text-[var(--color-cream)]">{label}</span>
                    </div>
                    <Badge variant={ok ? "success" : "secondary"} className="font-mono text-[9px] px-2 py-0.5">
                      {status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Premium CTA Card */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-[2.5rem] p-8 md:p-12 overflow-hidden shadow-2xl border border-white/10"
          >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] via-[#5b45d4] to-[var(--color-accent)] opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] rounded-full bg-white/20 blur-[120px] -translate-y-1/2 translate-x-1/2 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] rounded-full bg-[var(--color-accent)]/30 blur-[100px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative flex flex-col xl:flex-row items-center justify-between gap-10">
              <div className="space-y-6 text-center xl:text-left">
                <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-md px-4 py-1.5 font-bold uppercase tracking-[0.2em] pointer-events-none">
                  Active Subscription
                </Badge>
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">
                    Pro Edge Tier
                  </h3>
                  <p className="text-xl text-white/80 font-medium max-w-lg">
                    Unlocking multi-account coordination and deep predictive analytics across all social nodes.
                  </p>
                </div>
                <div className="flex items-center justify-center xl:justify-start gap-4 text-sm text-white/60 font-mono">
                  <Clock className="w-4 h-4" />
                  <span>Next billing cycle: Oct 12, 2024</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                <Button className="bg-white text-[var(--color-primary)] hover:bg-white/90 font-black px-10 h-14 rounded-2xl shadow-xl shadow-black/20 text-base">
                  Management Vault
                </Button>
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 font-bold px-8 h-14 rounded-2xl backdrop-blur-sm text-base">
                  Billing History
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}


