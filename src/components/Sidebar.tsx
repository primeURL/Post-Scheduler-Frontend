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
                  ? "text-primary"
                  : "text-muted hover:bg-primary/10 hover:text-primary"
              }`}
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--color-accent) 20%, transparent)",
                      borderRight: "4px solid var(--color-accent)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 28%, transparent)",
                    }
                  : undefined
              }
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
