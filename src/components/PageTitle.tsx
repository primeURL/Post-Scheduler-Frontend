import { useEffect, useState } from "react";

const PATH_LABELS: Record<string, { label: string; icon: string }> = {
  "/dashboard":          { label: "Dashboard",        icon: "grid_view" },
  "/compose":            { label: "Compose",           icon: "edit_square" },
  "/calendar":           { label: "Calendar",          icon: "calendar_month" },
  "/analytics":          { label: "Analytics",         icon: "insights" },
  "/settings/accounts":  { label: "Account Settings",  icon: "manage_accounts" },
};

function getPageMeta(pathname: string) {
  // Exact match first
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname];
  // Prefix match (e.g. /settings/...)
  for (const [key, val] of Object.entries(PATH_LABELS)) {
    if (key !== "/" && pathname.startsWith(key)) return val;
  }
  return { label: "Post Scheduler", icon: "grid_view" };
}

export default function PageTitle() {
  const [meta, setMeta] = useState(() =>
    typeof window !== "undefined"
      ? getPageMeta(window.location.pathname)
      : { label: "Post Scheduler", icon: "grid_view" }
  );

  useEffect(() => {
    const update = () => setMeta(getPageMeta(window.location.pathname));
    // Update on Astro client-side navigation
    document.addEventListener("astro:page-load", update);
    return () => document.removeEventListener("astro:page-load", update);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 28%, transparent)",
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 17, color: "var(--color-accent)" }}
        >
          {meta.icon}
        </span>
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "var(--font-sans)",
          color: "var(--color-cream)",
          letterSpacing: "-0.01em",
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}
