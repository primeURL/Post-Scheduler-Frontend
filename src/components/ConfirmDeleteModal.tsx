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
  if (!open) return null;

  return (
    <div
      onClick={() => !busy && onCancel()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
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
        <h3
          style={{
            margin: 0,
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            fontSize: 24,
          }}
        >
          Delete this post?
        </h3>
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            color: "var(--color-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          This post will be marked as deleted and hidden from active views.
        </p>
        <p
          style={{
            marginTop: 10,
            color: "var(--color-cream)",
            fontFamily: "var(--font-sans)",
            fontSize: 18,
          }}
        >
          {previewText}
        </p>
        {errorMessage && (
          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              border: "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              color: "var(--color-danger)",
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
          >
            {errorMessage}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button
            onClick={onCancel}
            disabled={busy}
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
