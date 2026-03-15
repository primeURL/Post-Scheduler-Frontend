import { useState, useEffect, useId } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { Post, PostAnalytics } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function deltaBadge(
  current: number,
  prev: number | undefined
): { sign: 1 | -1 | 0; display: string } {
  if (prev === undefined) return { sign: 0, display: "" };
  const diff = current - prev;
  if (diff === 0) return { sign: 0, display: "" };
  return {
    sign: diff > 0 ? 1 : -1,
    display: `${diff > 0 ? "+" : ""}${fmtBig(diff)}`,
  };
}

// ─── SVG Sparkline ────────────────────────────────────────────────────────────

function Sparkline({
  points,
  color,
  gradId,
}: {
  points: { x: number; y: number }[];
  color: string;
  gradId: string;
}) {
  const W = 600;
  const H = 100;
  const PX = 6;
  const PY = 8;

  if (points.length === 0) return null;

  if (points.length === 1) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: H }}
        aria-hidden="true"
      >
        <circle cx={W / 2} cy={H / 2} r={4} fill={color} />
      </svg>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xR = maxX - minX || 1;
  const yR = maxY - minY || 1;

  const cx = (x: number) => PX + ((x - minX) / xR) * (W - PX * 2);
  const cy = (y: number) => PY + (H - PY * 2) * (1 - (y - minY) / yR);

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${cx(p.x)} ${cy(p.y)}`)
    .join(" ");

  const areaD =
    `M ${cx(points[0].x)} ${H - PY} ` +
    points.map((p) => `L ${cx(p.x)} ${cy(p.y)}`).join(" ") +
    ` L ${cx(points[points.length - 1].x)} ${H - PY} Z`;

  const lastPt = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Endpoint dot */}
      <circle cx={cx(lastPt.x)} cy={cy(lastPt.y)} r={4} fill={color} />
      <circle
        cx={cx(lastPt.x)}
        cy={cy(lastPt.y)}
        r={7}
        fill={color}
        opacity={0.18}
      />
    </svg>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  prev,
  color,
  icon,
}: {
  label: string;
  value: number;
  prev?: number;
  color: string;
  icon: React.ReactNode;
}) {
  const { sign, display } = deltaBadge(value, prev);

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "var(--color-elevated)",
        border: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value + delta */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: "var(--color-cream)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {fmtBig(value)}
        </span>
        {sign !== 0 && (
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color:
                sign > 0 ? "var(--color-success)" : "var(--color-danger)",
              marginBottom: 3,
              fontWeight: 500,
            }}
          >
            {display}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Post selector ────────────────────────────────────────────────────────────

function PostSelector({
  posts,
  selectedId,
  onChange,
}: {
  posts: Post[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  const selected = posts.find((p) => p.id === selectedId);

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 14,
        background: "var(--color-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted)",
            flexShrink: 0,
          }}
        >
          Post
        </span>

        <select
          value={selectedId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-cream)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 8,
            outline: "none",
            cursor: "pointer",
            flex: 1,
            minWidth: 0,
          }}
        >
          {posts.map((p) => {
            const date = p.published_at
              ? fmtDate(p.published_at)
              : fmtDate(p.created_at);
            const preview = p.content.slice(0, 55).trimEnd();
            const truncated = p.content.length > 55 ? "…" : "";
            return (
              <option key={p.id} value={p.id}>
                {date} · {preview}
                {truncated}
              </option>
            );
          })}
        </select>

        {selected?.published_at && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted)",
              flexShrink: 0,
            }}
          >
            Published {fmtDate(selected.published_at)}
          </span>
        )}
      </div>

      {/* Content preview */}
      {selected && (
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            color: "var(--color-cream)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {selected.content}
        </p>
      )}
    </div>
  );
}

// ─── Metric definitions ───────────────────────────────────────────────────────

const METRICS: {
  key: keyof Omit<PostAnalytics, "id" | "post_id" | "fetched_at">;
  label: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "impressions",
    label: "Impressions",
    color: "var(--color-accent)",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <ellipse cx="7" cy="7" rx="6" ry="4" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="7" cy="7" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "likes",
    label: "Likes",
    color: "#F47B9E",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <path
          d="M7 12S1.5 8.2 1.5 5a3 3 0 015.5-1.65A3 3 0 0112.5 5C12.5 8.2 7 12 7 12z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "retweets",
    label: "Reposts",
    color: "var(--color-success)",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <path
          d="M2 5l3-3 3 3M5 2v6a1 1 0 001 1h5M12 9l-3 3-3-3M9 12V6a1 1 0 00-1-1H3"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "replies",
    label: "Replies",
    color: "var(--color-amber)",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <path
          d="M12 7.5a5 5 0 01-5 4H3l-1.5 1.5V7a5 5 0 015-5 5 5 0 015 5v.5z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "clicks",
    label: "Link Clicks",
    color: "#7DD3FC",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <path
          d="M5 2.5v8l2.5-2.5 2 3.5 1.5-.75-2-3.5H12L5 2.5z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "profile_visits",
    label: "Profile Visits",
    color: "#C4B5FD",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
        <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M2 12c0-2.76 2.24-4 5-4s5 1.24 5 4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  useStore($user);

  const gradId = useId().replace(/:/g, "");

  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Load published posts
  useEffect(() => {
    api
      .get<Post[]>("/posts?limit=200")
      .then((data) => {
        const published = data
          .filter((p) => p.status === "published")
          .sort(
            (a, b) =>
              new Date(b.published_at ?? b.created_at).getTime() -
              new Date(a.published_at ?? a.created_at).getTime()
          );
        setPosts(published);
        if (published.length > 0) setSelectedId(published[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, []);

  // Load analytics when selected post changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingAnalytics(true);
    setAnalytics([]);
    api
      .get<PostAnalytics[]>(`/analytics/posts/${selectedId}`)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [selectedId]);

  const latest = analytics[analytics.length - 1] ?? null;
  const prev = analytics[analytics.length - 2] ?? null;

  const sparkPoints = analytics.map((a) => ({
    x: new Date(a.fetched_at).getTime(),
    y: a.impressions,
  }));

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingPosts) {
    return (
      <div
        className="w-full max-w-4xl mx-auto px-4 py-8"
        style={{ animation: "var(--animate-fade-up)" }}
      >
        <p
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--color-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          Loading…
        </p>
      </div>
    );
  }

  // ── No published posts ───────────────────────────────────────────────────
  if (posts.length === 0) {
    return (
      <div
        className="w-full max-w-4xl mx-auto px-4 py-8"
        style={{ animation: "var(--animate-fade-up)" }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            marginBottom: 32,
          }}
        >
          Analytics
        </h1>
        <div
          style={{
            padding: "48px 24px",
            borderRadius: 16,
            background: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--color-muted)",
              marginBottom: 16,
            }}
          >
            No published posts yet.
          </p>
          <a
            href="/compose"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent)",
              background:
                "color-mix(in srgb, var(--color-accent) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              padding: "8px 16px",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12">
              <path
                d="M6 2v8M2 6h8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            Write and schedule a post
          </a>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 py-8"
      style={{ animation: "var(--animate-fade-up)" }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--color-cream)",
          fontFamily: "var(--font-sans)",
          marginBottom: 20,
        }}
      >
        Analytics
      </h1>

      {/* Post selector */}
      <div style={{ marginBottom: 24 }}>
        <PostSelector
          posts={posts}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
      </div>

      {/* Loading analytics */}
      {loadingAnalytics && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-muted)",
            marginBottom: 20,
          }}
        >
          Fetching metrics…
        </p>
      )}

      {/* No snapshots yet */}
      {!loadingAnalytics && analytics.length === 0 && (
        <div
          style={{
            padding: "32px 24px",
            borderRadius: 14,
            background: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-muted)",
              margin: 0,
            }}
          >
            Metrics are collected every 6 hours. Check back soon.
          </p>
        </div>
      )}

      {/* Metric cards */}
      {latest && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {METRICS.map((m) => (
            <MetricCard
              key={m.key}
              label={m.label}
              value={latest[m.key]}
              prev={prev?.[m.key]}
              color={m.color}
              icon={m.icon}
            />
          ))}
        </div>
      )}

      {/* Impressions over time chart */}
      {sparkPoints.length > 0 && (
        <div
          style={{
            borderRadius: 14,
            background: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            padding: "20px 20px 12px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Impressions over time
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted)",
              }}
            >
              {sparkPoints.length} snapshot{sparkPoints.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Sparkline
            points={sparkPoints}
            color="var(--color-accent)"
            gradId={`sparkGrad_${gradId}`}
          />

          {/* X-axis endpoints */}
          {sparkPoints.length > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                }}
              >
                {fmtDateTime(analytics[0].fetched_at)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                }}
              >
                {fmtDateTime(analytics[analytics.length - 1].fetched_at)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Snapshot history table */}
      {analytics.length > 1 && (
        <div
          style={{
            borderRadius: 14,
            background: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Snapshot history
            </span>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr",
              padding: "8px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {["Date", "Impr.", "Likes", "Reposts", "Replies", "Clicks", "Profile"].map(
              (col) => (
                <span
                  key={col}
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {col}
                </span>
              )
            )}
          </div>

          {/* Rows — most recent first */}
          {[...analytics].reverse().map((snap, i) => (
            <div
              key={snap.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr",
                padding: "9px 20px",
                borderBottom:
                  i < analytics.length - 1
                    ? "1px solid var(--color-border)"
                    : "none",
                background:
                  i === 0
                    ? "color-mix(in srgb, var(--color-accent) 4%, transparent)"
                    : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                }}
              >
                {fmtDateTime(snap.fetched_at)}
              </span>
              {(
                [
                  "impressions",
                  "likes",
                  "retweets",
                  "replies",
                  "clicks",
                  "profile_visits",
                ] as const
              ).map((k) => (
                <span
                  key={k}
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-cream)",
                    tabularNums: "tabular-nums",
                  } as React.CSSProperties}
                >
                  {fmtBig(snap[k])}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Last updated */}
      {latest && (
        <p
          style={{
            marginTop: 16,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted)",
            textAlign: "right",
          }}
        >
          Last updated {fmtDateTime(latest.fetched_at)}
        </p>
      )}
    </div>
  );
}
