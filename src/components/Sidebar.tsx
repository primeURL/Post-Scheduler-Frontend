import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  PenSquare, 
  Calendar, 
  BarChart3, 
  Settings, 
  LayoutGrid, 
  Plus, 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/compose",   icon: PenSquare,       label: "Compose"   },
  { href: "/calendar",  icon: Calendar,        label: "Calendar"  },
  { href: "/analytics", icon: BarChart3,       label: "Analytics" },
  { href: "/settings/accounts", icon: Settings, label: "Settings"  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [path, setPath] = useState("");

  useEffect(() => {
    setPath(window.location.pathname);
    const saved = localStorage.getItem("ps-sidebar");
    if (saved === "collapsed") setCollapsed(true);

    const onNav = () => setPath(window.location.pathname);
    document.addEventListener("astro:page-load", onNav);
    return () => document.removeEventListener("astro:page-load", onNav);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("ps-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href));

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="hidden lg:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-ink)] shrink-0 overflow-hidden relative z-50 backdrop-blur-xl"
    >
      {/* Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--color-accent)] opacity-[0.03] blur-[80px]" />
      </div>

      {/* Logo Section */}
      <a
        href="/"
        className="flex items-center gap-3 px-6 py-8 shrink-0 relative group"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shrink-0 shadow-lg shadow-[var(--color-primary)]/20 transition-transform group-hover:scale-110">
          <LayoutGrid className="w-5 h-5 fill-white" />
        </div>
        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <span className="text-lg font-black tracking-tighter text-[var(--color-cream)] leading-none uppercase">
              Post
            </span>
            <span className="text-xs font-black tracking-tighter text-[var(--color-accent)] leading-none uppercase">
              Scheduler
            </span>
          </motion.div>
        )}
      </a>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1.5 px-3 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-4">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <a
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl py-3 px-4 transition-all duration-300 relative",
                collapsed ? "justify-center px-0" : "",
                active
                  ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-cream)] hover:bg-[var(--color-elevated)]"
              )}
            >
              {active && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-[var(--color-accent)] rounded-r-full shadow-[0_0_12px_rgba(139,151,255,0.5)]"
                />
              )}
              <Icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active ? "stroke-[2.5px]" : "stroke-2")} />
              {!collapsed && (
                <span className={cn("text-sm transition-all whitespace-nowrap", active ? "font-bold tracking-tight" : "font-medium")}>
                  {label}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 flex flex-col gap-2 mt-auto border-t border-[var(--color-border)]/50">
        <a
          href="/compose"
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-[#0f1117] font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--color-primary)]/20 active:scale-[0.98]",
            collapsed ? "p-3" : "py-3 px-4"
          )}
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          {!collapsed && <span>Create Post</span>}
        </a>

        <button
          onClick={toggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[var(--color-muted)] hover:text-[var(--color-cream)] hover:bg-[var(--color-elevated)] transition-all font-mono text-[10px] uppercase tracking-widest mt-2"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
