import type { CSSProperties, ReactNode } from "react";
import type { Post } from "../lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Calendar,
  Share2
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface PostDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  loading: boolean;
  error: string | null;
  mediaUrls?: Record<string, string>;
  activeMediaIndex: number;
  onActiveMediaIndexChange: (next: number) => void;
  actions?: ReactNode;
  children?: ReactNode;
  quoteSourceContent?: string | null;
  zIndex?: number;
  maxWidth?: string;
}

export default function PostDetailsModal({
  isOpen,
  onClose,
  post,
  loading,
  error,
  mediaUrls = {},
  activeMediaIndex,
  onActiveMediaIndexChange,
  actions,
  children,
  quoteSourceContent,
  zIndex = 75,
  maxWidth = "760px",
}: PostDetailsModalProps) {
  
  const media = post?.media ?? [];
  const currentMedia = media[activeMediaIndex] ?? null;
  const currentSrc = currentMedia
    ? mediaUrls[currentMedia.key] ?? currentMedia.public_url
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
          style={{ zIndex }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#02060e]/80 backdrop-blur-xl"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-elevated)] to-[var(--color-ink)] shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]",
              `max-w-[${maxWidth}]`
            )}
            style={{ maxWidth }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-cream)] tracking-tight">Post Details</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="rounded-full hover:bg-[var(--color-elevated)]"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--color-muted)] font-mono animate-pulse">
                  <Clock className="w-10 h-10 opacity-20" />
                  <p className="text-sm uppercase tracking-widest">Loading blueprint...</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)]">
                  <AlertCircle className="w-5 h-5" />
                  <p className="font-mono text-sm leading-none">{error}</p>
                </div>
              )}

              {post && (
                <div className="space-y-8">
                  {/* Status Banner */}
                  <div className="flex flex-wrap items-center gap-4 bg-[var(--color-ink)]/50 p-4 rounded-2xl border border-[var(--color-border)]/50">
                    <Badge variant={
                      post.status === "published" ? "success" : 
                      post.status === "scheduled" ? "amber" : 
                      post.status === "failed" ? "destructive" : "outline"
                    }>
                      {post.status}
                    </Badge>
                    
                    <div className="flex items-center gap-4 text-xs font-mono text-[var(--color-muted)] divide-x divide-[var(--color-border)]/50">
                      {post.scheduled_for && (
                        <span className="flex items-center gap-2 pl-4 first:pl-0">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(post.scheduled_for).toLocaleString()}
                        </span>
                      )}
                      {post.published_at && (
                        <span className="flex items-center gap-2 pl-4 first:pl-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {new Date(post.published_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Editor Preview */}
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-accent)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="relative text-xl md:text-2xl font-medium leading-relaxed text-[var(--color-cream)] font-sans whitespace-pre-wrap selection:bg-[var(--color-accent)] selection:text-[#0f1117]">
                      {post.content}
                    </p>
                  </div>

                  {/* Quote Source Content */}
                  {quoteSourceContent && (
                    <div className="relative border-l-4 border-l-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 p-5 rounded-r-2xl overflow-hidden group">
                      <div className="absolute top-2 right-2 opacity-5 text-[var(--color-accent)] transition-opacity group-hover:opacity-10">
                        <Share2 className="w-12 h-12 rotate-12" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent)] mb-3">
                        Quoted Source
                      </div>
                      <p className="text-base text-[var(--color-cream)]/80 leading-relaxed font-sans italic">
                        "{quoteSourceContent}"
                      </p>
                    </div>
                  )}

                  {/* Media Carousel */}
                  {!!media.length && (
                    <div className="space-y-4">
                      <div className="relative group/carousel rounded-2xl overflow-hidden border border-[var(--color-border)] bg-black/40 aspect-video flex items-center justify-center">
                        {currentMedia.content_type?.startsWith("video/") ? (
                          <video
                            controls
                            src={currentSrc ?? undefined}
                            className="w-full h-full max-h-[500px] object-contain"
                          />
                        ) : (
                          <img
                            src={currentSrc ?? undefined}
                            alt={currentMedia.file_name ?? "Post media"}
                            className="w-full h-full max-h-[500px] object-contain transition-transform duration-700 group-hover/carousel:scale-105"
                          />
                        )}

                        {media.length > 1 && (
                          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                            <CarouselButton side="left" onClick={() => onActiveMediaIndexChange((activeMediaIndex - 1 + media.length) % media.length)} />
                            <CarouselButton side="right" onClick={() => onActiveMediaIndexChange((activeMediaIndex + 1) % media.length)} />
                          </div>
                        )}
                        
                        {/* Carousel Indicators */}
                        {media.length > 1 && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
                            {media.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => onActiveMediaIndexChange(i)}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                  i === activeMediaIndex ? "w-6 bg-[var(--color-accent)]" : "bg-white/30 hover:bg-white/50"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {children && <div className="pt-4">{children}</div>}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-[var(--color-border)]/50 bg-[var(--color-ink)]/30 flex items-center justify-between gap-4 shrink-0">
               <div className="flex items-center gap-2">
                 <Button variant="ghost" className="text-[var(--color-muted)] hover:text-[var(--color-cream)]" onClick={onClose}>Close</Button>
               </div>
               <div className="flex items-center gap-3">
                 {actions}
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CarouselButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white hover:bg-[var(--color-primary)] hover:border-transparent transition-all active:scale-90 shadow-xl"
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}
