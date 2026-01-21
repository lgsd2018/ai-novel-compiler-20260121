/**
 * Stripe Products and Pricing Configuration
 * 
 * Define subscription tiers and pricing for the AI Novel Compiler
 */

export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: "免费版",
    priceId: null, // No Stripe price for free tier
    features: [
      "1个项目",
      "基础AI辅助（每月100次）",
      "1GB存储空间",
      "基础导出功能",
    ],
    limits: {
      maxProjects: 1,
      maxAiCalls: 100,
      maxStorage: 1024 * 1024 * 1024, // 1GB in bytes
      maxCollaborators: 0,
    },
  },
  
  BASIC: {
    name: "基础版",
    priceId: process.env.STRIPE_BASIC_PRICE_ID || "price_basic", // Set in Stripe Dashboard
    price: 29, // USD per month
    features: [
      "5个项目",
      "AI辅助（每月1000次）",
      "10GB存储空间",
      "完整导出功能",
      "协作功能（3人）",
    ],
    limits: {
      maxProjects: 5,
      maxAiCalls: 1000,
      maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
      maxCollaborators: 3,
    },
  },
  
  PRO: {
    name: "专业版",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
    price: 79, // USD per month
    features: [
      "无限项目",
      "AI辅助（每月5000次）",
      "100GB存储空间",
      "高级导出和发布",
      "协作功能（10人）",
      "优先支持",
    ],
    limits: {
      maxProjects: -1, // Unlimited
      maxAiCalls: 5000,
      maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
      maxCollaborators: 10,
    },
  },
  
  ENTERPRISE: {
    name: "企业版",
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise",
    price: 299, // USD per month
    features: [
      "无限项目",
      "AI辅助（无限）",
      "1TB存储空间",
      "完整功能",
      "无限协作",
      "专属客户经理",
      "SLA保障",
    ],
    limits: {
      maxProjects: -1,
      maxAiCalls: -1, // Unlimited
      maxStorage: 1024 * 1024 * 1024 * 1024, // 1TB
      maxCollaborators: -1, // Unlimited
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

/**
 * Get subscription tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  for (const [tier, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (config.priceId === priceId) {
      return tier as SubscriptionTier;
    }
  }
  return "FREE";
}

/**
 * Check if user has reached limit for a feature
 */
export function checkLimit(
  tier: SubscriptionTier,
  feature: keyof typeof SUBSCRIPTION_TIERS.FREE.limits,
  currentUsage: number
): boolean {
  const limit = SUBSCRIPTION_TIERS[tier].limits[feature];
  if (limit === -1) return true; // Unlimited
  return currentUsage < limit;
}
