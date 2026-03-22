import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type {
  DownloadUrlResponse,
  Post,
  PostAnalytics,
  PostAnalyticsLatest,
  PostMedia,
  UploadUrlResponse,
} from "../lib/types";
import SchedulePickerModal from "./SchedulePickerModal";

function fmtDateTime(value: string | null): string {
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

function preview(content: string): string {
  return content.length > 90 ? `${content.slice(0, 90)}...` : content;
}

function getMediaKind(contentType: string): string {
  if (contentType === "image/gif") return "gif";
  if (contentType.startsWith("video/")) return "video";
  return "image";
}

function initials(content: string): string {
  const words = content
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return "P";
  return words.map((w) => w[0].toUpperCase()).join("");
}

function badgeStyle(status: string, isDeleted: boolean): React.CSSProperties {
  if (isDeleted) {
    return {
      color: "var(--color-danger)",
      border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
      background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
    };
  }
  if (status === "published") {
    return {
      color: "var(--color-success)",
      border: "1px solid color-mix(in srgb, var(--color-success) 45%, transparent)",
      background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
    };
  }
  return {
    color: "var(--color-accent)",
    border: "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
    background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
  };
}

type BusyState = Record<string, boolean>;

interface QuoteDraftMedia {
  file: File;
  previewUrl: string;
  uploading: boolean;
  uploaded?: PostMedia;
}

interface QuoteComposerState {
  postId: string;
  sourceContent: string;
  text: string;
  scheduledFor: string | null;
  media: QuoteDraftMedia | null;
}

interface EditComposerState {
  postId: string;
  content: string;
}

interface DeleteConfirmState {
  postId: string;
  content: string;
}

type AnalyticsFilter = "all" | "published" | "draft" | "deleted" | "scheduled";

export default function AnalyticsDashboard() {
  const [rows, setRows] = useState<PostAnalyticsLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>({});
  const [activeFilter, setActiveFilter] = useState<AnalyticsFilter>("all");
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [quoteComposer, setQuoteComposer] = useState<QuoteComposerState | null>(null);
  const [quoteComposerClosing, setQuoteComposerClosing] = useState(false);
  const [showQuoteSchedulePicker, setShowQuoteSchedulePicker] = useState(false);
  const [editComposer, setEditComposer] = useState<EditComposerState | null>(null);
  const [scheduleEditorPostId, setScheduleEditorPostId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailQuoteSourcePost, setDetailQuoteSourcePost] = useState<Post | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<PostAnalytics[]>([]);
  const [detailMediaUrls, setDetailMediaUrls] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "deleted") return row.is_deleted;
      if (row.is_deleted) return false;
      if (activeFilter === "published") return row.status === "published";
      if (activeFilter === "draft") return row.status === "draft";
      if (activeFilter === "scheduled") return row.status === "scheduled";
      return true;
    });
  }, [rows, activeFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.impressions += row.impression_count;
        acc.likes += row.like_count;
        acc.reposts += row.repost_count;
        acc.replies += row.reply_count;
        return acc;
      },
      { impressions: 0, likes: 0, reposts: 0, replies: 0 }
    );
  }, [filteredRows]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PostAnalyticsLatest[]>("/analytics/posts?include_deleted=true");
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      setError(null);
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const deletePost = async (postId: string) => {
    await withBusy(`delete:${postId}`, async () => {
      await api.delete(`/posts/${postId}`);
      await load();
    });
  };

  const repostPost = async (postId: string) => {
    await withBusy(`repost:${postId}`, async () => {
      await api.post(`/posts/${postId}/repost`, {});
      await load();
    });
  };

  const closeQuoteComposer = () => {
    if (!quoteComposer) return;
    setQuoteComposerClosing(true);
    window.setTimeout(() => {
      if (quoteComposer?.media?.previewUrl) {
        URL.revokeObjectURL(quoteComposer.media.previewUrl);
      }
      setQuoteComposer(null);
      setQuoteComposerClosing(false);
    }, 180);
  };

  const quotePost = async () => {
    if (!quoteComposer) return;
    const text = quoteComposer.text.trim();
    if (!text) {
      setError("Please add quote text before posting.");
      return;
    }
    if (quoteComposer.media?.uploading) {
      setError("Please wait for media upload to finish.");
      return;
    }

    await withBusy(`quote:${quoteComposer.postId}`, async () => {
      await api.post(`/posts/${quoteComposer.postId}/quote`, {
        content: text,
        scheduled_for: quoteComposer.scheduledFor ? new Date(quoteComposer.scheduledFor).toISOString() : null,
        media: quoteComposer.media?.uploaded ? [quoteComposer.media.uploaded] : null,
      });
      closeQuoteComposer();
      await load();
    });
  };

  const handleQuoteTextChange = (value: string) => {
    setQuoteComposer((prev) => (prev ? { ...prev, text: value.slice(0, 280) } : prev));
  };

  const replaceQuoteMedia = (nextMedia: QuoteDraftMedia | null) => {
    setQuoteComposer((prev) => {
      if (!prev) return prev;
      if (prev.media?.previewUrl && prev.media.previewUrl !== nextMedia?.previewUrl) {
        URL.revokeObjectURL(prev.media.previewUrl);
      }
      return { ...prev, media: nextMedia };
    });
  };

  const pickQuoteMedia = async (file: File) => {
    if (!quoteComposer) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Only image, GIF, and video files are supported.");
      return;
    }

    setError(null);
    const previewUrl = URL.createObjectURL(file);
    replaceQuoteMedia({ file, previewUrl, uploading: true });

    try {
      const upload = await api.post<UploadUrlResponse>("/storage/upload-url", {
        file_name: file.name,
        content_type: file.type,
        size: file.size,
      });

      const uploadResp = await fetch(upload.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": upload.content_type,
        },
        body: file,
      });

      if (!uploadResp.ok) {
        throw new Error("Media upload failed");
      }

      replaceQuoteMedia({
        file,
        previewUrl,
        uploading: false,
        uploaded: {
          key: upload.file_key,
          public_url: upload.public_url,
          type: getMediaKind(upload.content_type),
          content_type: upload.content_type,
          file_name: file.name,
          size: file.size,
        },
      });
    } catch (e) {
      replaceQuoteMedia(null);
      URL.revokeObjectURL(previewUrl);
      setError(e instanceof Error ? e.message : "Media upload failed.");
    }
  };

  const refreshPost = async (postId: string) => {
    await withBusy(`refresh:${postId}`, async () => {
      await api.post(`/analytics/posts/${postId}/refresh`, {});
      await load();
    });
  };

  const saveEditedContent = async () => {
    if (!editComposer) return;
    const nextContent = editComposer.content.trim();
    if (!nextContent) {
      setError("Content cannot be empty.");
      return;
    }

    await withBusy(`edit:${editComposer.postId}`, async () => {
      await api.patch<Post>(`/posts/${editComposer.postId}`, {
        content: nextContent,
      });
      setEditComposer(null);
      await load();
    });
  };

  const saveRescheduledTime = async (postId: string, localIso: string) => {
    await withBusy(`reschedule:${postId}`, async () => {
      await api.patch<Post>(`/posts/${postId}`, {
        scheduled_for: new Date(localIso).toISOString(),
      });
      setScheduleEditorPostId(null);
      await load();
    });
  };

  const openComposeEditor = (postId: string) => {
    window.location.href = `/compose?edit_post_id=${encodeURIComponent(postId)}`;
  };

  const openPostDetail = async (postId: string) => {
    setDetailPostId(postId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [postData, analyticsData] = await Promise.all([
        api.get<Post>(`/posts/${postId}?include_deleted=true`),
        api.get<PostAnalytics[]>(`/analytics/posts/${postId}`).catch(() => []),
      ]);

      const mediaEntries = postData.media ?? [];
      const signedUrls = await Promise.all(
        mediaEntries
          .filter((m) => !!m.key)
          .map(async (m) => {
            const result = await api.get<DownloadUrlResponse>(`/storage/download-url?file_key=${encodeURIComponent(m.key)}`);
            return [m.key, result.download_url] as const;
          })
      );

      setDetailPost(postData);
      setDetailAnalytics(analyticsData);
      setDetailMediaUrls(Object.fromEntries(signedUrls));

      if (postData.quote_of_platform_post_id) {
        const sourcePost = await api
          .get<Post>(`/posts/by-platform-id/${encodeURIComponent(postData.quote_of_platform_post_id)}?include_deleted=true`)
          .catch(() => null);
        setDetailQuoteSourcePost(sourcePost);
      } else {
        setDetailQuoteSourcePost(null);
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Failed to load post details");
      setDetailPost(null);
      setDetailQuoteSourcePost(null);
      setDetailAnalytics([]);
      setDetailMediaUrls({});
    } finally {
      setDetailLoading(false);
    }
  };

  const closePostDetail = () => {
    setDetailPostId(null);
    setDetailPost(null);
    setDetailQuoteSourcePost(null);
    setDetailAnalytics([]);
    setDetailMediaUrls({});
    setDetailError(null);
  };

  const canPublishedAction = (row: PostAnalyticsLatest): boolean =>
    row.status === "published" && !!row.x_post_id && !row.is_deleted;

  const canScheduledCrud = (row: PostAnalyticsLatest): boolean =>
    row.status === "scheduled" && !row.is_deleted;

  const engagementScore = (row: PostAnalyticsLatest): number =>
    row.like_count + row.repost_count + row.reply_count + row.quoted_count + row.bookmarks;

  const engagementRate = (row: PostAnalyticsLatest): string => {
    if (!row.impression_count) return "0.0%";
    const rate = (engagementScore(row) / row.impression_count) * 100;
    return `${rate.toFixed(1)}%`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" style={{ animation: "var(--animate-fade-up)" }}>
      {quoteComposer && (
        <QuoteComposerModal
          isClosing={quoteComposerClosing}
          sourceContent={quoteComposer.sourceContent}
          text={quoteComposer.text}
          media={quoteComposer.media}
          scheduledFor={quoteComposer.scheduledFor}
          busy={!!busy[`quote:${quoteComposer.postId}`]}
          onClose={closeQuoteComposer}
          onChangeText={handleQuoteTextChange}
          onSubmit={() => {
            void quotePost();
          }}
          onPickMedia={(file) => {
            void pickQuoteMedia(file);
          }}
          onRemoveMedia={() => replaceQuoteMedia(null)}
          onOpenSchedule={() => setShowQuoteSchedulePicker(true)}
          onClearSchedule={() => setQuoteComposer((prev) => (prev ? { ...prev, scheduledFor: null } : prev))}
        />
      )}

      {quoteComposer && showQuoteSchedulePicker && (
        <SchedulePickerModal
          initialISO={quoteComposer.scheduledFor}
          onClose={() => setShowQuoteSchedulePicker(false)}
          onConfirm={(localIso) => {
            setQuoteComposer((prev) => (prev ? { ...prev, scheduledFor: localIso } : prev));
            setShowQuoteSchedulePicker(false);
          }}
        />
      )}

      {scheduleEditorPostId && (
        <SchedulePickerModal
          initialISO={rows.find((row) => row.post_id === scheduleEditorPostId)?.scheduled_for ?? null}
          onClose={() => setScheduleEditorPostId(null)}
          onConfirm={(localIso) => {
            void saveRescheduledTime(scheduleEditorPostId, localIso);
          }}
        />
      )}

      {editComposer && (
        <EditPostModal
          content={editComposer.content}
          busy={!!busy[`edit:${editComposer.postId}`]}
          onClose={() => setEditComposer(null)}
          onChange={(value) => setEditComposer((prev) => (prev ? { ...prev, content: value } : prev))}
          onSave={() => {
            void saveEditedContent();
          }}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          content={deleteConfirm.content}
          busy={!!busy[`delete:${deleteConfirm.postId}`]}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            void deletePost(deleteConfirm.postId);
            setDeleteConfirm(null);
          }}
        />
      )}

      {detailPostId && (
        <PostDetailModal
          loading={detailLoading}
          error={detailError}
          post={detailPost}
          quoteSourcePost={detailQuoteSourcePost}
          analytics={detailAnalytics}
          mediaUrls={detailMediaUrls}
          onClose={closePostDetail}
          onRefresh={() => {
            if (!detailPostId) return;
            void openPostDetail(detailPostId);
          }}
          onOpenQuote={() => {
            if (!detailPost) return;
            const sourcePost = detailPost;
            closePostDetail();
            setQuoteComposer({
              postId: sourcePost.id,
              sourceContent: sourcePost.content,
              text: "",
              scheduledFor: null,
              media: null,
            });
            setQuoteComposerClosing(false);
          }}
          onOpenEdit={() => {
            if (!detailPost) return;
            openComposeEditor(detailPost.id);
          }}
          onOpenReschedule={() => {
            if (!detailPost) return;
            setScheduleEditorPostId(detailPost.id);
          }}
          onDelete={() => {
            if (!detailPost) return;
            setDeleteConfirm({ postId: detailPost.id, content: detailPost.content });
          }}
          onRepost={() => {
            if (!detailPost) return;
            void repostPost(detailPost.id);
          }}
          onManualRefresh={() => {
            if (!detailPost) return;
            void refreshPost(detailPost.id);
          }}
          busy={busy}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            margin: 0,
          }}
        >
          Analytics
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          border: "1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border))",
          background: "color-mix(in srgb, var(--color-ink) 22%, transparent)",
          borderRadius: 14,
          padding: 8,
        }}
      >
        {[
          { key: "all", label: "All" },
          { key: "published", label: "Published" },
          { key: "draft", label: "Drafts" },
          { key: "deleted", label: "Deleted" },
          { key: "scheduled", label: "Scheduled" },
        ].map((item) => {
          const selected = activeFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveFilter(item.key as AnalyticsFilter)}
              style={{
                borderRadius: 12,
                border: selected ? "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)" : "1px solid transparent",
                background: selected ? "color-mix(in srgb, var(--color-accent) 16%, transparent)" : "transparent",
                color: selected ? "var(--color-cream)" : "var(--color-muted)",
                padding: "9px 14px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          { label: "Total Impressions", value: totals.impressions },
          { label: "Total Likes", value: totals.likes },
          { label: "Total Reposts", value: totals.reposts },
          { label: "Total Replies", value: totals.replies },
        ].map((item) => (
          <div key={item.label} style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px", background: "var(--color-elevated)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>{item.label}</div>
            <div style={{ marginTop: 6, color: "var(--color-cream)", fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmtBig(item.value)}</div>
          </div>
        ))}
      </div>

      {loading && (
        <p style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 13, padding: 24 }}>Loading analytics...</p>
      )}

      {error && (
        <p style={{ color: "var(--color-danger)", fontFamily: "var(--font-mono)", fontSize: 13, padding: 24 }}>{error}</p>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 24, background: "var(--color-elevated)", color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
          No posts found.
        </div>
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
            borderRadius: 20,
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-elevated)) 0%, var(--color-elevated) 100%)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.4fr 1fr 1fr 1fr 0.7fr",
              gap: 12,
              padding: "16px 18px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {[
              "Post Content",
              "Type",
              "Impressions",
              "Engagement",
              "Action",
            ].map((head) => (
              <span
                key={head}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "color-mix(in srgb, var(--color-cream) 60%, var(--color-muted))",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {head}
              </span>
            ))}
          </div>

          {filteredRows.map((row, idx) => {
            const busyDelete = !!busy[`delete:${row.post_id}`];
            const busyRepost = !!busy[`repost:${row.post_id}`];
            const busyQuote = !!busy[`quote:${row.post_id}`];
            const busyRefresh = !!busy[`refresh:${row.post_id}`];
            const busyEdit = !!busy[`edit:${row.post_id}`];
            const busyReschedule = !!busy[`reschedule:${row.post_id}`];
            const hidePerformance = row.status === "scheduled" || row.status === "draft";

            return (
              <div
                key={row.post_id}
                onClick={() => {
                  if (row.status === "draft" && !row.is_deleted) {
                    window.location.href = `/compose?draft_post_id=${encodeURIComponent(row.post_id)}`;
                    return;
                  }
                  void openPostDetail(row.post_id);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.4fr 1fr 1fr 1fr 0.7fr",
                  gap: 12,
                  padding: "16px 18px",
                  borderBottom: idx < filteredRows.length - 1 ? "1px solid var(--color-border)" : "none",
                  alignItems: "center",
                  background:
                    idx % 2 === 0
                      ? "color-mix(in srgb, var(--color-ink) 18%, transparent)"
                      : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 14, minWidth: 0, alignItems: "center" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--color-cream)",
                      background:
                        "linear-gradient(140deg, color-mix(in srgb, var(--color-accent) 75%, transparent), color-mix(in srgb, var(--color-amber) 75%, transparent))",
                    }}
                  >
                    {initials(row.content)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "var(--color-cream)",
                        fontSize: 22,
                        fontWeight: 600,
                        lineHeight: 1.1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preview(row.content)}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: "var(--color-muted)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>
                        {row.published_at ? `Posted ${fmtDateTime(row.published_at)}` : `Created ${fmtDateTime(row.fetched_at)}`}
                      </span>
                      {row.has_repost_action && (
                        <span
                          title="Reposted"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            borderRadius: 999,
                            border: "1px solid color-mix(in srgb, var(--color-success) 35%, transparent)",
                            background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
                            color: "var(--color-success)",
                            padding: "2px 7px",
                            fontSize: 10,
                          }}
                        >
                          ↻ reposted
                        </span>
                      )}
                      {row.has_quote_action && (
                        <span
                          title="Quoted"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            borderRadius: 999,
                            border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
                            background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                            color: "var(--color-accent)",
                            padding: "2px 7px",
                            fontSize: 10,
                          }}
                        >
                          💬 quoted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      ...badgeStyle(row.status, row.is_deleted),
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {row.is_deleted ? "Deleted" : row.status}
                  </span>
                </div>

                <div>
                  {hidePerformance ? (
                    <div
                      style={{
                        color: "var(--color-muted)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: 28,
                        lineHeight: 1,
                      }}
                    >
                      —
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          color: "var(--color-cream)",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: 38,
                          lineHeight: 1,
                        }}
                      >
                        {fmtBig(row.impression_count)}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--color-success)",
                          fontSize: 14,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {engagementRate(row)} rate
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 14, alignItems: "center", color: "var(--color-cream)", fontFamily: "var(--font-mono)", fontSize: 30 }}>
                  {hidePerformance ? (
                    <span style={{ color: "var(--color-muted)", fontSize: 28 }}>—</span>
                  ) : (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 22, opacity: 0.9 }}>♥</span>
                        {fmtBig(row.like_count)}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 20, opacity: 0.9 }}>💬</span>
                        {fmtBig(row.reply_count)}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ justifySelf: "end", position: "relative" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuPostId((current) => (current === row.post_id ? null : row.post_id));
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid var(--color-border)",
                      background: "color-mix(in srgb, var(--color-ink) 35%, transparent)",
                      color: "var(--color-cream)",
                      fontSize: 20,
                      lineHeight: 1,
                    }}
                    aria-label="Open actions"
                  >
                    ...
                  </button>

                  {activeMenuPostId === row.post_id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 42,
                        zIndex: 10,
                        width: 152,
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        padding: 6,
                        display: "grid",
                        gap: 4,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                      }}
                    >
                      {canPublishedAction(row) && (
                        <button
                          onClick={() => {
                            setActiveMenuPostId(null);
                            void refreshPost(row.post_id);
                          }}
                          disabled={busyRefresh}
                          style={actionButtonStyle(busyRefresh)}
                        >
                          {busyRefresh ? "Refreshing..." : "Refresh now"}
                        </button>
                      )}
                      {canPublishedAction(row) && (
                        <button
                          onClick={() => {
                            setActiveMenuPostId(null);
                            void repostPost(row.post_id);
                          }}
                          disabled={busyRepost}
                          style={actionButtonStyle(busyRepost)}
                        >
                          {busyRepost ? (row.has_repost_action ? "Undoing..." : "Reposting...") : (row.has_repost_action ? "Undo repost" : "Repost")}
                        </button>
                      )}
                      {canPublishedAction(row) && (
                        <button
                          onClick={() => {
                            setActiveMenuPostId(null);
                            setQuoteComposer({
                              postId: row.post_id,
                              sourceContent: row.content,
                              text: "",
                              scheduledFor: null,
                              media: null,
                            });
                            setQuoteComposerClosing(false);
                          }}
                          disabled={busyQuote}
                          style={actionButtonStyle(busyQuote)}
                        >
                          {busyQuote ? "Quoting..." : "Quote"}
                        </button>
                      )}
                      {canScheduledCrud(row) && (
                        <button
                          onClick={() => {
                            setActiveMenuPostId(null);
                            openComposeEditor(row.post_id);
                          }}
                          disabled={busyEdit}
                          style={actionButtonStyle(busyEdit)}
                        >
                          {busyEdit ? "Saving..." : "Edit content"}
                        </button>
                      )}
                      {canScheduledCrud(row) && (
                        <button
                          onClick={() => {
                            setActiveMenuPostId(null);
                            setScheduleEditorPostId(row.post_id);
                          }}
                          disabled={busyReschedule}
                          style={actionButtonStyle(busyReschedule)}
                        >
                          {busyReschedule ? "Saving..." : "Change time"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActiveMenuPostId(null);
                          setDeleteConfirm({
                            postId: row.post_id,
                            content: row.content,
                          });
                        }}
                        disabled={row.is_deleted || busyDelete}
                        style={{
                          ...actionButtonStyle(row.is_deleted || busyDelete),
                          color: "var(--color-danger)",
                        }}
                      >
                        {busyDelete ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 14, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
        Analytics snapshots are saved by the backend cron job every 6 hours to reduce read API usage.
      </p>
    </div>
  );
}

function EditPostModal({
  content,
  busy,
  onClose,
  onChange,
  onSave,
}: {
  content: string;
  busy: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 75,
        background: "rgba(2, 6, 14, 0.74)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          borderRadius: 16,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", color: "var(--color-cream)", fontSize: 24 }}>Edit scheduled post</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--color-cream)", fontSize: 24 }}>×</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            minHeight: 170,
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            padding: 12,
            background: "transparent",
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            fontSize: 20,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ borderRadius: 999, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-cream)", padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={busy || !content.trim()}
            style={{
              borderRadius: 999,
              border: "none",
              background: "var(--color-accent)",
              color: "#10141b",
              padding: "8px 16px",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 15,
              opacity: busy || !content.trim() ? 0.6 : 1,
            }}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  content,
  busy,
  onClose,
  onConfirm,
}: {
  content: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(2, 6, 14, 0.72)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          borderRadius: 16,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: 16,
        }}
      >
        <h3 style={{ margin: 0, color: "var(--color-cream)", fontFamily: "var(--font-sans)", fontSize: 24 }}>
          Delete this post?
        </h3>
        <p style={{ marginTop: 8, marginBottom: 0, color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          This post will be marked as deleted and hidden from active views.
        </p>
        <p style={{ marginTop: 10, color: "var(--color-cream)", fontFamily: "var(--font-sans)", fontSize: 18 }}>
          {preview(content)}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-cream)",
              padding: "8px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              borderRadius: 999,
              border: "none",
              background: "var(--color-danger)",
              color: "#10141b",
              padding: "8px 16px",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 15,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({
  loading,
  error,
  post,
  quoteSourcePost,
  analytics,
  mediaUrls,
  busy,
  onClose,
  onRefresh,
  onOpenQuote,
  onOpenEdit,
  onOpenReschedule,
  onDelete,
  onRepost,
  onManualRefresh,
}: {
  loading: boolean;
  error: string | null;
  post: Post | null;
  quoteSourcePost: Post | null;
  analytics: PostAnalytics[];
  mediaUrls: Record<string, string>;
  busy: Record<string, boolean>;
  onClose: () => void;
  onRefresh: () => void;
  onOpenQuote: () => void;
  onOpenEdit: () => void;
  onOpenReschedule: () => void;
  onDelete: () => void;
  onRepost: () => void;
  onManualRefresh: () => void;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const latest = analytics[analytics.length - 1] ?? null;
  const metricsSeries = analytics.map((item) => item.impressions);
  const isPublished = !!post && post.status === "published" && !post.is_deleted;
  const isScheduled = !!post && post.status === "scheduled" && !post.is_deleted;
  const hasActiveRepost = !!post?.reposted_at;

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [post?.id]);

  const postMedia = post?.media ?? [];
  const activeMedia = postMedia[activeMediaIndex] ?? null;

  const mediaSource = (media: PostMedia | null): string | null => {
    if (!media) return null;
    return mediaUrls[media.key] ?? media.public_url ?? null;
  };

  const trendPath = (() => {
    if (metricsSeries.length < 2) return "";
    const width = 300;
    const height = 70;
    const max = Math.max(...metricsSeries, 1);
    const min = Math.min(...metricsSeries, 0);
    const range = Math.max(max - min, 1);
    return metricsSeries
      .map((value, idx) => {
        const x = (idx / (metricsSeries.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  })();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "rgba(2, 6, 14, 0.75)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, #000), var(--color-surface))",
          padding: 16,
          boxShadow: "0 25px 90px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "var(--color-cream)", fontFamily: "var(--font-sans)", fontSize: 28 }}>Post Details</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--color-cream)", fontSize: 28, lineHeight: 1 }}>×</button>
        </div>

        {loading && (
          <p style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading post details...</p>
        )}

        {error && (
          <p style={{ color: "var(--color-danger)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{error}</p>
        )}

        {post && (
          <>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: 14, background: "color-mix(in srgb, var(--color-ink) 18%, transparent)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-muted)", textTransform: "uppercase" }}>
                  {post.status}
                </span>
                {post.scheduled_for && (
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>
                    Scheduled {fmtDateTime(post.scheduled_for)}
                  </span>
                )}
                {post.published_at && (
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-success)" }}>
                    Published {fmtDateTime(post.published_at)}
                  </span>
                )}
              </div>

              <p style={{ margin: 0, color: "var(--color-cream)", fontSize: 22, lineHeight: 1.3, fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>
                {post.content}
              </p>

              {quoteSourcePost && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    border: "1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border))",
                    background: "color-mix(in srgb, var(--color-ink) 28%, transparent)",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-accent)",
                      fontFamily: "var(--font-mono)",
                      marginBottom: 6,
                    }}
                  >
                    Original post
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-cream)",
                      fontSize: 16,
                      lineHeight: 1.35,
                      fontFamily: "var(--font-sans)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {quoteSourcePost.content}
                  </p>
                </div>
              )}

              {!!post.media?.length && (
                <div style={{ marginTop: 12 }}>
                  {activeMedia && (
                    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)", background: "#000", position: "relative" }}>
                      {activeMedia.content_type?.startsWith("video/") ? (
                        <video controls src={mediaSource(activeMedia) ?? undefined} style={{ width: "100%", maxHeight: 420, objectFit: "contain" }} />
                      ) : (
                        <img src={mediaSource(activeMedia) ?? undefined} alt={activeMedia.file_name ?? "Post media"} style={{ width: "100%", maxHeight: 420, objectFit: "contain" }} />
                      )}

                      {postMedia.length > 1 && (
                        <>
                          <button
                            onClick={() => setActiveMediaIndex((i) => (i - 1 + postMedia.length) % postMedia.length)}
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: 8,
                              transform: "translateY(-50%)",
                              border: "1px solid var(--color-border)",
                              background: "rgba(9,13,22,0.7)",
                              color: "var(--color-cream)",
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              fontSize: 20,
                              lineHeight: 1,
                            }}
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setActiveMediaIndex((i) => (i + 1) % postMedia.length)}
                            style={{
                              position: "absolute",
                              top: "50%",
                              right: 8,
                              transform: "translateY(-50%)",
                              border: "1px solid var(--color-border)",
                              background: "rgba(9,13,22,0.7)",
                              color: "var(--color-cream)",
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              fontSize: 20,
                              lineHeight: 1,
                            }}
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {postMedia.length > 1 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                      {postMedia.map((item, idx) => (
                        <button
                          key={`${item.key}-${idx}`}
                          onClick={() => setActiveMediaIndex(idx)}
                          style={{
                            borderRadius: 8,
                            border: idx === activeMediaIndex ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                            background: "transparent",
                            color: "var(--color-muted)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            padding: "4px 8px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.type} {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isPublished && (
              <div style={{ marginTop: 12, border: "1px solid var(--color-border)", borderRadius: 14, padding: 12, background: "color-mix(in srgb, var(--color-elevated) 90%, transparent)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
                  {[
                    { label: "Impressions", value: latest?.impressions ?? 0 },
                    { label: "Likes", value: latest?.likes ?? 0 },
                    { label: "Reposts", value: latest?.retweets ?? 0 },
                    { label: "Replies", value: latest?.replies ?? 0 },
                    { label: "Quoted", value: latest?.quoted_count ?? 0 },
                    { label: "Bookmarks", value: latest?.bookmarks ?? 0 },
                  ].map((metric) => (
                    <div key={metric.label} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "8px 10px", background: "color-mix(in srgb, var(--color-ink) 18%, transparent)" }}>
                      <div style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{metric.label}</div>
                      <div style={{ marginTop: 4, fontSize: 21, color: "var(--color-cream)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmtBig(metric.value)}</div>
                    </div>
                  ))}
                </div>
                {metricsSeries.length > 1 && (
                  <div style={{ marginTop: 12, border: "1px solid var(--color-border)", borderRadius: 10, padding: 10, background: "color-mix(in srgb, var(--color-ink) 18%, transparent)" }}>
                    <div style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 6 }}>
                      Impression trend
                    </div>
                    <svg viewBox="0 0 300 70" style={{ width: "100%", height: 80 }}>
                      <path d={trendPath} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                  Last analytics snapshot: {latest ? fmtDateTime(latest.fetched_at) : "No snapshots yet"}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={onRefresh} style={detailButtonStyle(false)}>Reload</button>
              {isPublished && (
                <button onClick={onManualRefresh} disabled={!!busy[`refresh:${post.id}`]} style={detailButtonStyle(!!busy[`refresh:${post.id}`])}>
                  {busy[`refresh:${post.id}`] ? "Refreshing..." : "Refresh now"}
                </button>
              )}
              {isPublished && (
                <button onClick={onRepost} disabled={!!busy[`repost:${post.id}`]} style={detailButtonStyle(!!busy[`repost:${post.id}`])}>
                  {busy[`repost:${post.id}`] ? (hasActiveRepost ? "Undoing..." : "Reposting...") : (hasActiveRepost ? "Undo repost" : "Repost")}
                </button>
              )}
              {isPublished && (
                <button onClick={onOpenQuote} disabled={!!busy[`quote:${post.id}`]} style={detailButtonStyle(!!busy[`quote:${post.id}`])}>
                  {busy[`quote:${post.id}`] ? "Quoting..." : "Quote"}
                </button>
              )}
              {isScheduled && (
                <button onClick={onOpenEdit} disabled={!!busy[`edit:${post.id}`]} style={detailButtonStyle(!!busy[`edit:${post.id}`])}>
                  Edit content
                </button>
              )}
              {isScheduled && (
                <button onClick={onOpenReschedule} disabled={!!busy[`reschedule:${post.id}`]} style={detailButtonStyle(!!busy[`reschedule:${post.id}`])}>
                  Change time
                </button>
              )}
              <button
                onClick={onDelete}
                disabled={post.is_deleted || !!busy[`delete:${post.id}`]}
                style={{
                  ...detailButtonStyle(post.is_deleted || !!busy[`delete:${post.id}`]),
                  border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
                  color: "var(--color-danger)",
                }}
              >
                {busy[`delete:${post.id}`] ? "Deleting..." : "Delete"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
  };
}

function actionButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    background: "transparent",
    color: "var(--color-cream)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    padding: "7px 8px",
    opacity: disabled ? 0.45 : 1,
  };
}

function QuoteComposerModal({
  isClosing,
  sourceContent,
  text,
  media,
  scheduledFor,
  busy,
  onClose,
  onChangeText,
  onSubmit,
  onPickMedia,
  onRemoveMedia,
  onOpenSchedule,
  onClearSchedule,
}: {
  isClosing: boolean;
  sourceContent: string;
  text: string;
  media: QuoteDraftMedia | null;
  scheduledFor: string | null;
  busy: boolean;
  onClose: () => void;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onPickMedia: (file: File) => void;
  onRemoveMedia: () => void;
  onOpenSchedule: () => void;
  onClearSchedule: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 7, 18, 0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 20,
        animation: isClosing ? "quoteOverlayOut 0.18s ease forwards" : "quoteOverlayIn 0.18s ease both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          borderRadius: 20,
          border: "1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border))",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, #000), var(--color-surface))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.48)",
          overflow: "hidden",
          animation: isClosing ? "quotePanelOut 0.18s ease forwards" : "quotePanelIn 0.18s ease both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--color-cream)", fontSize: 24, lineHeight: 1 }}>×</button>
          <span style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Quote Post</span>
        </div>

        <div style={{ padding: 16 }}>
          <textarea
            value={text}
            placeholder="Add a comment"
            onChange={(e) => onChangeText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 90,
              resize: "vertical",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--color-cream)",
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              lineHeight: 1.2,
            }}
          />

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
              border: "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
              borderRadius: 999,
              padding: "6px 12px",
              color: "var(--color-accent)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
            }}
          >
            <span style={{ fontSize: 14 }}>🌐</span>
            Everyone can reply
          </div>

          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 14,
              overflow: "hidden",
              marginTop: 12,
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Quoted Post</div>
              <div style={{ marginTop: 6, color: "var(--color-cream)", fontSize: 20, lineHeight: 1.25 }}>{preview(sourceContent)}</div>
            </div>

            {media && (
              <div style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {media.uploading ? "Uploading media..." : media.file.name}
                  </span>
                  <button onClick={onRemoveMedia} style={{ border: "none", background: "transparent", color: "var(--color-danger)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Remove</button>
                </div>
                {media.file.type.startsWith("video/") ? (
                  <video src={media.previewUrl} controls style={{ width: "100%", maxHeight: 300, borderRadius: 10, background: "#000" }} />
                ) : (
                  <img src={media.previewUrl} alt={media.file.name} style={{ width: "100%", maxHeight: 300, borderRadius: 10, objectFit: "cover" }} />
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--color-border)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 999,
                padding: "7px 10px",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🖼 Media
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onPickMedia(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {[
              { label: "GIF", title: "GIF (coming soon)" },
              { label: "Poll", title: "Poll (coming soon)" },
              { label: "Emoji", title: "Emoji (coming soon)" },
              { label: "Tag", title: "Tag location (coming soon)" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.title}
                disabled
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 999,
                  padding: "7px 10px",
                  color: "var(--color-muted)",
                  background: "transparent",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  opacity: 0.8,
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenSchedule}
              style={{
                border: "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
                borderRadius: 999,
                padding: "7px 10px",
                color: "var(--color-accent)",
                background: "transparent",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              Schedule
            </button>
            {scheduledFor && (
              <button
                type="button"
                onClick={onClearSchedule}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 999,
                  padding: "7px 10px",
                  color: "var(--color-muted)",
                  background: "transparent",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            )}
            <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{text.length} / 280</span>
          </div>

          <button
            onClick={onSubmit}
            disabled={busy || !text.trim() || !!media?.uploading}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "10px 18px",
              background: busy ? "color-mix(in srgb, var(--color-accent) 45%, transparent)" : "var(--color-accent)",
              color: "#0A0C10",
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              opacity: busy || !text.trim() || !!media?.uploading ? 0.65 : 1,
            }}
          >
            {busy ? "Posting..." : scheduledFor ? "Schedule" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
