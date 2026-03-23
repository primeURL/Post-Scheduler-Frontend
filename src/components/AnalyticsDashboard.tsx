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
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import SchedulePickerModal from "./SchedulePickerModal";
import PostDetailsModal from "./PostDetailsModal";
import {
  BarChart3,
  TrendingUp,
  RefreshCcw,
  Trash2,
  Edit2,
  Share2,
  Repeat,
  Quote as QuoteIcon,
  Clock as ClockIcon,
  ChevronRight,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";

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

function pickThumbnailUrl(post: Post): string | null {
  const media = post.media ?? [];
  const firstImage = media.find((item) => {
    const contentType = (item.content_type ?? "").toLowerCase();
    const mediaType = (item.type ?? "").toLowerCase();
    return contentType.startsWith("image/") || mediaType === "image" || mediaType === "gif";
  });
  return firstImage?.public_url ?? null;
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
  const [activeFilter, setActiveFilter] = useState<AnalyticsFilter>("published");
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [menuOpenUpward, setMenuOpenUpward] = useState(false);

  useEffect(() => {
    if (!activeMenuPostId) return;
    const handleGlobalClick = () => setActiveMenuPostId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [activeMenuPostId]);
  const [quoteComposer, setQuoteComposer] = useState<QuoteComposerState | null>(null);
  const [quoteComposerClosing, setQuoteComposerClosing] = useState(false);
  const [showQuoteSchedulePicker, setShowQuoteSchedulePicker] = useState(false);
  const [editComposer, setEditComposer] = useState<EditComposerState | null>(null);
  const [scheduleEditorPostId, setScheduleEditorPostId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailQuoteSourcePost, setDetailQuoteSourcePost] = useState<Post | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<PostAnalytics[]>([]);
  const [detailMediaUrls, setDetailMediaUrls] = useState<Record<string, string>>({});
  const [thumbByPostId, setThumbByPostId] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldowns((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key in next) {
          if (next[key] > 0) {
            next[key] -= 1;
            changed = true;
          } else {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const tabCounts = useMemo(() => {
    const counts = { all: 0, published: 0, draft: 0, deleted: 0, scheduled: 0 };
    for (const row of rows) {
      counts.all++;
      if (row.is_deleted) { counts.deleted++; }
      else if (row.status === "published") { counts.published++; }
      else if (row.status === "draft") { counts.draft++; }
      else if (row.status === "scheduled") { counts.scheduled++; }
    }
    return counts;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, posts] = await Promise.all([
        api.get<PostAnalyticsLatest[]>("/analytics/posts?include_deleted=true"),
        api.get<Post[]>("/posts?limit=500&include_deleted=true"),
      ]);
      setRows(data);

      const nextThumbs: Record<string, string> = {};
      for (const post of posts) {
        const thumb = pickThumbnailUrl(post);
        if (thumb) {
          nextThumbs[post.id] = thumb;
        }
      }
      setThumbByPostId(nextThumbs);
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
      throw e;
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const deletePost = async (postId: string) => {
    const key = `delete:${postId}`;
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      await api.delete(`/posts/${postId}`);
      await load();
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deletePost(deleteConfirm.postId);
      setDeleteError(null);
      setDeleteConfirm(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
    }
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
    try {
      await withBusy(`refresh:${postId}`, async () => {
        await api.post(`/analytics/posts/${postId}/refresh`, {});
        await load();
      });
    } catch (e: any) {
      if (e?.response?.status === 429 || e?.message?.includes("Try again in")) {
        const match = e.message.match(/Try again in (\d+)/);
        if (match) {
          const seconds = parseInt(match[1], 10);
          setCooldowns((prev) => ({ ...prev, [postId]: seconds }));
          setError(null); // Clear global error so it doesn't block the feed
          return;
        }
      }
      setError(e instanceof Error ? e.message : "An error occurred.");
    }
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
    <div className="w-full max-w-6xl mx-auto h-full min-h-0 flex flex-col px-4 py-2" style={{ animation: "var(--animate-fade-up)" }}>
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
        <ConfirmDeleteModal
          open={!!deleteConfirm}
          busy={!!busy[`delete:${deleteConfirm.postId}`]}
          previewText={preview(deleteConfirm.content)}
          errorMessage={deleteError}
          onCancel={() => {
            setDeleteConfirm(null);
            setDeleteError(null);
          }}
          onConfirm={() => {
            void confirmDelete();
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
            setDeleteError(null);
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
          cooldown={detailPost ? cooldowns[detailPost.id] : 0}
        />
      )}


      {/* 4 Metrics Cards - Rearranged to be first and smaller */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Impressions", value: totals.impressions, accent: "var(--color-accent)", icon: BarChart3 },
          { label: "Community", value: totals.likes, accent: "var(--color-success)", icon: Zap },
          { label: "Circulation", value: totals.reposts, accent: "var(--color-amber)", icon: Repeat },
          { label: "Engagement", value: totals.replies, accent: "var(--color-muted)", icon: Share2 },
        ].map((item, i) => (
          <Card key={item.label} className="bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-ink)] border-white/[0.02] shadow-lg overflow-hidden group">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="p-1.5 rounded-lg bg-white/5 text-[var(--color-muted)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)] transition-colors duration-500">
                  <item.icon className="w-4 h-4" />
                </div>
                <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest border-white/5 opacity-30 px-1 py-0 h-3">Global</Badge>
              </div>
              
              <div className="space-y-0.5">
                <div className="text-xl font-black text-[var(--color-cream)] font-mono tracking-tighter group-hover:translate-x-0.5 transition-transform duration-500">
                  {fmtBig(item.value)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted)] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: item.accent }}></span>
                  {item.label}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs - Now below metrics */}
      <div className="flex flex-wrap items-center gap-2 mb-8 p-1.5 bg-[#0A0E14]/40 backdrop-blur-md rounded-2xl border border-white/5 w-fit">
        {[
          { key: "published", label: "Published", icon: CheckCircle2 },
          { key: "scheduled", label: "Scheduled", icon: ClockIcon },
          { key: "draft", label: "Drafts", icon: Edit2 },
          { key: "deleted", label: "Deleted", icon: Trash2 },
          { key: "all", label: "All Assets", icon: BarChart3 },
        ].map((item) => {
          const selected = activeFilter === item.key;
          const count = tabCounts[item.key as keyof typeof tabCounts];
          return (
            <Button
              key={item.key}
              variant={selected ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter(item.key as AnalyticsFilter)}
              className={cn(
                "rounded-xl h-8 px-3.5 text-xs font-bold transition-all duration-300 gap-2",
                selected ? "shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.15)] bg-[var(--color-elevated)]" : "text-[var(--color-muted)] hover:text-[var(--color-cream)]"
              )}
            >
              <item.icon className={cn("w-3 h-3", selected ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]")} />
              {item.label}
              <Badge variant="outline" className={cn(
                "ml-1 font-mono text-[9px] px-1 py-0 border-white/5",
                selected ? "bg-white/5 text-white" : "text-[var(--color-muted)] opacity-50"
              )}>
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>



      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-32">

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 48 }}>
          <div style={{ width: 20, height: 20, borderRadius: 999, border: "2px solid var(--color-border)", borderTopColor: "var(--color-accent)", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading analytics...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)", background: "color-mix(in srgb, var(--color-danger) 8%, transparent)", color: "var(--color-danger)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>⚠</span> {error}
        </div>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div className="analytics-empty-state" style={{ border: "1px solid var(--color-border)", borderRadius: 20, background: "var(--color-elevated)" }}>
          <span className="empty-icon">📊</span>
          <div style={{ color: "var(--color-cream)", fontSize: 16, fontWeight: 600 }}>No posts found</div>
          <div style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {activeFilter === "published" ? "No published posts yet. Start composing!" : `No ${activeFilter} posts to display.`}
          </div>
        </div>
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--color-accent) 15%, var(--color-border))",
            borderRadius: 20,
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 4%, var(--color-elevated)) 0%, var(--color-elevated) 100%)",
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.4fr 1fr 1fr 1fr 0.7fr",
              gap: 12,
              padding: "14px 20px",
              borderBottom: "1px solid var(--color-border)",
              background: "color-mix(in srgb, var(--color-ink) 25%, transparent)",
            }}
          >
            {[
              "Post Content",
              "Status",
              "Impressions",
              "Engagement",
              "",
            ].map((head) => (
              <span
                key={head || "action"}
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
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
            const thumb = thumbByPostId[row.post_id] ?? null;

            const statusClass = row.is_deleted ? "deleted" : row.status;

            return (
              <div
                key={row.post_id}
                className={cn(
                  "grid items-center hover:bg-[var(--color-accent)]/[0.03] transition-colors cursor-pointer",
                  idx !== filteredRows.length - 1 && "border-b border-white/[0.04]"
                )}
                onClick={() => {
                  if (row.status === "draft" && !row.is_deleted) {
                    window.location.href = `/compose?draft_post_id=${encodeURIComponent(row.post_id)}`;
                    return;
                  }
                  void openPostDetail(row.post_id);
                }}
                style={{
                  gridTemplateColumns: "2.4fr 1fr 1fr 1fr 0.7fr",
                  gap: 12,
                  padding: "14px 20px",
                  animationDelay: `${idx * 0.04}s`,
                  zIndex: activeMenuPostId === row.post_id ? 50 : 1,
                  position: "relative",
                  animationName: "slideInRow",
                  animationDuration: "0.3s",
                  animationFillMode: "both"
                }}
              >
                <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
                  <div
                    className="post-card-avatar"
                    style={{
                      background:
                        "linear-gradient(140deg, color-mix(in srgb, var(--color-accent) 80%, transparent), color-mix(in srgb, var(--color-amber) 70%, transparent))",
                    }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="Post media preview"
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                      />
                    ) : (
                      initials(row.content)
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "var(--color-cream)",
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preview(row.content)}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: "var(--color-muted)",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
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
                            gap: 3,
                            borderRadius: 999,
                            border: "1px solid color-mix(in srgb, var(--color-success) 35%, transparent)",
                            background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
                            color: "var(--color-success)",
                            padding: "1px 6px",
                            fontSize: 9,
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
                            gap: 3,
                            borderRadius: 999,
                            border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
                            background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                            color: "var(--color-accent)",
                            padding: "1px 6px",
                            fontSize: 9,
                          }}
                        >
                          💬 quoted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <span className={`post-status-badge post-status-badge--${statusClass}`}>
                    {row.is_deleted ? "Deleted" : row.status}
                  </span>
                </div>

                <div>
                  {hidePerformance ? (
                    <div style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 16 }}>—</div>
                  ) : (
                    <>
                      <div style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 20, lineHeight: 1 }}>
                        {fmtBig(row.impression_count)}
                      </div>
                      <div style={{ marginTop: 3, color: "var(--color-success)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                        {engagementRate(row)} rate
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--color-cream)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
                  {hidePerformance ? (
                    <span style={{ color: "var(--color-muted)", fontSize: 16 }}>—</span>
                  ) : (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 14, opacity: 0.8, color: "var(--color-danger)" }}>♥</span>
                        {fmtBig(row.like_count)}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 13, opacity: 0.8 }}>💬</span>
                        {fmtBig(row.reply_count)}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ justifySelf: "end", position: "relative" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeMenuPostId === row.post_id) {
                        setActiveMenuPostId(null);
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setMenuOpenUpward(spaceBelow < 250);
                        setActiveMenuPostId(row.post_id);
                      }
                    }}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-elevated)",
                      color: "var(--color-cream)",
                      fontSize: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                    aria-label="Open actions"
                  >
                    ⋯
                  </button>

                  {activeMenuPostId === row.post_id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`analytics-action-menu${menuOpenUpward ? " analytics-action-menu--upward" : ""}`}
                    >
                      {canPublishedAction(row) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cooldowns[row.post_id]) return;
                            setActiveMenuPostId(null);
                            void refreshPost(row.post_id);
                          }}
                          disabled={busyRefresh || !!cooldowns[row.post_id]}
                          className="analytics-action-btn"
                          style={{ opacity: cooldowns[row.post_id] ? 0.6 : 1, whiteSpace: "nowrap" }}
                        >
                          <RefreshCcw size={14} className={cn("flex-shrink-0", busyRefresh && "animate-spin")} />
                          <span>{busyRefresh ? "Reloading..." : cooldowns[row.post_id] ? `Wait ${cooldowns[row.post_id]}s` : "Reload"}</span>
                        </button>
                      )}
                      {canPublishedAction(row) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPostId(null);
                            void repostPost(row.post_id);
                          }}
                          disabled={busyRepost}
                          className="analytics-action-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <Repeat size={14} className={cn("flex-shrink-0", busyRepost && "animate-pulse")} />
                          <span>{busyRepost ? (row.has_repost_action ? "Undoing..." : "Reposting...") : (row.has_repost_action ? "Undo repost" : "Repost")}</span>
                        </button>
                      )}
                      {canPublishedAction(row) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPostId(null);
                            setQuoteComposer({ postId: row.post_id, sourceContent: row.content, text: "", scheduledFor: null, media: null });
                            setQuoteComposerClosing(false);
                          }}
                          disabled={busyQuote}
                          className="analytics-action-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <QuoteIcon size={14} className="flex-shrink-0" />
                          <span>{busyQuote ? "Quoting..." : "Quote"}</span>
                        </button>
                      )}
                      {canScheduledCrud(row) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPostId(null);
                            openComposeEditor(row.post_id);
                          }}
                          disabled={busyEdit}
                          className="analytics-action-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <Edit2 size={14} className="flex-shrink-0" />
                          <span>{busyEdit ? "Saving..." : "Edit content"}</span>
                        </button>
                      )}
                      {canScheduledCrud(row) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPostId(null);
                            setScheduleEditorPostId(row.post_id);
                          }}
                          disabled={busyReschedule}
                          className="analytics-action-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <ClockIcon size={14} className="flex-shrink-0" />
                          <span>{busyReschedule ? "Saving..." : "Change time"}</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuPostId(null);
                          setDeleteError(null);
                          setDeleteConfirm({ postId: row.post_id, content: row.content });
                        }}
                        disabled={row.is_deleted || busyDelete}
                        className="analytics-action-btn analytics-action-btn--danger"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <Trash2 size={14} className="flex-shrink-0" />
                        <span>{busyDelete ? "Deleting..." : "Delete"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="analytics-footer-note">
        <span style={{ fontSize: 14 }}>ℹ</span>
        Analytics snapshots are saved by the backend cron job every 6 hours to reduce read API usage.
      </div>
      </div>
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
  cooldown = 0,
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
  cooldown?: number;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const latest = analytics[analytics.length - 1] ?? null;
  const metricsSeries = analytics.map((item) => item.impressions);
  const isPublished = !!post && post.status === "published" && !post.is_deleted;
  const hasActiveRepost = !!post?.reposted_at;

  const trendPath = (() => {
    if (metricsSeries.length < 2) return "";
    const width = 300;
    const height = 60;
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

  const actions = post && !post.is_deleted && (
    <div className="flex items-center gap-2">
      {isPublished && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onManualRefresh}
            disabled={!!busy[`refresh:${post.id}`] || cooldown > 0}
            className="rounded-xl font-bold gap-2 min-w-[120px]"
          >
             {busy[`refresh:${post.id}`] ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            {cooldown > 0 ? `Wait ${cooldown}s` : "Reload"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRepost}
            disabled={!!busy[`repost:${post.id}`]}
            className={cn(
              "rounded-xl gap-2",
              hasActiveRepost ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10" : ""
            )}
          >
            <Repeat className="w-4 h-4" />
            {hasActiveRepost ? "Reposted" : "Repost"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenQuote}
            className="rounded-xl gap-2 text-[var(--color-amber)] hover:bg-[var(--color-amber)]/10"
          >
            <QuoteIcon className="w-4 h-4" />
            Quote
          </Button>
        </>
      )}

      {(post.status === "draft" || post.status === "scheduled") && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenEdit}
          className="rounded-xl gap-2"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="rounded-xl gap-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 ml-auto"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </Button>
    </div>
  );

  return (
    <PostDetailsModal
      isOpen
      onClose={onClose}
      loading={loading}
      error={error}
      post={post}
      quoteSourceContent={quoteSourcePost?.content}
      mediaUrls={mediaUrls}
      activeMediaIndex={activeMediaIndex}
      onActiveMediaIndexChange={setActiveMediaIndex}
      actions={actions}
      maxWidth="840px"
    >
      {isPublished && (
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-muted)]">Live Metrics Intel</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-6 text-[9px] uppercase tracking-widest gap-1.5 opacity-50 hover:opacity-100">
              <RefreshCcw className="w-3 h-3" /> Reload Cache
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Impressions", value: latest?.impressions ?? 0, icon: BarChart3 },
              { label: "Likes", value: latest?.likes ?? 0, icon: Zap },
              { label: "Reposts", value: latest?.retweets ?? 0, icon: Repeat },
              { label: "Replies", value: latest?.replies ?? 0, icon: Share2 },
              { label: "Quoted", value: latest?.quoted_count ?? 0, icon: QuoteIcon },
              { label: "Bookmarks", value: latest?.bookmarks ?? 0, icon: Share2 },
            ].map((metric) => (
              <Card key={metric.label} className="bg-[var(--color-ink)]/20 border-white/5 backdrop-blur-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between opacity-40">
                    <span className="text-[8px] font-mono uppercase tracking-widest">{metric.label}</span>
                    <metric.icon className="w-2.5 h-2.5" />
                  </div>
                  <div className="text-xl font-black text-[var(--color-cream)] font-mono tracking-tighter">
                    {fmtBig(metric.value)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {metricsSeries.length > 1 && (
            <Card className="bg-[var(--color-ink)]/20 border-white/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--color-muted)]">Impression Velocity</div>
                  <div className="px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[8px] font-black uppercase tracking-widest animate-pulse">
                    Live Link Active
                  </div>
                </div>
                <div className="relative h-20 w-full overflow-hidden">
                  <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="w-full h-full drop-shadow-[0_0_15px_rgba(139,151,255,0.3)]">
                    <defs>
                      <linearGradient id="grad-intel" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${trendPath} L 300,60 L 0,60 Z`} fill="url(#grad-intel)" />
                    <path d={trendPath} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 pt-2 text-[10px] font-mono text-[var(--color-muted)] opacity-50">
            <ClockIcon className="w-3 h-3" />
            INTEL LAST SYNCED: {latest ? fmtDateTime(latest.fetched_at) : "NOT YET SCANNED"}
          </div>
        </div>
      )}
    </PostDetailsModal>
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
