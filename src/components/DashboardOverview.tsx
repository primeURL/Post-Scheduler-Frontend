import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  FileText, 
  LayoutDashboard, 
  MoreVertical, 
  PenSquare, 
  Plus, 
  RefreshCcw, 
  Settings, 
  Share2, 
  ThumbsUp, 
  MessageSquare,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  UserPlus
} from "lucide-react";
import { api } from "../lib/api";
import type {
  ConnectedAccount,
  DownloadUrlResponse,
  Post,
  PostAnalyticsLatest,
} from "../lib/types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import PostDetailsModal from "./PostDetailsModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

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
      // ignore
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

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 space-y-10 selection:bg-[var(--color-primary)] selection:text-white">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { void actionEditContent(); }}>Edit</Button>
              <Button
                variant="destructive"
                onClick={() => { void actionDelete(); }}
                disabled={deleting || detailPost.is_deleted}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
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

      <motion.header 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-1">
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-[var(--color-accent)] font-mono text-sm uppercase tracking-widest">
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl font-extrabold font-sans text-[var(--color-cream)] tracking-tight">
            Dashboard
          </motion.h1>
          <motion.p variants={itemVariants} className="text-[var(--color-muted)] font-mono max-w-md">
            Insights and performance for your social schedule.
          </motion.p>
        </div>

        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void refreshAll()} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
          <Button size="lg" className="shadow-lg shadow-[var(--color-accent)]/20 font-bold px-6" asChild>
            <a href="/compose" className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Post
            </a>
          </Button>
        </motion.div>
      </motion.header>

      {state === "error" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 p-4 rounded-xl flex items-center gap-3 text-[var(--color-danger)]"
        >
          <AlertCircle className="w-5 h-5" />
          <span className="font-mono text-sm">{error}</span>
        </motion.div>
      )}

      {/* Primary Metrics */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <MetricCard 
          label="Total Posts" 
          value={fmtBig(stats.counts.total)} 
          description="Active across all platforms"
          icon={<FileText className="w-5 h-5 text-[var(--color-accent)]" />}
          accent="bg-[var(--color-accent)]"
        />
        <MetricCard 
          label="Published" 
          value={fmtBig(stats.counts.published)} 
          description="Successfully delivered"
          icon={<Share2 className="w-5 h-5 text-[var(--color-success)]" />}
          accent="bg-[var(--color-success)]"
        />
        <MetricCard 
          label="Scheduled" 
          value={fmtBig(stats.counts.scheduled)} 
          description="Queued for delivery"
          icon={<Calendar className="w-5 h-5 text-[var(--color-amber)]" />}
          accent="bg-[var(--color-amber)]"
        />
        <MetricCard 
          label="Engagement" 
          value={fmtBig(stats.engagement.impressions)} 
          description="Total impressions"
          icon={<BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />}
          accent="bg-[var(--color-primary)]"
        />
      </motion.div>

      {/* Detailed Engagement Grid */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <Card className="lg:col-span-2 border-none bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-ink)]/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Queue</CardTitle>
              <CardDescription>Your next scheduled broadcast moments</CardDescription>
            </div>
            <Badge variant="outline">{upcoming.length} Pending</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {state === "loading" ? (
              <div className="h-40 flex items-center justify-center text-[var(--color-muted)] font-mono animate-pulse">
                Loading schedule...
              </div>
            ) : upcoming.length === 0 ? (
              <div className="h-40 border-2 border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center gap-3 text-[var(--color-muted)] group hover:border-[var(--color-accent)]/50 transition-colors">
                <Calendar className="w-8 h-8 opacity-20 group-hover:opacity-100 transition-opacity" />
                <p className="font-mono text-sm">Silence in the air. Schedule something!</p>
              </div>
            ) : upcoming.map((post) => (
              <PostItem key={post.id} post={post} type="scheduled" onClick={() => void openDetail(post.id)} />
            ))}
          </CardContent>
          {upcoming.length > 0 && (
            <CardFooter>
              <Button variant="ghost" className="w-full gap-2 text-[var(--color-muted)] hover:text-[var(--color-accent)]" asChild>
                <a href="/calendar">
                  View Full Calendar <ChevronRight className="w-4 h-4" />
                </a>
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="border-none bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-ink)]/50">
          <CardHeader>
            <CardTitle>Recent Drafts</CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "loading" ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-16 w-full bg-[var(--color-border)]/50 rounded-lg animate-pulse" />)}
              </div>
            ) : recentDrafts.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-[var(--color-muted)]">
                <PenSquare className="w-6 h-6 opacity-20" />
                <p className="font-mono text-sm text-center">No drafts yet.<br/>Ready to create?</p>
              </div>
            ) : recentDrafts.map((post) => (
              <button
                key={post.id}
                onClick={() => void openDetail(post.id)}
                className="w-full text-left group flex flex-col gap-2 p-3 rounded-xl border border-transparent hover:border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/5 transition-all"
              >
                <div className="text-sm font-medium text-[var(--color-cream)] leading-snug group-hover:text-[var(--color-accent)] transition-colors">
                  {teaser(post.content, 120)}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-[var(--color-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated {fmtShortDate(post.updated_at)}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">Draft</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Engagement Summary & Accounts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 border-none bg-[color-mix(in_srgb,var(--color-elevated)_50%,transparent)]">
          <CardHeader>
            <CardTitle>Platform Engagement</CardTitle>
            <CardDescription>Latest audience interactions across your network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <EngagementStat label="Likes" value={stats.engagement.likes} icon={<ThumbsUp className="w-4 h-4" />} color="text-[var(--color-success)]" />
              <EngagementStat label="Reposts" value={stats.engagement.reposts} icon={<Share2 className="w-4 h-4" />} color="text-[var(--color-amber)]" />
              <EngagementStat label="Replies" value={stats.engagement.replies} icon={<MessageSquare className="w-4 h-4" />} color="text-[var(--color-accent)]" />
              <EngagementStat label="Reach" value={stats.engagement.impressions} icon={<BarChart3 className="w-4 h-4" />} color="text-[var(--color-cream)]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-[var(--color-accent)]/5 border-l-4 border-l-[var(--color-accent)] shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Accounts</CardTitle>
            <CardDescription>Connected profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <Button variant="outline" className="w-full gap-2 border-dashed border-[var(--color-border)]" asChild>
                <a href="/settings/accounts">
                  <UserPlus className="w-4 h-4" />
                  Connect
                </a>
              </Button>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-ink)]/50 border border-[var(--color-border)]/50">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-elevated)] flex items-center justify-center text-[var(--color-muted)] overflow-hidden border border-[var(--color-border)]">
                    {account.avatar_url ? (
                      <img src={account.avatar_url} alt={account.platform_username} className="w-full h-full object-cover" />
                    ) : (
                      <LayoutDashboard className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[var(--color-cream)] truncate truncate tracking-tight">
                      @{account.platform_username}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] font-mono uppercase">
                      {account.platform}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm" className="w-full text-[10px] text-[var(--color-accent)]" asChild>
              <a href="/settings/accounts">Manage Connections</a>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

function MetricCard({ label, value, description, icon, accent }: { label: string; value: string; description: string; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
      <div className={cn("absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity", accent)} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="uppercase tracking-[0.15em] text-[10px]">{label}</CardDescription>
          {icon}
        </div>
        <CardTitle className="text-3xl font-bold font-mono tracking-tighter text-[var(--color-cream)]">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] font-mono text-[var(--color-muted)]">{description}</p>
        <div className="mt-4 h-1 w-full bg-[var(--color-border)]/50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "65%" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full", accent)} 
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PostItem({ post, type, onClick }: { post: Post; type: "scheduled" | "published"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl bg-[var(--color-ink)]/20 border border-[var(--color-border)]/50 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/[0.03] active:scale-[0.99] transition-all group"
    >
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold text-[var(--color-cream)] line-clamp-1 group-hover:text-[var(--color-accent)] transition-colors">
          {post.content}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-[var(--color-muted)]">
          <span className="flex items-center gap-1 uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            {type === "scheduled" ? "Deliver at" : "Sent"} {fmtShortDate(type === "scheduled" ? post.scheduled_for : post.published_at)}
          </span>
          {post.platform && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--color-elevated)] text-[var(--color-muted)] uppercase">
              {post.platform}
            </span>
          )}
        </div>
      </div>
      <Badge 
        variant={type === "scheduled" ? "amber" : "success"}
        className="opacity-80 group-hover:opacity-100"
      >
        {type}
      </Badge>
    </button>
  );
}

function EngagementStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--color-muted)] uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-bold font-mono tracking-tight", color)}>
        {fmtBig(value)}
      </div>
    </div>
  );
}
