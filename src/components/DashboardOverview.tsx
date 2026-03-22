import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type {
  ConnectedAccount,
  DownloadUrlResponse,
  Post,
  PostAnalyticsLatest,
} from "../lib/types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import PostDetailsModal from "./PostDetailsModal";

type LoadState = "idle" | "loading" | "error";

function fmtShortDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function teaser(content: string, length = 60): string {
  if (content.length <= length) return content;
  return `${content.slice(0, length)}...`;
}

export default function DashboardOverview() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [rows, setRows] = useState<PostAnalyticsLatest[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailMediaUrls, setDetailMediaUrls] = useState<Record<string, string>>({});
  const [detailActiveMediaIndex, setDetailActiveMediaIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setState("loading");
      setError(null);
      try {
        const [postsData, rowsData, accountData] = await Promise.all([
          api.get<Post[]>("/posts?limit=500&include_deleted=true"),
          api.get<PostAnalyticsLatest[]>("/analytics/posts?include_deleted=true"),
          api.get<ConnectedAccount[]>("/accounts").catch(() => []),
        ]);
        setPosts(postsData);
        setRows(rowsData);
        setAccounts(accountData);
        setState("idle");
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Failed to load dashboard data.");
      }
    };

    void load();
  }, []);

  const activePosts = useMemo(() => posts.filter((post) => !post.is_deleted), [posts]);

  const stats = useMemo(() => {
    const counts = {
      total: activePosts.length,
      published: 0,
      scheduled: 0,
      drafts: 0,
      failed: 0,
    };

    for (const post of activePosts) {
      if (post.status === "published") counts.published += 1;
      if (post.status === "scheduled") counts.scheduled += 1;
      if (post.status === "draft") counts.drafts += 1;
      if (post.status === "failed") counts.failed += 1;
    }

    const engagement = rows.reduce(
      (acc, row) => {
        if (row.is_deleted) return acc;
        acc.impressions += row.impression_count;
        acc.likes += row.like_count;
        acc.reposts += row.repost_count;
        acc.replies += row.reply_count;
        return acc;
      },
      { impressions: 0, likes: 0, reposts: 0, replies: 0 }
    );

    return { counts, engagement };
  }, [activePosts, rows]);

  const upcoming = useMemo(() => {
    return activePosts
      .filter((post) => post.status === "scheduled" && !!post.scheduled_for)
      .sort((a, b) => new Date(a.scheduled_for ?? 0).getTime() - new Date(b.scheduled_for ?? 0).getTime())
      .slice(0, 4);
  }, [activePosts]);

  const recentDrafts = useMemo(() => {
    return activePosts
      .filter((post) => post.status === "draft")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4);
  }, [activePosts]);

  const openDetail = async (postId: string) => {
    setDetailPostId(postId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const postData = await api.get<Post>(`/posts/${postId}?include_deleted=true`);
      const signedEntries = await Promise.all(
        (postData.media ?? [])
          .filter((m) => !!m.key)
          .map(async (m) => {
            const res = await api.get<DownloadUrlResponse>(
              `/storage/download-url?file_key=${encodeURIComponent(m.key)}`,
            );
            return [m.key, res.download_url] as const;
          }),
      );
      setDetailPost(postData);
      setDetailMediaUrls(Object.fromEntries(signedEntries));
      setDetailActiveMediaIndex(0);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Failed to load post details.");
      setDetailPost(null);
      setDetailMediaUrls({});
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailPostId(null);
    setDetailPost(null);
    setDetailMediaUrls({});
    setDetailError(null);
  };

  const refreshAll = async () => {
    try {
      const [postsData, rowsData, accountData] = await Promise.all([
        api.get<Post[]>("/posts?limit=500&include_deleted=true"),
        api.get<PostAnalyticsLatest[]>("/analytics/posts?include_deleted=true"),
        api.get<ConnectedAccount[]>("/accounts").catch(() => []),
      ]);
      setPosts(postsData);
      setRows(rowsData);
      setAccounts(accountData);
    } catch {
      // ignore in silent refresh
    }
  };

  const actionEditContent = async () => {
    if (!detailPost) return;
    window.location.href = `/compose?edit_post_id=${encodeURIComponent(detailPost.id)}`;
  };

  const actionDelete = async () => {
    if (!detailPost) return;
    setDeleteError(null);
    setDeleteTarget(detailPost);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${deleteTarget.id}`);
      setDeleteError(null);
      setDeleteTarget(null);
      closeDetail();
      await refreshAll();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" style={{ animation: "var(--animate-fade-up)" }}>
      <PostDetailsModal
        isOpen={!!detailPostId}
        onClose={closeDetail}
        post={detailPost}
        loading={detailLoading}
        error={detailError}
        mediaUrls={detailMediaUrls}
        activeMediaIndex={detailActiveMediaIndex}
        onActiveMediaIndexChange={setDetailActiveMediaIndex}
        maxWidth="760px"
        actions={
          (detailPost?.status === "draft" || detailPost?.status === "scheduled") && !detailPost?.is_deleted ? (
            <>
              <button onClick={() => { void actionEditContent(); }} style={detailButtonStyle(false)}>Edit</button>
              <button
                onClick={() => { void actionDelete(); }}
                disabled={deleting || detailPost.is_deleted}
                style={{
                  ...detailButtonStyle(deleting || detailPost.is_deleted),
                  border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
                  color: "var(--color-danger)",
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          ) : null
        }
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        busy={deleting}
        previewText={deleteTarget?.content.slice(0, 120) ?? ""}
        errorMessage={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/compose" style={quickLinkStyle(true)}>Compose</a>
          <a href="/calendar" style={quickLinkStyle(false)}>Calendar</a>
          <a href="/analytics" style={quickLinkStyle(false)}>Analytics</a>
        </div>
      </div>

      {state === "error" && (
        <div style={errorBoxStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        <MetricCard label="Total Active Posts" value={fmtBig(stats.counts.total)} accent="var(--color-accent)" />
        <MetricCard label="Published" value={fmtBig(stats.counts.published)} accent="var(--color-success)" />
        <MetricCard label="Scheduled" value={fmtBig(stats.counts.scheduled)} accent="var(--color-accent)" />
        <MetricCard label="Drafts" value={fmtBig(stats.counts.drafts)} accent="var(--color-muted)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 18 }}>
        <MetricCard label="Impressions" value={fmtBig(stats.engagement.impressions)} accent="var(--color-accent)" />
        <MetricCard label="Likes" value={fmtBig(stats.engagement.likes)} accent="var(--color-success)" />
        <MetricCard label="Reposts" value={fmtBig(stats.engagement.reposts)} accent="var(--color-amber)" />
        <MetricCard label="Replies" value={fmtBig(stats.engagement.replies)} accent="var(--color-muted)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
        <section style={panelStyle}>
          <div style={panelTitleRowStyle}>
            <h2 style={panelTitleStyle}>Upcoming Queue</h2>
            <span style={panelMetaStyle}>{upcoming.length} scheduled</span>
          </div>
          {state === "loading" && <p style={panelEmptyStyle}>Loading upcoming schedule...</p>}
          {state !== "loading" && upcoming.length === 0 && <p style={panelEmptyStyle}>No scheduled posts yet.</p>}
          {upcoming.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => {
                void openDetail(post.id);
              }}
              style={{ ...rowLinkStyle, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <div>
                <div style={rowPrimaryTextStyle}>{teaser(post.content, 90)}</div>
                <div style={rowSecondaryTextStyle}>Scheduled {fmtShortDate(post.scheduled_for)}</div>
              </div>
              <span style={statusChipStyle("scheduled")}>scheduled</span>
            </button>
          ))}
        </section>

        <section style={panelStyle}>
          <div style={panelTitleRowStyle}>
            <h2 style={panelTitleStyle}>Recent Drafts</h2>
            <span style={panelMetaStyle}>{recentDrafts.length} drafts</span>
          </div>
          {state === "loading" && <p style={panelEmptyStyle}>Loading drafts...</p>}
          {state !== "loading" && recentDrafts.length === 0 && <p style={panelEmptyStyle}>No drafts available.</p>}
          {recentDrafts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => {
                void openDetail(post.id);
              }}
              style={{ ...rowLinkStyle, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <div>
                <div style={rowPrimaryTextStyle}>{teaser(post.content, 75)}</div>
                <div style={rowSecondaryTextStyle}>Updated {fmtShortDate(post.updated_at)}</div>
              </div>
              <span style={statusChipStyle("draft")}>draft</span>
            </button>
          ))}
        </section>
      </div>

      <div style={{ marginTop: 12, ...panelStyle }}>
        <div style={panelTitleRowStyle}>
          <h2 style={panelTitleStyle}>Connections</h2>
          <a href="/settings/accounts" style={{ ...panelMetaStyle, color: "var(--color-accent)" }}>Manage</a>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {accounts.length === 0 && <span style={panelEmptyStyle}>No connected accounts yet.</span>}
          {accounts.map((account) => (
            <div key={account.id} style={accountPillStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>alternate_email</span>
              <span>@{account.platform_username}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "12px 14px",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--color-elevated) 94%, transparent), color-mix(in srgb, var(--color-ink) 14%, transparent))",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, color: "var(--color-cream)", fontSize: 24, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ marginTop: 4, height: 3, borderRadius: 999, background: accent, opacity: 0.45 }} />
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border))",
  borderRadius: 14,
  background: "color-mix(in srgb, var(--color-elevated) 92%, transparent)",
  padding: 12,
};

const panelTitleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "var(--color-cream)",
  fontFamily: "var(--font-sans)",
};

const panelMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-muted)",
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
};

const panelEmptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--color-muted)",
  fontFamily: "var(--font-mono)",
};

const rowLinkStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "10px 11px",
  marginBottom: 8,
  textDecoration: "none",
  background: "color-mix(in srgb, var(--color-ink) 16%, transparent)",
};

function detailButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: "var(--color-cream)",
    padding: "8px 12px",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const rowPrimaryTextStyle: React.CSSProperties = {
  color: "var(--color-cream)",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.25,
};

const rowSecondaryTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "var(--color-muted)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

function statusChipStyle(kind: "draft" | "scheduled"): React.CSSProperties {
  return {
    borderRadius: 999,
    border:
      kind === "scheduled"
        ? "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)"
        : "1px solid color-mix(in srgb, var(--color-muted) 45%, transparent)",
    color: kind === "scheduled" ? "var(--color-accent)" : "var(--color-muted)",
    background:
      kind === "scheduled"
        ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
        : "color-mix(in srgb, var(--color-muted) 12%, transparent)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    fontSize: 10,
    padding: "4px 8px",
    whiteSpace: "nowrap",
  };
}

const quickLinkStyle = (primary: boolean): React.CSSProperties => ({
  borderRadius: 999,
  border: primary ? "none" : "1px solid var(--color-border)",
  background: primary ? "var(--color-accent)" : "transparent",
  color: primary ? "#0f1117" : "var(--color-cream)",
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
});

const accountPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "color-mix(in srgb, var(--color-ink) 18%, transparent)",
  color: "var(--color-cream)",
  padding: "6px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

const errorBoxStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
  border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
  color: "var(--color-danger)",
  padding: "8px 10px",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
};
