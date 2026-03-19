import { useState, useEffect } from "react";

const NAV = [
  { href: "/dashboard", icon: "grid_view",      label: "Dashboard"        },
  { href: "/compose",   icon: "edit_square",     label: "Compose"          },
  { href: "/calendar",  icon: "calendar_month",  label: "Calendar"         },
  { href: "/analytics", icon: "insights",        label: "Analytics"        },
  { href: "/settings/accounts", icon: "manage_accounts", label: "Account Settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [path, setPath] = useState("");

  useEffect(() => {
    // Initial load
    setPath(window.location.pathname);
    const saved = localStorage.getItem("ps-sidebar");
    if (saved === "collapsed") setCollapsed(true);

    // Update active link on every Astro client-side navigation
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
    <aside
      className="hidden lg:flex flex-col border-r border-border bg-surface shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 64 : 224,
        transition: "width 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Logo */}
      <a
        href="/"
        className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0"
        style={{ minHeight: 56 }}
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            grid_view
          </span>
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-cream whitespace-nowrap">
            Post Scheduler
          </span>
        )}
      </a>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto overflow-x-hidden">
        {NAV.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <a
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg py-2.5 transition-all whitespace-nowrap ${
                collapsed ? "px-2 justify-center" : "px-3"
              } ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontSize: 20 }}
              >
                {icon}
              </span>
              {!collapsed && (
                <span className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>
                  {label}
                </span>
              )}
            </a>
          );
        })}

        {/* Unscheduled drafts — only when expanded */}
        {!collapsed && (
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Unscheduled Drafts
              </h3>
              <span className="rounded-full border border-border bg-elevated px-2 py-0.5 text-[10px] text-cream">
                4
              </span>
            </div>

            <div
              className="rounded-xl border border-border bg-ink/40 p-3 hover:border-primary/40 cursor-grab transition-colors"
            >
              <div className="mb-1.5 h-14 w-full overflow-hidden rounded-lg bg-elevated flex items-center justify-center">
                <span className="material-symbols-outlined text-muted" style={{ fontSize: 24 }}>
                  image
                </span>
              </div>
              <p className="text-[11px] font-medium text-cream line-clamp-2">
                New Product Launch Teaser #1
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-muted" style={{ fontSize: 12 }}>
                  repeat
                </span>
                <span className="text-[9px] text-muted uppercase tracking-wide">Draft</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-ink/40 p-3 hover:border-primary/40 cursor-grab transition-colors">
              <p className="text-[11px] font-medium text-cream line-clamp-2">
                Weekly Roundup Article Hook
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-muted" style={{ fontSize: 12 }}>
                  repeat
                </span>
                <span className="text-[9px] text-muted uppercase tracking-wide">Draft</span>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer: Create Post + collapse toggle */}
      <div className="p-2 flex flex-col gap-1 border-t border-border shrink-0">
        <a
          href="/compose"
          title={collapsed ? "Create Post" : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-bold text-sm transition-colors hover:bg-primary/90 ${
            collapsed ? "p-2.5" : "py-2.5 px-3"
          }`}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18 }}>
            add
          </span>
          {!collapsed && <span>Create Post</span>}
        </a>

        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-muted hover:text-cream hover:bg-elevated transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
