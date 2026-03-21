import { useState, useRef, useCallback, useEffect, type DragEvent } from "react";
import { useStore } from "@nanostores/react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { $user, setAuth } from "../stores/auth";
import { api } from "../lib/api";
import SchedulePickerModal from "./SchedulePickerModal";
import type {
  ConnectedAccount,
  Post,
  PostCreate,
  PostMedia,
  UploadUrlResponse,
  User,
  XConnectResponse,
} from "../lib/types";
import { getFeatureLimits, getUpgradeMessage } from "../lib/featureGating";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8000";

interface PendingMedia {
  file: File;
  previewUrl: string;
  uploaded?: PostMedia;
  uploading: boolean;
}

interface TweetSlot {
  id: string;
  content: string;
  media: PendingMedia | null;
}

interface DraftGroup {
  key: string;
  label: string;
  posts: Post[];
  connectedAccountId: string | null;
  updatedAt: string;
}

function newSlot(): TweetSlot {
  return { id: crypto.randomUUID(), content: "", media: null };
}

function getMediaKind(contentType: string): string {
  if (contentType === "image/gif") return "gif";
  if (contentType.startsWith("video/")) return "video";
  return "image";
}

function revokeSlotMedia(slot: TweetSlot) {
  if (slot.media?.previewUrl) {
    URL.revokeObjectURL(slot.media.previewUrl);
  }
}

// ─── Character counter ring ─────────────────────────────────────────────────

function CharCounter({ count, limit }: { count: number; limit: number }) {
  const warnAt = Math.floor(limit * 0.8);
  const over = count > limit;
  const warn = count >= warnAt;
  const fill = Math.min(count / limit, 1) * 100;
  const stroke = over ? "#f07050" : warn ? "#f0a850" : "#7b61ff";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className={`text-xs font-medium ${over ? "text-danger" : "text-muted"}`}
      >
        {count} / {limit.toLocaleString()}
      </span>
      <div className="size-6" style={{ transform: "rotate(-90deg)" }}>
        <svg className="size-full" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            fill="none"
            r="16"
            strokeWidth="3"
            stroke="rgba(255,255,255,0.08)"
          />
          <circle
            cx="18"
            cy="18"
            fill="none"
            r="16"
            strokeWidth="3"
            stroke={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill}, 100`}
            style={{
              transition: "stroke-dasharray 0.12s ease, stroke 0.12s ease",
            }}
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Post card ──────────────────────────────────────────────────────────────

interface PostCardProps {
  slot: TweetSlot;
  index: number;
  total: number;
  autoFocus: boolean;
  charLimit: number;
  onChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  onPickMedia: (id: string, file: File) => void;
  onRemoveMedia: (id: string) => void;
}

function PostCard({
  slot,
  index,
  total,
  autoFocus,
  charLimit,
  onChange,
  onRemove,
  onPickMedia,
  onRemoveMedia,
}: PostCardProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

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
    <div>
      <div
        className="group relative flex flex-col gap-4 rounded-xl border p-5 shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary/40"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(123,97,255,0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
              index === 0
                ? "bg-primary text-white"
                : "bg-primary/15 text-primary"
            }`}
          >
            {index + 1}
          </span>
          {total > 1 && (
            <button
              onClick={() => onRemove(slot.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger"
              title="Remove post"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                delete
              </span>
            </button>
          )}
        </div>

        <textarea
          ref={ref}
          value={slot.content}
          rows={3}
          maxLength={charLimit}
          placeholder={
            index === 0
              ? "What's happening in this thread?"
              : "Continue the thread…"
          }
          onChange={(e) => {
            onChange(slot.id, e.target.value);
            resize();
          }}
          onInput={resize}
          className="w-full resize-none border-none bg-transparent p-0 text-[15px] leading-relaxed placeholder:text-muted focus:ring-0 focus:outline-none text-cream"
          style={{ minHeight: 72 }}
        />

        {slot.media && (
          <div
            className="rounded-xl border p-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(123,97,255,0.14)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-cream truncate">
                  {slot.media.file.name}
                </p>
                <p className="text-xs text-muted mt-1">
                  {slot.media.uploading
                    ? "Uploading to media storage..."
                    : slot.media.uploaded
                      ? `${slot.media.uploaded.type} attached`
                      : "Ready to upload"}
                </p>
              </div>
              <button
                onClick={() => onRemoveMedia(slot.id)}
                className="text-muted transition-colors hover:text-danger"
                title="Remove media"
                type="button"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18 }}
                >
                  close
                </span>
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              {slot.media.file.type.startsWith("video/") ? (
                <video
                  src={slot.media.previewUrl}
                  controls
                  className="max-h-56 w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={slot.media.previewUrl}
                  alt={slot.media.file.name}
                  className="max-h-56 w-full object-cover"
                />
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
          <div className="flex items-center gap-2 text-muted flex-wrap">
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                onPickMedia(slot.id, file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="flex items-center gap-1.5 hover:text-primary transition-colors rounded-full border border-white/10 px-2.5 py-1.5"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20 }}
              >
                attach_file
              </span>
              <span className="text-xs font-medium">
                {slot.media ? "Replace media" : "Add media"}
              </span>
            </button>
            {[
              { label: "GIF", title: "GIF support coming soon" },
              { label: "Poll", title: "Poll support coming soon" },
              { label: "Emoji", title: "Emoji support coming soon" },
              { label: "Tag", title: "Location tagging coming soon" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.title}
                disabled
                className="rounded-full border border-white/10 px-2.5 py-1.5 text-xs font-medium opacity-70 cursor-not-allowed"
              >
                {item.label}
              </button>
            ))}
          </div>
          <CharCounter count={slot.content.length} limit={charLimit} />
        </div>
      </div>

      {index < total - 1 && (
        <div className="ml-4 my-1 h-7 w-px bg-linear-to-b from-primary/30 to-primary/10" />
      )}
    </div>
  );
}

// ─── Setup modal ────────────────────────────────────────────────────────────

interface SetupModalProps {
  initialUser: User | null;
  initialHasX: boolean;
  onCancel: () => void;
  onComplete: () => void;
}

function SetupModal({
  initialUser,
  initialHasX,
  onCancel,
  onComplete,
}: SetupModalProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [hasX, setHasX] = useState(initialHasX);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState("");
  const [step2Loading, setStep2Loading] = useState(false);

  const step1Done = user !== null;
  const step2Done = hasX;

  // If both steps are already done, auto-complete
  useEffect(() => {
    if (step1Done && step2Done) onComplete();
  }, [step1Done, step2Done]);

  async function handleGoogleSignIn() {
    setStep1Loading(true);
    setStep1Error("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const resp = await fetch(`${API_BASE}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!resp.ok) throw new Error("Sign-in failed");
      const { access_token } = (await resp.json()) as { access_token: string };

      const meResp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
        credentials: "include",
      });
      if (!meResp.ok) throw new Error("Could not fetch profile");
      const meUser = (await meResp.json()) as User;

      setAuth(access_token, meUser);
      setUser(meUser);

      const accounts = await api
        .get<ConnectedAccount[]>("/accounts")
        .catch(() => []);
      if (accounts.some((account) => account.platform === "x")) {
        setHasX(true);
        return;
      }

      const data = await api.get<XConnectResponse>(
        "/accounts/x/connect?next=/compose",
      );
      window.location.href = data.authorization_url;
    } catch {
      setStep1Error("Sign-in failed. Please try again.");
    } finally {
      setStep1Loading(false);
    }
  }

  async function handleConnectX() {
    setStep2Loading(true);
    try {
      const data = await api.get<XConnectResponse>(
        "/accounts/x/connect?next=/compose",
      );
      window.location.href = data.authorization_url;
    } catch {
      setStep2Loading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,12,16,0.85)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl animate-fade-up"
        style={{
          background: "#11141C",
          border: "1px solid rgba(123,97,255,0.25)",
        }}
      >
        {/* Header */}
        <div className="mb-7">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3"
            style={{ background: "rgba(123,97,255,0.1)", color: "#8B97FF" }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14 }}
            >
              rocket_launch
            </span>
            Almost there
          </div>
          <h2 className="text-xl font-black text-cream">Get set up to post</h2>
          <p className="text-sm text-muted mt-1">
            Complete these {step1Done ? "1 remaining step" : "2 steps"} to
            publish your thread.
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {/* Step 1 — Google Sign-In */}
          <div
            className="rounded-xl p-4 transition-all"
            style={{
              background: step1Done
                ? "rgba(78,204,128,0.06)"
                : "rgba(123,97,255,0.06)",
              border: step1Done
                ? "1px solid rgba(78,204,128,0.2)"
                : "1px solid rgba(123,97,255,0.2)",
            }}
          >
            <div className="flex items-start gap-3">
              {/* Step badge */}
              <div
                className="shrink-0 flex size-7 items-center justify-center rounded-full text-xs font-bold mt-0.5"
                style={{
                  background: step1Done
                    ? "rgba(78,204,128,0.15)"
                    : "rgba(123,97,255,0.15)",
                  color: step1Done ? "#4ECC80" : "#7b61ff",
                }}
              >
                {step1Done ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    check
                  </span>
                ) : (
                  "1"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${step1Done ? "text-success" : "text-cream"}`}
                >
                  Sign in with Google
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {step1Done
                    ? `Signed in as ${user?.name ?? user?.email}`
                    : "Your account, synced everywhere."}
                </p>
                {step1Error && (
                  <p className="text-xs text-danger mt-1">{step1Error}</p>
                )}
              </div>

              {!step1Done && (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={step1Loading}
                  className="shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{
                    background: "#1A1D28",
                    color: "#DED9CE",
                    border: "1px solid rgba(123,97,255,0.3)",
                  }}
                >
                  {step1Loading ? (
                    <span className="size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  {step1Loading ? "Signing in…" : "Sign in"}
                </button>
              )}
            </div>
          </div>

          {/* Step 2 — Connect X */}
          <div
            className="rounded-xl p-4 transition-all"
            style={{
              background: step2Done
                ? "rgba(78,204,128,0.06)"
                : step1Done
                  ? "rgba(123,97,255,0.06)"
                  : "rgba(255,255,255,0.02)",
              border: step2Done
                ? "1px solid rgba(78,204,128,0.2)"
                : step1Done
                  ? "1px solid rgba(123,97,255,0.2)"
                  : "1px solid rgba(255,255,255,0.06)",
              opacity: step1Done ? 1 : 0.5,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Step badge */}
              <div
                className="shrink-0 flex size-7 items-center justify-center rounded-full text-xs font-bold mt-0.5"
                style={{
                  background: step2Done
                    ? "rgba(78,204,128,0.15)"
                    : step1Done
                      ? "rgba(123,97,255,0.15)"
                      : "rgba(255,255,255,0.06)",
                  color: step2Done
                    ? "#4ECC80"
                    : step1Done
                      ? "#7b61ff"
                      : "#545B73",
                }}
              >
                {step2Done ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    check
                  </span>
                ) : (
                  "2"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${step2Done ? "text-success" : step1Done ? "text-cream" : "text-muted"}`}
                >
                  Connect X account
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {step2Done
                    ? "X account connected and ready."
                    : "Required to publish posts on X."}
                </p>
              </div>

              {!step2Done && step1Done && (
                <button
                  onClick={handleConnectX}
                  disabled={step2Loading}
                  className="shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{
                    background: "#1A1D28",
                    color: "#DED9CE",
                    border: "1px solid rgba(123,97,255,0.3)",
                  }}
                >
                  {step2Loading ? (
                    <span className="size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <svg className="size-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
                    </svg>
                  )}
                  {step2Loading ? "Redirecting…" : "Connect X"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer note + cancel */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted">
            X connect will redirect you to authorize. Your draft will be waiting
            here.
          </p>
          <button
            onClick={onCancel}
            className="ml-4 shrink-0 text-xs font-semibold text-muted hover:text-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main composer ───────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

export default function PostComposer() {
  const user = useStore($user);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [slots, setSlots] = useState<TweetSlot[]>([newSlot()]);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [focusId, setFocusId] = useState<string>(slots[0].id);
  const [showSetup, setShowSetup] = useState(false);
  const [drafts, setDrafts] = useState<DraftGroup[]>([]);
  const [selectedDraftKey, setSelectedDraftKey] = useState<string>("");
  const [scheduledGroups, setScheduledGroups] = useState<DraftGroup[]>([]);
  const [selectedScheduledKey, setSelectedScheduledKey] =
    useState<string>("");
  const [isComposerDropActive, setIsComposerDropActive] = useState(false);
  const [isTwoColumnLayout, setIsTwoColumnLayout] = useState(true);
  const composeGridRef = useRef<HTMLDivElement>(null);
  const draftedPanelRef = useRef<HTMLDivElement>(null);
  const scheduledPanelRef = useRef<HTMLDivElement>(null);
  const requestedDraftPostIdRef = useRef<string | null>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("draft_post_id")
      : null,
  );
  const autoRestoreDoneRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<ConnectedAccount[]>("/accounts")
      .then((data) => {
        const xs = data.filter((a) => a.platform === "x");
        setAccounts(xs);
        if (xs.length) setSelectedAccount(xs[0].id);
      })
      .catch(() => {});
  }, [user]);

  const loadDrafts = useCallback(async () => {
    function buildGroups(posts: Post[], status: "draft" | "scheduled") {
      const filteredPosts = posts.filter(
        (post) => post.status === status && !post.is_deleted,
      );
      const grouped = new Map<string, Post[]>();

      for (const post of filteredPosts) {
        const key = post.thread_id ?? post.id;
        const bucket = grouped.get(key) ?? [];
        bucket.push(post);
        grouped.set(key, bucket);
      }

      const groups: DraftGroup[] = Array.from(grouped.entries()).map(
        ([key, items]) => {
          const sorted = [...items].sort((a, b) => {
            const ao = a.thread_order ?? 1;
            const bo = b.thread_order ?? 1;
            if (ao !== bo) return ao - bo;
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );
          });
          const first = sorted[0];
          const updatedAt = sorted.reduce((latest, post) => {
            return new Date(post.updated_at).getTime() >
              new Date(latest).getTime()
              ? post.updated_at
              : latest;
          }, first.updated_at);
          const preview =
            first.content.length > 36
              ? `${first.content.slice(0, 36)}...`
              : first.content;
          const label = preview || `Untitled ${status}`;

          return {
            key,
            label,
            posts: sorted,
            connectedAccountId: first.connected_account_id ?? null,
            updatedAt,
          };
        },
      );

      groups.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      return groups;
    }

    try {
      const posts = await api.get<Post[]>("/posts?limit=500");
      const draftGroups = buildGroups(posts, "draft");
      const nextScheduledGroups = buildGroups(posts, "scheduled");

      setDrafts(draftGroups);
      setScheduledGroups(nextScheduledGroups);
      setSelectedDraftKey((prev) =>
        prev && draftGroups.some((draft) => draft.key === prev) ? prev : "",
      );
      setSelectedScheduledKey((prev) =>
        prev && nextScheduledGroups.some((group) => group.key === prev)
          ? prev
          : "",
      );
    } catch {
      setDrafts([]);
      setScheduledGroups([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadDrafts();
  }, [user, loadDrafts]);

  useEffect(() => {
    const grid = composeGridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // Use available content width (not viewport width) so sidebar transitions
      // do not collapse the layout unpredictably during navigation.
      setIsTwoColumnLayout(width >= 920);
    });

    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      if (
        draftedPanelRef.current &&
        !draftedPanelRef.current.contains(targetNode)
      ) {
        setSelectedDraftKey("");
      }

      if (
        scheduledPanelRef.current &&
        !scheduledPanelRef.current.contains(targetNode)
      ) {
        setSelectedScheduledKey("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const currentAccount = accounts.find((a) => a.id === selectedAccount);
  const currentTier = currentAccount?.subscription_type ?? "Basic";
  const currentLimits = getFeatureLimits(currentTier);
  const charLimit = currentLimits.maxCharactersPerPost;

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

  const handleChange = useCallback(
    (id: string, content: string) => {
      const limitedContent = content.slice(0, charLimit);
      setSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, content: limitedContent } : s)),
      );
    },
    [charLimit],
  );

  const handleAdd = useCallback(() => {
    if (slots.length >= currentLimits.maxThreadLength) {
      setErrorMsg(
        `Thread length limit reached (${currentLimits.maxThreadLength} posts). ${getUpgradeMessage(currentTier)}`,
      );
      return;
    }

    const slot = newSlot();
    setSlots((prev) => [...prev, slot]);
    setFocusId(slot.id);
    setErrorMsg(""); // Clear any previous limit error
  }, [currentLimits.maxThreadLength, currentTier, slots.length]);

  const handleRemove = useCallback((id: string) => {
    setSlots((prev) => {
      const slot = prev.find((item) => item.id === id);
      if (slot) revokeSlotMedia(slot);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const handleClear = () => {
    for (const slot of slots) {
      revokeSlotMedia(slot);
    }
    const fresh = newSlot();
    setSlots([fresh]);
    setFocusId(fresh.id);
    setScheduledFor(null);
    setActionState("idle");
    setErrorMsg("");
    setSelectedDraftKey("");
    setSelectedScheduledKey("");
  };

  const restoreDraftGroup = useCallback((selected: DraftGroup) => {
    const restoredSlots: TweetSlot[] = selected.posts.map((post) => {
      const primaryMedia = post.media?.[0] ?? null;
      const media = primaryMedia
        ? {
            file: new File([], primaryMedia.file_name ?? "media", {
              type: primaryMedia.content_type ?? "application/octet-stream",
            }),
            previewUrl: primaryMedia.public_url,
            uploading: false,
            uploaded: primaryMedia,
          }
        : null;

      return {
        id: crypto.randomUUID(),
        content: post.content,
        media,
      };
    });

    setSlots((prev) => {
      for (const slot of prev) {
        revokeSlotMedia(slot);
      }
      return restoredSlots.length ? restoredSlots : [newSlot()];
    });

    const firstSlot = restoredSlots[0] ?? newSlot();
    setFocusId(firstSlot.id);
    setScheduledFor(selected.posts[0]?.scheduled_for ?? null);
    if (selected.connectedAccountId) {
      setSelectedAccount(selected.connectedAccountId);
    }
    setErrorMsg("");
    setActionState("idle");
  }, []);

  const restoreDraft = useCallback(() => {
    const selected = drafts.find((item) => item.key === selectedDraftKey);
    if (!selected) return;
    restoreDraftGroup(selected);
  }, [drafts, selectedDraftKey, restoreDraftGroup]);

  const restoreScheduled = useCallback(() => {
    const selected = scheduledGroups.find(
      (item) => item.key === selectedScheduledKey,
    );
    if (!selected) return;
    restoreDraftGroup(selected);
  }, [scheduledGroups, selectedScheduledKey, restoreDraftGroup]);

  const getGroupByKey = useCallback(
    (kind: "draft" | "scheduled", key: string) => {
      const source = kind === "draft" ? drafts : scheduledGroups;
      return source.find((group) => group.key === key) ?? null;
    },
    [drafts, scheduledGroups],
  );

  const getGroupChip = (group: DraftGroup) =>
    group.posts.length > 1 ? `thread(${group.posts.length})` : "post";

  const handleCardDragStart = useCallback(
    (
      event: DragEvent<HTMLButtonElement>,
      kind: "draft" | "scheduled",
      key: string,
    ) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(
        "application/post-group",
        JSON.stringify({ kind, key }),
      );
      event.dataTransfer.setData("text/plain", `${kind}:${key}`);
    },
    [],
  );

  const handleComposerDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsComposerDropActive(false);

      const rawPayload = event.dataTransfer.getData("application/post-group");
      if (!rawPayload) return;

      try {
        const parsed = JSON.parse(rawPayload) as {
          kind: "draft" | "scheduled";
          key: string;
        };
        const selected = getGroupByKey(parsed.kind, parsed.key);
        if (!selected) return;

        if (parsed.kind === "draft") {
          setSelectedDraftKey(selected.key);
          setSelectedScheduledKey("");
        } else {
          setSelectedScheduledKey(selected.key);
          setSelectedDraftKey("");
        }

        restoreDraftGroup(selected);
      } catch {
        // Ignore malformed drag payloads.
      }
    },
    [getGroupByKey, restoreDraftGroup],
  );

  useEffect(() => {
    if (autoRestoreDoneRef.current) return;
    const requestedPostId = requestedDraftPostIdRef.current;
    if (!requestedPostId || drafts.length === 0) return;

    const matchingDraft = drafts.find((group) =>
      group.posts.some((post) => post.id === requestedPostId),
    );
    if (!matchingDraft) {
      autoRestoreDoneRef.current = true;
      return;
    }

    setSelectedDraftKey(matchingDraft.key);
    restoreDraftGroup(matchingDraft);
    autoRestoreDoneRef.current = true;

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("draft_post_id");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, [drafts, restoreDraftGroup]);

  const isEmpty = slots.every((s) => s.content.trim() === "");
  const isOverLimit = slots.some((s) => s.content.length > charLimit);
  const isUploadingMedia = slots.some((s) => s.media?.uploading);
  const totalChars = slots.reduce((sum, s) => sum + s.content.length, 0);
  const primaryDisabled =
    isEmpty || isOverLimit || isUploadingMedia || actionState === "loading";

  const replaceSlotMedia = useCallback(
    (id: string, nextMedia: PendingMedia | null) => {
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.id !== id) return slot;
          if (
            slot.media?.previewUrl &&
            slot.media.previewUrl !== nextMedia?.previewUrl
          ) {
            URL.revokeObjectURL(slot.media.previewUrl);
          }
          return { ...slot, media: nextMedia };
        }),
      );
    },
    [],
  );

  const handleRemoveMedia = useCallback(
    (id: string) => {
      replaceSlotMedia(id, null);
    },
    [replaceSlotMedia],
  );

  const handlePickMedia = useCallback(
    async (id: string, file: File) => {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setErrorMsg("Only image, GIF, and video files are supported.");
        return;
      }

      setErrorMsg("");
      const previewUrl = URL.createObjectURL(file);
      replaceSlotMedia(id, { file, previewUrl, uploading: true });

      try {
        const upload = await api.post<UploadUrlResponse>(
          "/storage/upload-url",
          {
            file_name: file.name,
            content_type: file.type,
            size: file.size,
          },
        );

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

        replaceSlotMedia(id, {
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
      } catch (err) {
        replaceSlotMedia(id, null);
        URL.revokeObjectURL(previewUrl);
        setErrorMsg(
          err instanceof Error ? err.message : "Media upload failed.",
        );
      }
    },
    [replaceSlotMedia],
  );

  async function submit(action: "draft" | "publish") {
    if (isEmpty || isOverLimit) {
      if (isOverLimit) {
        setErrorMsg(
          `Each post must be ${charLimit.toLocaleString()} characters or fewer for this account.`,
        );
      }
      return;
    }
    if (isUploadingMedia) {
      setErrorMsg("Please wait for media uploads to finish.");
      return;
    }

    // Gate: need Google sign-in + X account
    if (!user || accounts.length === 0) {
      setShowSetup(true);
      return;
    }

    if (!selectedAccount) {
      setErrorMsg("Select an X account to post from.");
      return;
    }
    setActionState("loading");
    setErrorMsg("");

    try {
      const threadId = slots.length > 1 ? crypto.randomUUID() : undefined;
      const scheduledAt =
        action === "draft"
          ? null
          : scheduledFor
            ? new Date(scheduledFor).toISOString()
            : new Date().toISOString();

      const payloads: PostCreate[] = slots.map((s, i) => ({
        connected_account_id: selectedAccount,
        platform: "x",
        content: s.content,
        scheduled_for: scheduledAt,
        thread_id: threadId ?? null,
        thread_order: slots.length > 1 ? i + 1 : null,
        media: s.media?.uploaded ? [s.media.uploaded] : null,
      }));

      await Promise.all(payloads.map((p) => api.post("/posts", p)));

      if (action === "draft") {
        await loadDrafts();
      }

      setActionState("success");
      const fresh = newSlot();
      setSlots([fresh]);
      setFocusId(fresh.id);
      setScheduledFor(null);
      setTimeout(() => setActionState("idle"), 3000);
    } catch (err) {
      setActionState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  submitRef.current = () => submit("publish");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showSchedulePicker && (
        <SchedulePickerModal
          initialISO={scheduledFor}
          onClose={() => setShowSchedulePicker(false)}
          onConfirm={(localIso) => {
            setScheduledFor(localIso);
            setShowSchedulePicker(false);
          }}
        />
      )}

      {showSetup && (
        <SetupModal
          initialUser={user}
          initialHasX={accounts.length > 0}
          onCancel={() => setShowSetup(false)}
          onComplete={() => {
            setShowSetup(false);
            api
              .get<ConnectedAccount[]>("/accounts")
              .then((data) => {
                const xs = data.filter((a) => a.platform === "x");
                setAccounts(xs);
                if (xs.length) setSelectedAccount(xs[0].id);
              })
              .catch(() => {});
          }}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden px-4 py-6 md:px-6">
        <div
          ref={composeGridRef}
          className="mx-auto grid h-full w-full max-w-6xl gap-6"
          style={{
            gridTemplateColumns: isTwoColumnLayout
              ? "minmax(0,1fr) 360px"
              : "minmax(0,1fr)",
          }}
        >
          <section
            className="min-w-0 min-h-0 flex flex-col"
            onDragEnter={() => setIsComposerDropActive(true)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsComposerDropActive(false);
              }
            }}
            onDrop={handleComposerDrop}
          >
            <div className="min-h-0 flex-1 overflow-y-auto pr-3 md:pr-4">
            <div
              className="mb-6 flex items-center justify-between rounded-r-lg border-l-4 border-primary p-4 transition-colors"
              style={{
                background: isComposerDropActive
                  ? "rgba(123,97,255,0.12)"
                  : "rgba(123,97,255,0.06)",
              }}
            >
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Thread Composition
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {slots.length} {slots.length === 1 ? "post" : "posts"} drafted • {totalChars} total characters
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Per-post limit: {charLimit.toLocaleString()} ({currentTier})
                </p>
              </div>
              <div className="flex items-center gap-2">
                {accounts.length > 0 ? (
                  <select
                    value={selectedAccount ?? ""}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-cream border outline-none cursor-pointer"
                    style={{
                      background: "rgba(123,97,255,0.1)",
                      borderColor: "rgba(123,97,255,0.3)",
                    }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} style={{ background: "#120f23" }}>
                        @{a.platform_username}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setShowSetup(true)}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Connect X →
                  </button>
                )}
              </div>
            </div>

            {actionState === "success" && (
              <div
                className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-success"
                style={{
                  background: "rgba(78,204,128,0.1)",
                  border: "1px solid rgba(78,204,128,0.3)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  check_circle
                </span>
                {scheduledFor ? "Scheduled successfully." : "Post queued for publishing."}
              </div>
            )}

            {errorMsg && (
              <div
                className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-danger"
                style={{
                  background: "rgba(240,112,80,0.1)",
                  border: "1px solid rgba(240,112,80,0.3)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  error
                </span>
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col">
              {slots.map((slot, i) => (
                <PostCard
                  key={slot.id}
                  slot={slot}
                  index={i}
                  total={slots.length}
                  autoFocus={slot.id === focusId}
                  charLimit={charLimit}
                  onChange={handleChange}
                  onRemove={handleRemove}
                  onPickMedia={handlePickMedia}
                  onRemoveMedia={handleRemoveMedia}
                />
              ))}
            </div>

            <div className="flex flex-col items-center gap-2 mt-5 mb-2">
              <button
                onClick={handleAdd}
                className="group flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-bold text-primary transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "rgba(123,97,255,0.3)",
                  background: "rgba(123,97,255,0.04)",
                }}
                disabled={slots.length >= currentLimits.maxThreadLength}
              >
                <span
                  className="material-symbols-outlined transition-transform group-hover:scale-110"
                  style={{ fontSize: 20 }}
                >
                  add_circle
                </span>
                Add to Thread
              </button>
              {(() => {
                const atLimit = slots.length >= currentLimits.maxThreadLength;
                if (atLimit || slots.length > currentLimits.maxThreadLength * 0.8) {
                  return (
                    <p className="text-xs text-muted">
                      {atLimit ? (
                        <span className="text-danger font-semibold">
                          Thread limit reached: {slots.length} / {currentLimits.maxThreadLength}
                        </span>
                      ) : (
                        <span>
                          {slots.length} / {currentLimits.maxThreadLength} posts in thread
                        </span>
                      )}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            {scheduledFor && (
              <div
                className="mt-5 rounded-xl p-4"
                style={{
                  background: "rgba(123,97,255,0.06)",
                  border: "1px solid rgba(123,97,255,0.2)",
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  Scheduled for
                </div>
                <div className="text-sm text-cream">{new Date(scheduledFor).toLocaleString()}</div>
              </div>
            )}

            <div className="pb-4" />
            </div>

            <footer
              className="shrink-0 border-t pt-4"
              style={{ borderColor: "rgba(123,97,255,0.18)" }}
            >
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setShowSchedulePicker(true)}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                  style={{
                    borderColor: scheduledFor
                      ? "rgba(123,97,255,0.5)"
                      : "rgba(255,255,255,0.1)",
                    background: scheduledFor ? "rgba(123,97,255,0.12)" : "transparent",
                    color: scheduledFor ? "#7b61ff" : "#545B73",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    calendar_month
                  </span>
                  {scheduledFor ? "Scheduled" : "Schedule Post"}
                </button>

                {scheduledFor && (
                  <button
                    onClick={() => setScheduledFor(null)}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors text-muted hover:text-cream"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    Clear
                  </button>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClear}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:text-cream transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => submit("draft")}
                    disabled={isEmpty || actionState === "loading"}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-muted hover:text-cream hover:bg-primary/10"
                    style={{ borderColor: "rgba(123,97,255,0.3)" }}
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => submit("publish")}
                    disabled={primaryDisabled}
                    className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "#7b61ff",
                      boxShadow: primaryDisabled ? "none" : "0 4px 20px rgba(123,97,255,0.3)",
                    }}
                  >
                    {actionState === "loading"
                      ? "Posting…"
                      : !!scheduledFor
                        ? "Schedule Thread"
                        : "Post Thread Now"}
                  </button>
                </div>
              </div>
            </footer>
          </section>

          <aside className="min-h-0 grid grid-rows-2 gap-4 overflow-hidden pr-1">
            <div
              ref={draftedPanelRef}
              className="min-h-0 rounded-xl border p-3 flex flex-col"
              style={{
                borderColor: "rgba(123,97,255,0.2)",
                background: "rgba(123,97,255,0.04)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
                    draft
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Drafted Posts
                  </span>
                </div>
                <button
                  onClick={restoreDraft}
                  disabled={!selectedDraftKey}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "rgba(123,97,255,0.3)",
                    background: "rgba(123,97,255,0.12)",
                  }}
                >
                  Edit
                </button>
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {drafts.length === 0 && (
                  <p className="text-xs text-muted">No drafted posts available.</p>
                )}
                {drafts.map((draft) => (
                  <button
                    key={draft.key}
                    draggable
                    onClick={() => {
                      setSelectedDraftKey(draft.key);
                    }}
                    onDragStart={(event) => handleCardDragStart(event, "draft", draft.key)}
                    className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50"
                    style={{
                      borderColor:
                        selectedDraftKey === draft.key
                          ? "rgba(123,97,255,0.55)"
                          : "rgba(123,97,255,0.2)",
                      background:
                        selectedDraftKey === draft.key
                          ? "rgba(123,97,255,0.14)"
                          : "rgba(10,12,16,0.28)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-sm text-cream truncate">
                        {draft.label}
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          borderColor: "rgba(123,97,255,0.35)",
                          background: "rgba(123,97,255,0.12)",
                          color: "#8B97FF",
                        }}
                      >
                        {getGroupChip(draft)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Updated {new Date(draft.updatedAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={scheduledPanelRef}
              className="min-h-0 rounded-xl border p-3 flex flex-col"
              style={{
                borderColor: "rgba(123,97,255,0.2)",
                background: "rgba(123,97,255,0.04)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
                    calendar_month
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Scheduled Posts
                  </span>
                </div>
                <button
                  onClick={restoreScheduled}
                  disabled={!selectedScheduledKey}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "rgba(123,97,255,0.3)",
                    background: "rgba(123,97,255,0.12)",
                  }}
                >
                  Edit
                </button>
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {scheduledGroups.length === 0 && (
                  <p className="text-xs text-muted">No scheduled posts available.</p>
                )}
                {scheduledGroups.map((group) => (
                  <button
                    key={group.key}
                    draggable
                    onClick={() => {
                      setSelectedScheduledKey(group.key);
                    }}
                    onDragStart={(event) =>
                      handleCardDragStart(event, "scheduled", group.key)
                    }
                    className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50"
                    style={{
                      borderColor:
                        selectedScheduledKey === group.key
                          ? "rgba(123,97,255,0.55)"
                          : "rgba(123,97,255,0.2)",
                      background:
                        selectedScheduledKey === group.key
                          ? "rgba(123,97,255,0.14)"
                          : "rgba(10,12,16,0.28)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-sm text-cream truncate">
                        {group.label}
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          borderColor: "rgba(123,97,255,0.35)",
                          background: "rgba(123,97,255,0.12)",
                          color: "#8B97FF",
                        }}
                      >
                        {getGroupChip(group)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Updated {new Date(group.updatedAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
