import type { SubscriptionTier } from "./types";

export interface FeatureLimits {
  maxThreadLength: number;
  maxScheduledPosts: number;
  maxCharactersPerPost: number;
  analyticsRetentionDays: number;
  canScheduleBulk: boolean;
  prioritySupport: boolean;
}

const TIER_LIMITS: Record<SubscriptionTier, FeatureLimits> = {
  Basic: {
    maxThreadLength: 5,
    maxScheduledPosts: 50,
    maxCharactersPerPost: 280,
    analyticsRetentionDays: 30,
    canScheduleBulk: false,
    prioritySupport: false,
  },
  Premium: {
    maxThreadLength: 25,
    maxScheduledPosts: 200,
    maxCharactersPerPost: 25000,
    analyticsRetentionDays: 90,
    canScheduleBulk: true,
    prioritySupport: false,
  },
  PremiumPlus: {
    maxThreadLength: Infinity,
    maxScheduledPosts: Infinity,
    maxCharactersPerPost: 25000,
    analyticsRetentionDays: 365,
    canScheduleBulk: true,
    prioritySupport: true,
  },
};

function normalizeTier(tier: string | null | undefined): SubscriptionTier {
  if (!tier) return "Basic";

  // Handle exact matches
  if (tier === "Basic" || tier === "Premium" || tier === "PremiumPlus") {
    return tier as SubscriptionTier;
  }

  // Handle case variations
  const lowerTier = tier.toLowerCase();
  if (lowerTier === "basic") return "Basic";
  if (lowerTier === "premium") return "Premium";
  if (lowerTier === "premiumplus" || lowerTier === "premium_plus") return "PremiumPlus";

  // Unknown tier - default to Basic
  return "Basic";
}

export function getFeatureLimits(tier: SubscriptionTier | string | null | undefined): FeatureLimits {
  const normalizedTier = normalizeTier(tier as string | null);
  return TIER_LIMITS[normalizedTier];
}

export function canAccessFeature(
  tier: SubscriptionTier | string | null | undefined,
  feature: keyof FeatureLimits
): boolean {
  const limits = getFeatureLimits(tier);
  const value = limits[feature];
  return typeof value === "boolean" ? value : true;
}

export function getUpgradeMessage(tier: SubscriptionTier | string | null | undefined): string {
  const normalizedTier = normalizeTier(tier as string | null);
  if (normalizedTier === "Basic") {
    return "Upgrade to Premium to unlock longer threads, more scheduled posts, and bulk scheduling.";
  }
  if (normalizedTier === "Premium") {
    return "Upgrade to Premium+ for unlimited threads, posts, and priority support.";
  }
  return "";
}
