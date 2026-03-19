import type { SubscriptionTier } from "../lib/types";

interface PremiumBadgeProps {
  tier: SubscriptionTier | string | null;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG: Record<SubscriptionTier, { label: string; color: string; gradient: string }> = {
  Basic: {
    label: "Free",
    color: "#545B73",
    gradient: "linear-gradient(135deg, #545B73 0%, #3A3F52 100%)",
  },
  Premium: {
    label: "Premium",
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
  },
  PremiumPlus: {
    label: "Premium+",
    color: "#9D4EDD",
    gradient: "linear-gradient(135deg, #9D4EDD 0%, #6A1B9A 100%)",
  },
};

function normalizeTier(tier: string | null | undefined): SubscriptionTier | null {
  if (!tier) return null;

  // Handle exact matches
  if (tier === "Basic" || tier === "Premium" || tier === "PremiumPlus") {
    return tier as SubscriptionTier;
  }

  // Handle case variations
  const lowerTier = tier.toLowerCase();
  if (lowerTier === "basic") return "Basic";
  if (lowerTier === "premium") return "Premium";
  if (lowerTier === "premiumplus" || lowerTier === "premium_plus") return "PremiumPlus";

  // Unknown tier - treat as Basic
  return null;
}

export default function PremiumBadge({ tier, size = "md" }: PremiumBadgeProps) {
  const normalizedTier = normalizeTier(tier as string | null);

  // Don't show badge for Basic/Free tier or unknown tiers
  if (!normalizedTier || normalizedTier === "Basic") {
    return null;
  }

  const config = TIER_CONFIG[normalizedTier];

  // Extra safety check
  if (!config) {
    return null;
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-[11px] gap-1.5",
    lg: "px-3 py-1.5 text-xs gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size]} rounded-full font-bold uppercase tracking-widest`}
      style={{
        background: config.gradient,
        color: "#FFFFFF",
        boxShadow: `0 2px 12px ${config.color}40`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: iconSizes[size], fontWeight: 700 }}>
        {normalizedTier === "PremiumPlus" ? "workspace_premium" : "verified"}
      </span>
      {config.label}
    </div>
  );
}
