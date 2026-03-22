import type { CSSProperties, ReactNode } from "react";
import type { Post } from "../lib/types";

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
  maxWidth = "980px",
}: PostDetailsModalProps) {
  if (!isOpen) return null;

  const media = post?.media ?? [];
  const currentMedia = media[activeMediaIndex] ?? null;
  const currentSrc = currentMedia
    ? mediaUrls[currentMedia.key] ?? currentMedia.public_url
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
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
          width: `min(${maxWidth}, 100%)`,
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, #000), var(--color-surface))",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "var(--color-cream)",
              fontFamily: "var(--font-sans)",
              fontSize: 28,
            }}
          >
            Post Details
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--color-cream)",
              fontSize: 28,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {loading && (
          <p
            style={{
              color: "var(--color-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            Loading post details...
          </p>
        )}
        {error && (
          <p
            style={{
              color: "var(--color-danger)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}

        {post && (
          <>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 14,
                padding: 14,
                background:
                  "color-mix(in srgb, var(--color-ink) 18%, transparent)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  {post.status}
                </span>
                {post.scheduled_for && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-accent)",
                    }}
                  >
                    Scheduled {new Date(post.scheduled_for).toLocaleString()}
                  </span>
                )}
                {post.published_at && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-success)",
                    }}
                  >
                    Published {new Date(post.published_at).toLocaleString()}
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-cream)",
                  fontSize: 22,
                  lineHeight: 1.3,
                  fontFamily: "var(--font-sans)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {post.content}
              </p>

              {quoteSourceContent && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    border:
                      "1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border))",
                    background:
                      "color-mix(in srgb, var(--color-ink) 28%, transparent)",
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
                    {quoteSourceContent}
                  </p>
                </div>
              )}

              {!!media.length && (
                <div style={{ marginTop: 12 }}>
                  {currentMedia && (
                    <div
                      style={{
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        background: "#000",
                        position: "relative",
                      }}
                    >
                      {currentMedia.content_type?.startsWith("video/") ? (
                        <video
                          controls
                          src={currentSrc ?? undefined}
                          style={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
                        />
                      ) : (
                        <img
                          src={currentSrc ?? undefined}
                          alt={currentMedia.file_name ?? "Post media"}
                          style={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
                        />
                      )}

                      {media.length > 1 && (
                        <>
                          <button
                            onClick={() =>
                              onActiveMediaIndexChange(
                                (activeMediaIndex - 1 + media.length) % media.length,
                              )
                            }
                            style={carouselArrowButton("left")}
                          >
                            ‹
                          </button>
                          <button
                            onClick={() =>
                              onActiveMediaIndexChange((activeMediaIndex + 1) % media.length)
                            }
                            style={carouselArrowButton("right")}
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {actions && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {actions}
              </div>
            )}

            {children}
          </>
        )}
      </div>
    </div>
  );
}

function carouselArrowButton(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    border: "1px solid var(--color-border)",
    background: "rgba(9,13,22,0.7)",
    color: "var(--color-cream)",
    width: 34,
    height: 34,
    borderRadius: 999,
    fontSize: 20,
    lineHeight: 1,
  };
}
