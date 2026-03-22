import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface ConfirmDeleteModalProps {
  open: boolean;
  busy: boolean;
  previewText: string;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  zIndex?: number;
}

export default function ConfirmDeleteModal({
  open,
  busy,
  previewText,
  errorMessage,
  onCancel,
  onConfirm,
  zIndex = 90,
}: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 z-[100]"
          style={{ zIndex }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && onCancel()}
            className="absolute inset-0 bg-[#02060e]/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-8 space-y-6"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)] shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-[var(--color-cream)] tracking-tight">Delete Post?</h3>
                <p className="text-sm text-[var(--color-muted)] font-mono leading-relaxed">
                  This action will hide the post from all active views. This cannot be undone from the dashboard.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-ink)]/50 border border-[var(--color-border)]/50 italic text-[var(--color-cream)]/70 text-base font-sans line-clamp-3">
              "{previewText}"
            </div>

            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-xs font-mono"
              >
                {errorMessage}
              </motion.div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button 
                variant="ghost" 
                onClick={onCancel} 
                disabled={busy}
                className="text-[var(--color-muted)] hover:text-[var(--color-cream)] px-6"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={onConfirm} 
                disabled={busy}
                className="px-8 font-bold shadow-lg shadow-[var(--color-danger)]/20"
              >
                {busy ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>

            <button
              onClick={onCancel}
              disabled={busy}
              className="absolute top-4 right-4 p-2 text-[var(--color-muted)] hover:text-[var(--color-cream)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
