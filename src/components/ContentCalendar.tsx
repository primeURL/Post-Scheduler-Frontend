import { useState, useEffect, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { DownloadUrlResponse, Post, PostAnalytics, PostStatus } from "../lib/types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import PostDetailsModal from "./PostDetailsModal";
import SchedulePickerModal from "./SchedulePickerModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLOR: Record<PostStatus, string> = {
  draft:      "var(--color-muted)",
  scheduled:  "var(--color-accent)",
  publishing: "var(--color-amber)",
  published:  "var(--color-success)",
  failed:     "var(--color-danger)",
};

const STATUS_BG: Record<PostStatus, string> = {
  draft:      "color-mix(in srgb, var(--color-muted) 15%, transparent)",
  scheduled:  "color-mix(in srgb, var(--color-accent) 15%, transparent)",
  publishing: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
  published:  "color-mix(in srgb, var(--color-success) 15%, transparent)",
  failed:     "color-mix(in srgb, var(--color-danger) 15%, transparent)",
};

// Statuses that can be deleted
const DELETABLE: PostStatus[] = ["draft", "scheduled", "failed"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

/** Returns the date a post should appear on the calendar */
function calendarDate(post: Post): Date | null {
  const iso = post.scheduled_for ?? post.published_at ?? post.created_at;
  return iso ? new Date(iso) : null;
}

function fmt12(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── NavButton ────────────────────────────────────────────────────────────────

function NavBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: hov ? "var(--color-elevated)" : "transparent",
        border: `1px solid ${hov ? "var(--color-border)" : "transparent"}`,
        color: hov ? "var(--color-cream)" : "var(--color-muted)",
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

// ─── DayCell ──────────────────────────────────────────────────────────────────

function DayCell({
  day,
  posts,
  isToday,
  isSelected,
  faded,
  onClick,
}: {
  day: number | null;
  posts: Post[];
  isToday: boolean;
  isSelected: boolean;
  faded: boolean;
  onClick: () => void;
}) {
  if (day === null) {
    return (
      <div
        style={{
          minHeight: 88,
          borderRadius: 10,
          background: "transparent",
          border: "1px solid transparent",
        }}
      />
    );
  }

  const visible = posts.slice(0, 3);
  const overflow = posts.length - 3;

  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 88,
        padding: "8px 8px 6px",
        borderRadius: 10,
        background: isSelected
          ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
          : "var(--color-elevated)",
        border: `1px solid ${
          isSelected
            ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
            : isToday
            ? "color-mix(in srgb, var(--color-accent) 22%, transparent)"
            : "var(--color-border)"
        }`,
        cursor: "pointer",
        textAlign: "left",
        opacity: faded ? 0.38 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        transition: "border-color 0.12s ease, background 0.12s ease",
      }}
    >
      {/* Day number */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            fontWeight: isToday ? 600 : 400,
            color: isToday ? "var(--color-ink)" : "var(--color-cream)",
            background: isToday ? "var(--color-accent)" : "transparent",
            flexShrink: 0,
          }}
        >
          {day}
        </span>
        {overflow > 0 && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted)",
            }}
          >
            +{overflow}
          </span>
        )}
      </div>

      {/* Post chips */}
      {visible.map((post) => (
        <div
          key={post.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 5px",
            borderRadius: 4,
            background: STATUS_BG[post.status],
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: STATUS_COLOR[post.status],
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--color-cream)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {post.content.slice(0, 22)}
          </span>
        </div>
      ))}
    </button>
  );
}

// ─── PostCard (side panel) ────────────────────────────────────────────────────

function PostCard({
  post,
  onDelete,
  onOpen,
}: {
  post: Post;
  onDelete: (post: Post) => void;
  onOpen: (post: Post) => void;
}) {
  const [hoverDel, setHoverDel] = useState(false);

  const dateIso = post.scheduled_for ?? post.published_at ?? null;

  const handleDelete = () => onDelete(post);

  return (
    <div
      onClick={() => onOpen(post)}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--color-elevated)",
        border: "1px solid var(--color-border)",
        marginBottom: 8,
        animation: "var(--animate-fade-up)",
        cursor: "pointer",
      }}
    >
      {/* Status + time + delete row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: STATUS_COLOR[post.status],
              background: STATUS_BG[post.status],
              padding: "2px 6px",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            {post.status}
          </span>
          {dateIso && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted)",
              }}
            >
              {fmt12(dateIso)}
            </span>
          )}
        </div>

        {DELETABLE.includes(post.status) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            onMouseEnter={() => setHoverDel(true)}
            onMouseLeave={() => setHoverDel(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: hoverDel ? "var(--color-danger)" : "var(--color-muted)",
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "color 0.12s",
            }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 14 14">
              <path
                d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l.75 7a1 1 0 001 .9h4.5a1 1 0 001-.9L11 4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <p
        style={{
          fontSize: 13,
          fontFamily: "var(--font-sans)",
          color: "var(--color-cream)",
          lineHeight: 1.55,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.content}
      </p>

      {/* Thread badge */}
      {post.thread_id && post.thread_order && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10">
            <path
              d="M2 2v4a1 1 0 001 1h3M6 5.5l1 1.5-1 1.5"
              stroke="var(--color-muted)"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted)",
            }}
          >
            thread · tweet {post.thread_order}
          </span>
        </div>
      )}

      {/* Error message on failed */}
      {post.status === "failed" && post.error_message && (
        <p
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-danger)",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          {post.error_message}
        </p>
      )}
    </div>
  );
}

// ─── ContentCalendar ──────────────────────────────────────────────────────────

export default function ContentCalendar() {
  useStore($user); // subscribe for re-render on auth changes

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailQuoteSourcePost, setDetailQuoteSourcePost] = useState<Post | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<PostAnalytics[]>([]);
  const [detailMediaUrls, setDetailMediaUrls] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActiveMediaIndex, setDetailActiveMediaIndex] = useState(0);
  const [scheduleTargetPostId, setScheduleTargetPostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Post[]>("/posts?limit=500");
      setPosts(data);
    } catch {
      // silent — auth errors handled by api.ts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Month navigation
  const goToPrev = () => {
    setSelectedDay(null);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goToNext = () => {
    setSelectedDay(null);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Build grid cells: null for padding, number for day
  const firstDay = firstWeekday(year, month);
  const numDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Index posts by day-of-month for this year/month
  const postsByDay = new Map<number, Post[]>();
  for (const post of posts) {
    const d = calendarDate(post);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    const bucket = postsByDay.get(day) ?? [];
    bucket.push(post);
    postsByDay.set(day, bucket);
  }

  const isCurrentMonth =
    month === today.getMonth() && year === today.getFullYear();

  const selectedPosts = selectedDay
    ? (postsByDay.get(selectedDay) ?? []).sort((a, b) => {
        const ta = calendarDate(a)?.getTime() ?? 0;
        const tb = calendarDate(b)?.getTime() ?? 0;
        return ta - tb;
      })
    : [];

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${deleteTarget.id}`);
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteError(null);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = async (postId: string) => {
    setDetailPostId(postId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [postData, analyticsData] = await Promise.all([
        api.get<Post>(`/posts/${postId}?include_deleted=true`),
        api.get<PostAnalytics[]>(`/analytics/posts/${postId}`).catch(() => []),
      ]);
      const signedEntries = await Promise.all(
        (postData.media ?? [])
          .filter((m) => !!m.key)
          .map(async (m) => {
            const res = await api.get<DownloadUrlResponse>(`/storage/download-url?file_key=${encodeURIComponent(m.key)}`);
            return [m.key, res.download_url] as const;
          })
      );

      setDetailPost(postData);
      setDetailAnalytics(analyticsData);
      setDetailMediaUrls(Object.fromEntries(signedEntries));
      setDetailActiveMediaIndex(0);
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

  const closeDetail = () => {
    setDetailPostId(null);
    setDetailPost(null);
    setDetailQuoteSourcePost(null);
    setDetailAnalytics([]);
    setDetailMediaUrls({});
    setDetailError(null);
  };

  const detailLatest = detailAnalytics[detailAnalytics.length - 1] ?? null;

  const refreshDetail = async () => {
    if (!detailPostId) return;
    await openDetail(detailPostId);
  };

  const actionRepost = async () => {
    if (!detailPost) return;
    await api.post(`/posts/${detailPost.id}/repost`, {});
    await refreshDetail();
    await fetchPosts();
  };

  const actionRefreshAnalytics = async () => {
    if (!detailPost) return;
    await api.post(`/analytics/posts/${detailPost.id}/refresh`, {});
    await refreshDetail();
    await fetchPosts();
  };

  const actionQuote = async () => {
    if (!detailPost) return;
    const sourcePost = detailPost;
    closeDetail();
    const text = window.prompt("Quote text:");
    if (!text || !text.trim()) return;
    await api.post(`/posts/${sourcePost.id}/quote`, { content: text.trim(), scheduled_for: null, media: null });
    await refreshDetail();
    await fetchPosts();
  };

  const actionEditContent = async () => {
    if (!detailPost) return;
    window.location.href = `/compose?edit_post_id=${encodeURIComponent(detailPost.id)}`;
  };

  const actionDeleteFromDetail = async () => {
    if (!detailPost) return;
    setDeleteError(null);
    setDeleteTarget(detailPost);
  };

  const openPostFromCalendar = (post: Post) => {
    if (post.status === "draft" && !post.is_deleted) {
      window.location.href = `/compose?draft_post_id=${encodeURIComponent(post.id)}`;
      return;
    }
    void openDetail(post.id);
  };

  // Compose link — pre-fill date if a day is selected
  const composeDateParam =
    selectedDay != null
      ? `?date=${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
      : "";

  return (
    <div
      className="w-full max-w-5xl mx-auto px-4 py-8"
      style={{ animation: "var(--animate-fade-up)" }}
    >
      {scheduleTargetPostId && (
        <SchedulePickerModal
          initialISO={detailPost?.scheduled_for ?? null}
          onClose={() => setScheduleTargetPostId(null)}
          onConfirm={async (localIso) => {
            await api.patch(`/posts/${scheduleTargetPostId}`, {
              scheduled_for: new Date(localIso).toISOString(),
            });
            setScheduleTargetPostId(null);
            await refreshDetail();
            await fetchPosts();
          }}
        />
      )}

      <PostDetailsModal
        isOpen={!!detailPostId}
        onClose={closeDetail}
        post={detailPost}
        loading={detailLoading}
        error={detailError}
        mediaUrls={detailMediaUrls}
        activeMediaIndex={detailActiveMediaIndex}
        onActiveMediaIndexChange={setDetailActiveMediaIndex}
        quoteSourceContent={detailQuoteSourcePost?.content ?? null}
        actions={
          <>
            {detailPost?.status === "published" && !detailPost.is_deleted && <button onClick={() => { void actionRefreshAnalytics(); }} style={calendarDetailButton(false)}>Refresh now</button>}
            {detailPost?.status === "published" && !detailPost.is_deleted && <button onClick={() => { void actionRepost(); }} style={calendarDetailButton(false)}>{detailPost.reposted_at ? "Undo repost" : "Repost"}</button>}
            {detailPost?.status === "published" && !detailPost.is_deleted && <button onClick={() => { void actionQuote(); }} style={calendarDetailButton(false)}>Quote</button>}
            {(detailPost?.status === "draft" || detailPost?.status === "scheduled") && !detailPost?.is_deleted && (
              <button onClick={() => { void actionEditContent(); }} style={calendarDetailButton(false)}>Edit</button>
            )}
            {(detailPost?.status === "draft" || detailPost?.status === "scheduled") && !detailPost?.is_deleted && (
              <button
                onClick={() => { void actionDeleteFromDetail(); }}
                style={{
                  ...calendarDetailButton(detailPost.is_deleted),
                  border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
                  color: "var(--color-danger)",
                }}
              >
                Delete
              </button>
            )}
          </>
        }
      >
        {detailPost?.status === "published" && !detailPost.is_deleted && (
          <div style={{ marginTop: 12, border: "1px solid var(--color-border)", borderRadius: 14, padding: 12, background: "color-mix(in srgb, var(--color-elevated) 90%, transparent)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
              {[
                { label: "Impressions", value: detailLatest?.impressions ?? 0 },
                { label: "Likes", value: detailLatest?.likes ?? 0 },
                { label: "Reposts", value: detailLatest?.retweets ?? 0 },
                { label: "Replies", value: detailLatest?.replies ?? 0 },
                { label: "Quoted", value: detailLatest?.quoted_count ?? 0 },
                { label: "Bookmarks", value: detailLatest?.bookmarks ?? 0 },
              ].map((metric) => (
                <div key={metric.label} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "8px 10px", background: "color-mix(in srgb, var(--color-ink) 18%, transparent)" }}>
                  <div style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{metric.label}</div>
                  <div style={{ marginTop: 4, fontSize: 21, color: "var(--color-cream)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{metric.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PostDetailsModal>

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

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
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
          Content Calendar
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                background: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-muted)",
                padding: "4px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Today
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NavBtn onClick={goToPrev} label="Previous month">
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                <path
                  d="M9 3L5 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </NavBtn>

            <span
              style={{
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                color: "var(--color-cream)",
                minWidth: 136,
                textAlign: "center",
              }}
            >
              {MONTHS[month]} {year}
            </span>

            <NavBtn onClick={goToNext} label="Next month">
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </NavBtn>
          </div>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        {(Object.entries(STATUS_COLOR) as [PostStatus, string][]).map(
          ([status, color]) => (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                  textTransform: "capitalize",
                }}
              >
                {status}
              </span>
            </div>
          )
        )}
      </div>

      {/* ── Grid + Panel ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gap: 16,
          alignItems: "flex-start",
          gridTemplateColumns:
            selectedDay != null
              ? "minmax(0, 1fr) minmax(240px, 272px)"
              : "minmax(0, 1fr)",
        }}
      >
        {/* Calendar grid */}
        <div style={{ minWidth: 0 }}>
          {/* Weekday labels */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              marginBottom: 6,
            }}
          >
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted)",
                  padding: "4px 0",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: 64,
                color: "var(--color-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              Loading calendar…
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}
            >
              {cells.map((day, idx) => (
                <DayCell
                  key={idx}
                  day={day}
                  posts={day != null ? (postsByDay.get(day) ?? []) : []}
                  isToday={
                    day != null &&
                    isCurrentMonth &&
                    day === today.getDate()
                  }
                  isSelected={day === selectedDay}
                  faded={day === null}
                  onClick={() => {
                    if (day == null) return;
                    setSelectedDay((prev) => (prev === day ? null : day));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        {selectedDay != null && (
          <div
            style={{
              width: "100%",
              maxWidth: 272,
              animation: "var(--animate-fade-up)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--color-cream)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {MONTHS[month]} {selectedDay}
              </h2>

              <a
                href={`/compose${composeDateParam}`}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent)",
                  background:
                    "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  padding: "3px 9px",
                  borderRadius: 6,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg width="10" height="10" fill="none" viewBox="0 0 10 10">
                  <path
                    d="M5 2v6M2 5h6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                New post
              </a>
            </div>

            {selectedPosts.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  borderRadius: 12,
                  background: "var(--color-elevated)",
                  border: "1px solid var(--color-border)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    margin: 0,
                  }}
                >
                  Nothing scheduled.
                </p>
              </div>
            ) : (
              selectedPosts.map((post) => (
                <PostCard key={post.id} post={post} onDelete={setDeleteTarget} onOpen={openPostFromCalendar} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function calendarDetailButton(disabled: boolean): React.CSSProperties {
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
