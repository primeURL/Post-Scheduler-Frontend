import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { Post, PostStatus } from "../lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  LayoutGrid, 
  LayoutList,
  ChevronRight as ChevronRightIcon,
  Zap,
  Twitter,
  Search,
  Filter,
  Trash2,
  Edit2
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import PostDetailsModal from "./PostDetailsModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_VARIANTS: Record<PostStatus, any> = {
  draft:      "secondary",
  scheduled:  "default",
  publishing: "amber",
  published:  "success",
  failed:     "destructive",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function calendarDate(post: Post): Date | null {
  const iso = post.scheduled_for ?? post.published_at ?? post.created_at;
  return iso ? new Date(iso) : null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ContentCalendar() {
  const user = useStore($user);
  const today = useMemo(() => new Date(), []);
  
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date()); // Default to today
  
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActiveMediaIndex, setDetailActiveMediaIndex] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Post[]>("/posts?limit=500");
      setPosts(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePrev = () => {
    if (view === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const postsByDateMap = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach(p => {
      const d = calendarDate(p);
      if (!d) return;
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [posts]);

  const selectedPosts = useMemo(() => {
    if (!selectedDay) return [];
    const list = postsByDateMap.get(selectedDay.toDateString()) ?? [];
    return [...list].sort((a, b) => {
      const ta = calendarDate(a)?.getTime() ?? 0;
      const tb = calendarDate(b)?.getTime() ?? 0;
      return ta - tb;
    });
  }, [selectedDay, postsByDateMap]);

  const monthCells = useMemo(() => {
    const first = firstWeekday(year, month);
    const num = daysInMonth(year, month);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let i = 1; i <= num; i++) cells.push(new Date(year, month, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${deleteTarget.id}`);
      setPosts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDetailPostId(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-full min-h-screen bg-[var(--color-ink)]/50">
      <div className="flex h-screen overflow-hidden">
        
        {/* ─── Column 1: Master Calendar View ──────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)]/30">
          
          {/* Calendar Header Controls */}
          <header className="p-6 border-b border-[var(--color-border)]/20 bg-[var(--color-ink)]/20 backdrop-blur-xl flex items-center justify-between z-20">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-[var(--color-cream)] tracking-tighter flex items-center gap-3">
                <CalendarIcon className="w-7 h-7 text-[var(--color-accent)]" />
                {view === "month" ? MONTHS[month] : "Week View"} <span className="text-[var(--color-muted)]">{year}</span>
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-[var(--color-elevated)]/40 p-1 rounded-xl border border-white/5 shadow-inner">
                <Button 
                  variant={view === "month" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setView("month")}
                  className="rounded-lg px-4 gap-2 font-bold transition-all"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Month
                </Button>
                <Button 
                  variant={view === "week" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setView("week")}
                  className="rounded-lg px-4 gap-2 font-bold transition-all"
                >
                  <LayoutList className="w-4 h-4" />
                  Week
                </Button>
              </div>

              <div className="h-8 w-px bg-[var(--color-border)]/30 mx-2" />

              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" onClick={handlePrev} className="rounded-full hover:bg-[var(--color-elevated)]">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleToday}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 h-8 bg-[var(--color-elevated)]/20 rounded-full border border-white/5"
                >
                  Today
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNext} className="rounded-full hover:bg-[var(--color-elevated)]">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Calendar Content Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide bg-gradient-to-br from-transparent to-[var(--color-accent)]/5">
            <div className="max-w-5xl mx-auto space-y-4">
              
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-[var(--color-muted)] uppercase tracking-[0.2em] font-mono">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid with Dynamic Sizing Logic */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={view + currentDate.toDateString()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-7 gap-2 md:gap-4 auto-rows-min"
                >
                  {(view === "month" ? monthCells : weekDays).map((date, idx) => {
                    const postsForDay = date ? (postsByDateMap.get(date.toDateString()) ?? []) : [];
                    const isToday = !!(date && today.toDateString() === date.toDateString());
                    const isSelected = !!(date && selectedDay?.toDateString() === date.toDateString());
                    
                    // Dynamic Sizing: Days with >3 posts span more rows if in week view, or just grow vertically
                    return (
                      <CalendarDayCard
                        key={idx}
                        date={date}
                        posts={postsForDay}
                        isSelected={isSelected}
                        isToday={isToday}
                        onClick={() => date && setSelectedDay(date)}
                      />
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* ─── Column 2: Day Detailed View ─────────────────────────────── */}
        <aside className="w-[420px] bg-[var(--color-elevated)]/10 backdrop-blur-3xl flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.3)]">
          <header className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant="amber" className="px-3 py-1 font-mono uppercase tracking-[0.2em]">
                <Clock className="w-3 h-3 mr-2" />
                Timeline Manifest
              </Badge>
              <Button size="icon" variant="secondary" asChild className="rounded-full shadow-2xl h-12 w-12 hover:scale-110 active:scale-95 transition-all">
                <a href={`/compose?date=${selectedDay?.toISOString().split('T')[0]}`}>
                  <Plus className="w-6 h-6" />
                </a>
              </Button>
            </div>

            <div className="space-y-1">
              <h2 className="text-4xl font-black text-[var(--color-cream)] tracking-tighter leading-none">
                {selectedDay?.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
              </h2>
              <p className="text-xs font-mono text-[var(--color-muted)] uppercase tracking-widest pt-1">
                {selectedDay?.toLocaleDateString('en-US', { weekday: 'long' })} · {selectedPosts.length} Operations
              </p>
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
              <input 
                placeholder="Search events..." 
                className="w-full bg-[var(--color-ink)]/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-1 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50 transition-all outline-none"
              />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 pb-10 scrollbar-hide space-y-4">
            <AnimatePresence mode="popLayout">
              {selectedPosts.length > 0 ? (
                selectedPosts.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <DetailPostCard 
                      post={post} 
                      onClick={() => {
                        setDetailPostId(post.id);
                        setDetailPost(post);
                        setDetailError(null);
                        setDetailActiveMediaIndex(0);
                      }}
                    />
                  </motion.div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                  <div className="p-5 rounded-3xl bg-[var(--color-ink)] border border-white/5">
                    <Zap className="w-10 h-10 text-[var(--color-muted)]" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">No Broadcasts Slotted</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <PostDetailsModal
        isOpen={!!detailPostId}
        onClose={() => setDetailPostId(null)}
        post={detailPost}
        loading={detailLoading}
        error={detailError}
        activeMediaIndex={detailActiveMediaIndex}
        onActiveMediaIndexChange={setDetailActiveMediaIndex}
        actions={
          detailPost && !detailPost.is_deleted && (
            <div className="flex items-center gap-3">
              {(detailPost.status === "draft" || detailPost.status === "scheduled") && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => window.location.href = `/compose?edit_post_id=${detailPost.id}`}
                  className="rounded-xl px-6 font-bold"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Post
                </Button>
              )}
              {["draft", "scheduled", "failed"].includes(detailPost.status) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDeleteTarget(detailPost)}
                  className="rounded-xl px-6 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        busy={deleting}
        previewText={deleteTarget?.content.slice(0, 50) ?? ""}
        errorMessage={deleteError}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function CalendarDayCard({ date, posts, isToday, isSelected, onClick }: {
  date: Date | null;
  posts: Post[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!date) return <div className="p-4 opacity-0 h-16" />;

  const hasPosts = posts.length > 0;
  // SMARTER DYNAMIC SIZING: If a day has many posts, it becomes naturally taller
  // We keep width fixed to preserve the 7-day column alignment, but let height respond to content.
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col group",
        "min-h-[90px] p-2 md:p-3",
        isSelected 
          ? "bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-primary)]/10 border-[var(--color-accent)] shadow-[0_20px_40px_rgba(var(--color-primary-rgb),0.2)] z-10" 
          : hasPosts 
            ? "bg-[var(--color-elevated)]/30 border-white/10 hover:border-white/20" 
            : "bg-[var(--color-ink)]/10 border-white/5 hover:border-white/10 grayscale opacity-90 hover:grayscale-0",
        isToday && !isSelected && "ring-1 ring-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "size-7 flex items-center justify-center rounded-lg text-xs font-black transition-all",
          isToday 
            ? "bg-[var(--color-accent)] text-[#0f1117] shadow-[0_0_10px_rgba(var(--color-accent-rgb),0.5)]" 
            : "text-[var(--color-cream)]/40 font-mono group-hover:text-[var(--color-cream)]"
        )}>
          {date.getDate()}
        </span>
        {hasPosts && (
          <div className="flex -space-x-1.5 overflow-hidden">
            {posts.slice(0, 3).map((p, i) => (
              <div key={i} className={cn("size-2.5 rounded-full border border-[var(--color-ink)] shadow-sm", getStatusColor(p.status))} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1 w-full overflow-hidden">
        {posts.slice(0, 5).map(post => (
          <div key={post.id} className="h-4 bg-[var(--color-ink)]/40 rounded px-1.5 flex items-center gap-1.5 border border-white/5">
            <div className={cn("size-1.5 rounded-full flex-shrink-0", getStatusColor(post.status))} />
            <span className="text-[8px] font-mono whitespace-nowrap overflow-hidden text-ellipsis text-[var(--color-muted)] uppercase tracking-tighter">
              {post.content.slice(0, 15)}
            </span>
          </div>
        ))}
        {posts.length > 5 && (
          <p className="text-[8px] font-bold text-[var(--color-muted)] font-mono pl-1">
            + {posts.length - 5} more broadcasts
          </p>
        )}
      </div>
    </motion.button>
  );
}

function DetailPostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const time = formatTime(post.scheduled_for ?? post.published_at ?? post.created_at);
  const [platformIcon, setPlatformIcon] = useState<any>(<Twitter className="w-3.5 h-3.5" />);

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "group cursor-pointer border-white/5 hover:border-[var(--color-accent)]/30 backdrop-blur-md transition-all duration-300",
        "bg-[var(--color-ink)]/20 hover:bg-[var(--color-ink)]/40 shadow-sm"
      )}
    >
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={STATUS_VARIANTS[post.status]} className="font-mono text-[9px] px-2 uppercase tracking-widest ring-1 ring-white/5">
            {post.status}
          </Badge>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--color-muted)]">
            <div className="p-1 rounded-md bg-[var(--color-ink)] border border-white/5">
              {platformIcon}
            </div>
            {time}
          </div>
        </div>

        <p className="text-sm text-[var(--color-cream)]/90 leading-relaxed font-sans line-clamp-3">
          {post.content}
        </p>

        {post.media && post.media.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 h-10 overflow-hidden rounded-lg">
            {post.media.slice(0, 4).map((m, i) => (
              <img key={i} src={m.public_url} className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity" />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-bold text-[var(--color-accent)] flex items-center gap-1 uppercase tracking-widest">
            Detailed Intel
            <ChevronRightIcon className="w-3 h-3 pt-0.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: PostStatus) {
  switch (status) {
    case 'draft': return 'bg-[var(--color-muted)]';
    case 'scheduled': return 'bg-[var(--color-accent)] shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.5)]';
    case 'publishing': return 'bg-[var(--color-amber)]';
    case 'published': return 'bg-[var(--color-success)] shadow-[0_0_8px_rgba(var(--color-success-rgb),0.5)]';
    case 'failed': return 'bg-[var(--color-danger)]';
    default: return 'bg-white';
  }
}
