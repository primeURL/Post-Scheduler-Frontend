import { useState, useRef, useCallback, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../stores/auth";
import { api } from "../lib/api";
import type { ConnectedAccount, PostCreate } from "../lib/types";

const CHAR_LIMIT = 280;
const WARN_AT = Math.floor(CHAR_LIMIT * 0.8);

interface TweetSlot {
  id: string;
  content: string;
}

function newSlot(): TweetSlot {
  return { id: crypto.randomUUID(), content: "" };
}

// ─── SVG ring character counter ──────────────────────────────────────────────

function CharRing({ count }: { count: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const ratio = Math.min(count / CHAR_LIMIT, 1);
  const offset = circ * (1 - ratio);
  const over = count > CHAR_LIMIT;
  const warn = count >= WARN_AT;

  const stroke = over
    ? "var(--color-danger)"
    : warn
    ? "var(--color-amber)"
    : "var(--color-accent)";

  const remaining = CHAR_LIMIT - count;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
      <svg width="36" height="36" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.12s ease, stroke 0.12s ease" }}
        />
      </svg>
      {warn && (
        <span
          className="absolute text-[10px] tabular-nums select-none"
          style={{
            color: over ? "var(--color-danger)" : "var(--color-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {remaining}
        </span>
      )}
    </div>
  );
}

// ─── Individual tweet editor ──────────────────────────────────────────────────

interface TweetEditorProps {
  slot: TweetSlot;
  index: number;
  total: number;
  autoFocus: boolean;
  onChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  onAddBelow: (id: string) => void;
}

function TweetEditor({
  slot,
  index,
  total,
  autoFocus,
  onChange,
  onRemove,
  onAddBelow,
}: TweetEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="flex gap-3">
      {/* Thread connector */}
      <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            marginTop: 16,
            flexShrink: 0,
            background: "var(--color-accent)",
            boxShadow: "0 0 8px var(--color-accent)",
          }}
        />
        {index < total - 1 && (
          <div
            style={{
              flex: 1,
              width: 1,
              marginTop: 4,
              background: "linear-gradient(to bottom, var(--color-accent), var(--color-border))",
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-2xl p-4 mb-3"
        style={{
          background: "var(--color-elevated)",
          border: "1px solid var(--color-border)",
          transition: "border-color 0.15s ease",
        }}
        onFocusCapture={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor =
            "color-mix(in srgb, var(--color-accent) 40%, transparent)")
        }
        onBlurCapture={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)")
        }
      >
        <textarea
          ref={ref}
          value={slot.content}
          rows={3}
          placeholder={index === 0 ? "What's happening?" : "Continue the thread…"}
          onChange={(e) => {
            onChange(slot.id, e.target.value);
            resize();
          }}
          onInput={resize}
          className="w-full bg-transparent resize-none text-[15px] leading-relaxed placeholder:text-[var(--color-muted)]"
          style={{
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            minHeight: 72,
            outline: "none",
            border: "none",
          }}
        />

        <div
          className="flex items-center justify-between pt-2 mt-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="flex gap-1">
            <IconBtn
              title="Add tweet below"
              onClick={() => onAddBelow(slot.id)}
              hoverColor="var(--color-accent)"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 12 12">
                <path
                  d="M6 2v8M2 6h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Add
            </IconBtn>

            {total > 1 && (
              <IconBtn
                title="Remove this tweet"
                onClick={() => onRemove(slot.id)}
                hoverColor="var(--color-danger)"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 6h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Remove
              </IconBtn>
            )}
          </div>

          <CharRing count={slot.content.length} />
        </div>
      </div>
    </div>
  );
}

// ─── Small icon button ────────────────────────────────────────────────────────

function IconBtn({
  children,
  title,
  onClick,
  hoverColor,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  hoverColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
      style={{
        color: hovered ? hoverColor : "var(--color-muted)",
        fontFamily: "var(--font-mono)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

type SubmitMode = "now" | "schedule";

function ModeToggle({
  mode,
  onChange,
}: {
  mode: SubmitMode;
  onChange: (m: SubmitMode) => void;
}) {
  return (
    <div
      className="flex p-1 rounded-xl"
      style={{
        background: "var(--color-elevated)",
        border: "1px solid var(--color-border)",
        width: "fit-content",
      }}
    >
      {(["now", "schedule"] as SubmitMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="px-4 py-1.5 rounded-lg text-sm transition-all duration-150"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: mode === m ? 600 : 400,
            background: mode === m ? "var(--color-accent)" : "transparent",
            color: mode === m ? "var(--color-ink)" : "var(--color-muted)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {m === "now" ? "Post Now" : "Schedule"}
        </button>
      ))}
    </div>
  );
}

// ─── Main composer ────────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

export default function PostComposer() {
  useStore($user); // subscribe so auth changes re-render

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [slots, setSlots] = useState<TweetSlot[]>([newSlot()]);
  const [mode, setMode] = useState<SubmitMode>("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [focusId, setFocusId] = useState<string>(slots[0].id);

  useEffect(() => {
    api
      .get<ConnectedAccount[]>("/accounts")
      .then((data) => {
        const xs = data.filter((a) => a.platform === "x");
        setAccounts(xs);
        if (xs.length) setSelectedAccount(xs[0].id);
      })
      .catch(() => {});
  }, []);

  // Cmd/Ctrl+Enter → publish
  const submitRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleChange = useCallback((id: string, content: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
  }, []);

  const handleAddBelow = useCallback((afterId: string) => {
    const slot = newSlot();
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, slot);
      return next;
    });
    setFocusId(slot.id);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const isEmpty = slots.every((s) => s.content.trim() === "");
  const isOverLimit = slots.some((s) => s.content.length > CHAR_LIMIT);

  async function submit(action: "draft" | "publish") {
    if (isEmpty || isOverLimit) return;
    if (action === "publish" && mode === "schedule" && !scheduledFor) {
      setErrorMsg("Pick a date and time to schedule.");
      return;
    }

    setActionState("loading");
    setErrorMsg("");

    try {
      const threadId = slots.length > 1 ? crypto.randomUUID() : undefined;

      const scheduledAt =
        action === "draft"
          ? null
          : mode === "schedule"
          ? new Date(scheduledFor).toISOString()
          : new Date().toISOString(); // post now = schedule for right now

      const payloads: PostCreate[] = slots.map((slot, i) => ({
        platform: "x",
        content: slot.content,
        scheduled_for: scheduledAt,
        thread_id: threadId ?? null,
        thread_order: slots.length > 1 ? i + 1 : null,
      }));

      await Promise.all(payloads.map((p) => api.post("/posts", p)));

      setActionState("success");
      const fresh = newSlot();
      setSlots([fresh]);
      setFocusId(fresh.id);
      setMode("now");
      setScheduledFor("");
      setTimeout(() => setActionState("idle"), 3000);
    } catch (err) {
      setActionState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  // Keep submitRef in sync
  submitRef.current = () => submit("publish");

  const minDatetime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  const primaryDisabled = isEmpty || isOverLimit || actionState === "loading";

  return (
    <div
      className="w-full max-w-2xl mx-auto px-4 py-8"
      style={{ animation: "var(--animate-fade-up)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-cream)", fontFamily: "var(--font-sans)" }}
        >
          New Post
        </h1>

        {accounts.length > 0 ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
            >
              posting as
            </span>
            <select
              value={selectedAccount ?? ""}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-sm cursor-pointer"
              style={{
                background: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-cream)",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.platform_username}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <a
            href="/settings/accounts"
            className="text-xs px-3 py-1.5 rounded-xl"
            style={{
              color: "var(--color-accent)",
              background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              fontFamily: "var(--font-mono)",
              textDecoration: "none",
            }}
          >
            Connect X account →
          </a>
        )}
      </div>

      {/* Tweet slots */}
      <div className="mb-5">
        {slots.map((slot, i) => (
          <TweetEditor
            key={slot.id}
            slot={slot}
            index={i}
            total={slots.length}
            autoFocus={slot.id === focusId}
            onChange={handleChange}
            onRemove={handleRemove}
            onAddBelow={handleAddBelow}
          />
        ))}
      </div>

      {/* Mode toggle */}
      <div className="mb-4">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Datetime picker */}
      {mode === "schedule" && (
        <div className="mb-5" style={{ animation: "var(--animate-fade-up)" }}>
          <input
            type="datetime-local"
            value={scheduledFor}
            min={minDatetime}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{
              background: "var(--color-elevated)",
              border: `1px solid ${scheduledFor ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "var(--color-border)"}`,
              color: scheduledFor ? "var(--color-cream)" : "var(--color-muted)",
              fontFamily: "var(--font-mono)",
              colorScheme: "dark",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Success banner */}
      {actionState === "success" && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5 text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
            color: "var(--color-success)",
            fontFamily: "var(--font-mono)",
            animation: "var(--animate-fade-up)",
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
            <path
              d="M2 7l3.5 3.5L12 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {mode === "schedule" ? "Scheduled successfully." : "Post queued for publishing."}
        </div>
      )}

      {/* Error */}
      {actionState === "error" && errorMsg && (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--color-danger)", fontFamily: "var(--font-mono)" }}
        >
          {errorMsg}
        </p>
      )}

      {/* Validation error (not from API) */}
      {actionState === "idle" && errorMsg && (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}
        >
          {errorMsg}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {/* Save draft */}
        <button
          onClick={() => submit("draft")}
          disabled={isEmpty || actionState === "loading"}
          className="px-4 py-2 rounded-xl text-sm transition-all duration-150"
          style={{
            background: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            color: isEmpty ? "var(--color-muted)" : "var(--color-cream)",
            fontFamily: "var(--font-mono)",
            opacity: isEmpty ? 0.5 : 1,
            cursor: isEmpty ? "not-allowed" : "pointer",
          }}
        >
          {actionState === "loading" ? "Saving…" : "Save Draft"}
        </button>

        {/* Primary */}
        <button
          onClick={() => submit("publish")}
          disabled={primaryDisabled}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            background: primaryDisabled ? "var(--color-border)" : "var(--color-accent)",
            color: primaryDisabled ? "var(--color-muted)" : "var(--color-ink)",
            fontFamily: "var(--font-mono)",
            cursor: primaryDisabled ? "not-allowed" : "pointer",
            border: "none",
            boxShadow: !primaryDisabled
              ? "0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent)"
              : "none",
          }}
        >
          {actionState === "loading"
            ? "Posting…"
            : mode === "schedule"
            ? "Schedule"
            : "Post Now"}
          <kbd
            className="px-1.5 py-0.5 rounded text-[10px] opacity-50 select-none"
            style={{ background: "rgba(0,0,0,0.25)", fontFamily: "var(--font-mono)" }}
          >
            ⌘↵
          </kbd>
        </button>

        {isOverLimit && (
          <span
            className="text-xs"
            style={{ color: "var(--color-danger)", fontFamily: "var(--font-mono)" }}
          >
            Over character limit
          </span>
        )}
      </div>
    </div>
  );
}
