import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { platformRules, InsertPlatformRule } from "../../drizzle/schema";

// ============= Platform Rules Operations =============

export type Platform = "qidian" | "jinjiang" | "zongheng" | "17k";

export type PlatformRulePreset = {
  ruleType: string;
  ruleName: string;
  ruleValue: any;
  description: string;
};

export async function createPlatformRule(rule: InsertPlatformRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(platformRules).values(rule);
  return result[0].insertId;
}

export async function getPlatformRules(platform: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(platformRules)
    .where(eq(platformRules.platform, platform as any))
    .orderBy(desc(platformRules.version));
}

export async function getLatestPlatformRule(platform: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformRules)
    .where(and(eq(platformRules.platform, platform as any), eq(platformRules.isActive, true)))
    .orderBy(desc(platformRules.version))
    .limit(1);
  return result[0];
}

export async function getActivePlatformRules(platform: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(platformRules)
    .where(and(eq(platformRules.platform, platform as any), eq(platformRules.isActive, true)));
}

export async function getPlatformRuleById(ruleId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformRules)
    .where(eq(platformRules.id, ruleId))
    .limit(1);
  return result[0];
}

export async function updatePlatformRule(
  ruleId: number,
  updates: Partial<InsertPlatformRule>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(platformRules).set(updates).where(eq(platformRules.id, ruleId));
}

export async function deletePlatformRule(ruleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(platformRules).where(eq(platformRules.id, ruleId));
}

export async function activatePlatformRule(platform: string, ruleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rule = await getPlatformRuleById(ruleId);
  if (!rule) throw new Error("Rule not found");
  if (rule.platform !== platform) throw new Error("Rule does not belong to this platform");

  await db
    .update(platformRules)
    .set({ isActive: false })
    .where(
      and(
        eq(platformRules.platform, platform as any),
        eq(platformRules.ruleType, rule.ruleType)
      )
    );

  await db
    .update(platformRules)
    .set({ isActive: true })
    .where(eq(platformRules.id, ruleId));
}

export async function getAllPlatforms() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(platformRules);
  
  // Get unique platforms
  const platformSet = new Set(result.map((r) => r.platform));
  return Array.from(platformSet);
}

export function getPresetPlatformRules(platform: Platform): PlatformRulePreset[] {
  const common: PlatformRulePreset[] = [
    {
      ruleType: "sensitive_words",
      ruleName: "敏感词检测（建议开启）",
      description: "发布前进行敏感词扫描；具体敏感词库与处置以平台审核为准。",
      ruleValue: {
        enabled: true,
        blockPublishOnHighSeverity: true,
        severityThreshold: "high",
        useDatabaseWordlist: true,
      },
    },
  ];

  if (platform === "qidian") {
    return [
      ...common,
      {
        ruleType: "chapter_title",
        ruleName: "章节标题限制（起点）",
        description: "默认与系统发布前预检查一致；实际以作者后台提示为准。",
        ruleValue: {
          minLength: 1,
          maxLength: 50,
          forbidChars: ["\n", "\r", "\t"],
        },
      },
      {
        ruleType: "word_count",
        ruleName: "章节字数限制（起点）",
        description: "默认与系统发布前预检查一致：低于下限会拦截，超过上限会提示拆分。",
        ruleValue: { min: 1000, max: 10000 },
      },
      {
        ruleType: "tags",
        ruleName: "标签数量（起点）",
        description: "标签数量建议值；实际可选数量以作者后台为准。",
        ruleValue: { min: 0, max: 5 },
      },
      {
        ruleType: "category",
        ruleName: "分类要求（起点）",
        description: "建议选择主分类与子分类；此处给出示例字段。",
        ruleValue: {
          required: true,
          fields: ["main", "sub"],
          examples: [{ main: "玄幻", sub: "东方玄幻" }],
        },
      },
      {
        ruleType: "content_rating",
        ruleName: "内容分级（起点）",
        description: "用于内部提示与自查；平台实际分级/审核口径可能不同。",
        ruleValue: { allowed: ["all", "teen", "mature"], default: "all" },
      },
    ];
  }

  if (platform === "jinjiang") {
    return [
      ...common,
      {
        ruleType: "chapter_title",
        ruleName: "章节标题限制（晋江）",
        description: "默认与系统发布前预检查一致；实际以作者后台提示为准。",
        ruleValue: {
          minLength: 1,
          maxLength: 30,
          forbidChars: ["\n", "\r", "\t"],
        },
      },
      {
        ruleType: "word_count",
        ruleName: "章节字数限制（晋江）",
        description: "默认与系统发布前预检查一致：低于下限会拦截，超过上限会提示拆分。",
        ruleValue: { min: 500, max: 15000 },
      },
      {
        ruleType: "tags",
        ruleName: "标签数量（晋江）",
        description: "标签数量建议值；实际可选数量以作者后台为准。",
        ruleValue: { min: 0, max: 10 },
      },
      {
        ruleType: "category",
        ruleName: "分类与题材（晋江）",
        description: "建议填写题材/视角/风格等；示例字段可自行扩展。",
        ruleValue: {
          required: true,
          fields: ["genre", "audience", "style"],
          examples: [{ genre: "言情", audience: "女主", style: "轻松" }],
        },
      },
      {
        ruleType: "content_rating",
        ruleName: "内容分级（晋江）",
        description: "用于内部提示与自查；平台实际字段与选项以作者后台为准。",
        ruleValue: { allowed: ["non_restricted", "restricted"], default: "non_restricted" },
      },
    ];
  }

  if (platform === "zongheng") {
    return [
      ...common,
      {
        ruleType: "chapter_title",
        ruleName: "章节标题限制（纵横）",
        description: "默认与系统发布前预检查一致；实际以作者后台提示为准。",
        ruleValue: {
          minLength: 1,
          maxLength: 40,
          forbidChars: ["\n", "\r", "\t"],
        },
      },
      {
        ruleType: "word_count",
        ruleName: "章节字数限制（纵横）",
        description: "默认与系统发布前预检查一致：低于下限会拦截，超过上限会提示拆分。",
        ruleValue: { min: 800, max: 12000 },
      },
      {
        ruleType: "tags",
        ruleName: "标签数量（纵横）",
        description: "标签数量建议值；实际可选数量以作者后台为准。",
        ruleValue: { min: 0, max: 6 },
      },
      {
        ruleType: "category",
        ruleName: "分类要求（纵横）",
        description: "建议选择主分类与子分类；此处给出示例字段。",
        ruleValue: {
          required: true,
          fields: ["main", "sub"],
          examples: [{ main: "都市", sub: "都市生活" }],
        },
      },
      {
        ruleType: "content_rating",
        ruleName: "内容分级（纵横）",
        description: "用于内部提示与自查；平台实际分级/审核口径可能不同。",
        ruleValue: { allowed: ["all", "teen", "mature"], default: "all" },
      },
    ];
  }

  return [
    ...common,
    {
      ruleType: "chapter_title",
      ruleName: "章节标题限制（17K）",
      description: "默认与系统发布前预检查一致；实际以作者后台提示为准。",
      ruleValue: {
        minLength: 1,
        maxLength: 50,
        forbidChars: ["\n", "\r", "\t"],
      },
    },
    {
      ruleType: "word_count",
      ruleName: "章节字数限制（17K）",
      description: "默认与系统发布前预检查一致：低于下限会拦截，超过上限会提示拆分。",
      ruleValue: { min: 1000, max: 8000 },
    },
    {
      ruleType: "work_word_count",
      ruleName: "直签申请字数门槛（17K）",
      description:
        "用于内部提示与自查：官方福利说明中提到首发作品超过8000字后可在后台申请一键直签；实际以作者后台提示为准。",
      ruleValue: {
        min: 8000,
        scope: "work_total_words",
        action: "apply_direct_contract",
      },
    },
    {
      ruleType: "submission_requirements",
      ruleName: "买断/保底申请基础材料（17K）",
      description:
        "用于内部提示与自查：官方福利说明中提到申请买断/保底需至少完成2万字且有剧情提纲；实际以作者后台/编辑要求为准。",
      ruleValue: {
        minWorkWords: 20000,
        requiresOutline: true,
        recommendedAttachments: ["doc正文", "提纲"],
      },
    },
    {
      ruleType: "tags",
      ruleName: "标签数量（17K）",
      description: "标签数量建议值；实际可选数量以作者后台为准。",
      ruleValue: { min: 0, max: 8 },
    },
    {
      ruleType: "category",
      ruleName: "分类要求（17K）",
      description: "建议选择主分类与子分类；此处给出示例字段。",
      ruleValue: {
        required: true,
        fields: ["main", "sub"],
        examples: [{ main: "悬疑", sub: "侦探推理" }],
      },
    },
    {
      ruleType: "content_rating",
      ruleName: "内容分级（17K）",
      description: "用于内部提示与自查；平台实际分级/审核口径可能不同。",
      ruleValue: { allowed: ["all", "teen", "mature"], default: "all" },
    },
  ];
}

export async function importPresetPlatformRules(
  platform: Platform,
  options?: { activate?: boolean; version?: string }
) {
  const activate = options?.activate ?? true;
  const version = options?.version ?? "preset-1.0";

  const presets = getPresetPlatformRules(platform);
  const existing = await getPlatformRules(platform);
  const existingKeySet = new Set(existing.map((r) => `${r.ruleType}::${r.ruleName}`));

  const createdIds: number[] = [];
  let createdCount = 0;
  let skippedCount = 0;

  for (const preset of presets) {
    const key = `${preset.ruleType}::${preset.ruleName}`;
    if (existingKeySet.has(key)) {
      skippedCount += 1;
      continue;
    }

    const ruleId = await createPlatformRule({
      platform,
      ruleType: preset.ruleType,
      ruleName: preset.ruleName,
      ruleValue: preset.ruleValue,
      description: preset.description,
      version,
      isActive: activate,
    } as any);

    createdIds.push(ruleId);
    createdCount += 1;
    existingKeySet.add(key);

    if (activate) {
      await activatePlatformRule(platform, ruleId);
    }
  }

  return { createdCount, skippedCount, createdIds };
}
