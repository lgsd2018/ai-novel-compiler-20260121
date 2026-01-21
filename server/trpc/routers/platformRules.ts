import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import {
  createPlatformRule,
  getPlatformRules,
  getLatestPlatformRule,
  getPlatformRuleById,
  updatePlatformRule,
  deletePlatformRule,
  activatePlatformRule,
  getAllPlatforms,
} from "../../db/platformRulesDb";

export const platformRulesRouter = router({
  // Get all platforms
  getAllPlatforms: protectedProcedure.query(async () => {
    return await getAllPlatforms();
  }),

  // Get rules for a specific platform
  getRules: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      })
    )
    .query(async ({ input }) => {
      return await getPlatformRules(input.platform);
    }),

  // Get latest active rule for a platform
  getLatestRule: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      })
    )
    .query(async ({ input }) => {
      return await getLatestPlatformRule(input.platform);
    }),

  // Get rule by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getPlatformRuleById(input.id);
    }),

  // Create a new rule
  create: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        ruleType: z.string(),
        ruleName: z.string(),
        ruleValue: z.any(),
        description: z.string().optional(),
        version: z.string().default("1.0"),
        isActive: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const ruleId = await createPlatformRule(input);
      return { id: ruleId, success: true };
    }),

  // Update a rule
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        ruleType: z.string().optional(),
        ruleName: z.string().optional(),
        ruleValue: z.any().optional(),
        description: z.string().optional(),
        version: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await updatePlatformRule(id, updates);
      return { success: true };
    }),

  // Delete a rule
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePlatformRule(input.id);
      return { success: true };
    }),

  // Activate a rule (deactivates all other rules for the same platform)
  activate: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await activatePlatformRule(input.platform, input.id);
      return { success: true };
    }),

  // Batch create default rules for a platform
  createDefaults: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      })
    )
    .mutation(async ({ input }) => {
      const { platform } = input;

      // Default rules based on platform
      const defaultRules = getDefaultRulesForPlatform(platform);

      const ruleIds = [];
      for (const rule of defaultRules) {
        const ruleId = await createPlatformRule({
          platform,
          ...rule,
        });
        ruleIds.push(ruleId);
      }

      return { success: true, ruleIds };
    }),
});

// Helper function to get default rules for each platform
function getDefaultRulesForPlatform(platform: string) {
  const commonRules = [
    {
      ruleType: "word_count",
      ruleName: "章节字数限制",
      ruleValue: { min: 2000, max: 10000 },
      description: "每章字数应在2000-10000字之间",
      version: "1.0",
      isActive: true,
    },
    {
      ruleType: "chapter_title",
      ruleName: "章节标题规则",
      ruleValue: {
        maxLength: 50,
        pattern: "^第[零一二三四五六七八九十百千万\\d]+章",
        required: true,
      },
      description: "章节标题必须以'第X章'开头，长度不超过50字",
      version: "1.0",
      isActive: true,
    },
    {
      ruleType: "sensitive_words",
      ruleName: "敏感词检测",
      ruleValue: {
        enabled: true,
        action: "warn", // warn, block
      },
      description: "检测并警告敏感词",
      version: "1.0",
      isActive: true,
    },
  ];

  if (platform === "qidian") {
    return [
      ...commonRules,
      {
        ruleType: "tags",
        ruleName: "标签数量限制",
        ruleValue: { min: 3, max: 5 },
        description: "作品标签数量应在3-5个之间",
        version: "1.0",
        isActive: true,
      },
      {
        ruleType: "category",
        ruleName: "分类要求",
        ruleValue: {
          required: true,
          categories: ["玄幻", "奇幻", "武侠", "仙侠", "都市", "历史", "军事", "游戏", "科幻", "灵异"],
        },
        description: "必须选择一个主分类",
        version: "1.0",
        isActive: true,
      },
    ];
  } else if (platform === "jinjiang") {
    return [
      ...commonRules,
      {
        ruleType: "tags",
        ruleName: "标签数量限制",
        ruleValue: { min: 1, max: 10 },
        description: "作品标签数量应在1-10个之间",
        version: "1.0",
        isActive: true,
      },
      {
        ruleType: "category",
        ruleName: "分类要求",
        ruleValue: {
          required: true,
          categories: ["原创", "言情", "纯爱", "百合", "衍生"],
        },
        description: "必须选择一个主分类",
        version: "1.0",
        isActive: true,
      },
      {
        ruleType: "content_rating",
        ruleName: "内容分级",
        ruleValue: {
          required: true,
          ratings: ["非限制级", "限制级"],
        },
        description: "必须选择内容分级",
        version: "1.0",
        isActive: true,
      },
    ];
  }

  return commonRules;
}
