import { eq, like, and } from "drizzle-orm";
import { sensitiveWords, type InsertSensitiveWord, type SensitiveWord } from "../drizzle/schema";
import { getDb } from "./db";

const STANDARD_SENSITIVE_WORDS: Array<{
  word: string;
  category: string;
  isRegex?: boolean;
  severity?: "low" | "medium" | "high";
  replacement?: string;
}> = [
  { word: "反动", category: "政治", severity: "high" },
  { word: "颠覆", category: "政治", severity: "high" },
  { word: "分裂", category: "政治", severity: "high" },
  { word: "恐怖组织", category: "政治", severity: "high" },
  { word: "极端主义", category: "政治", severity: "high" },
  { word: "邪教", category: "政治", severity: "high" },

  { word: "暴力", category: "暴力", severity: "medium" },
  { word: "血腥", category: "暴力", severity: "medium" },
  { word: "虐杀", category: "暴力", severity: "high" },
  { word: "屠杀", category: "暴力", severity: "high" },

  { word: "色情", category: "色情", severity: "high" },
  { word: "淫秽", category: "色情", severity: "high" },
  { word: "成人视频", category: "色情", severity: "high" },
  { word: "裸体", category: "色情", severity: "medium" },
  { word: "裸聊", category: "色情", severity: "high" },

  { word: "赌博", category: "赌博", severity: "high" },
  { word: "博彩", category: "赌博", severity: "high" },
  { word: "私彩", category: "赌博", severity: "high" },

  { word: "毒品", category: "毒品", severity: "high" },
  { word: "吸毒", category: "毒品", severity: "high" },
  { word: "贩毒", category: "毒品", severity: "high" },

  { word: "代开", category: "广告", severity: "medium" },
  { word: "代刷", category: "广告", severity: "medium" },
  { word: "加群", category: "广告", severity: "medium" },
  { word: "私信", category: "广告", severity: "low" },
  { word: "引流", category: "广告", severity: "medium" },
  { word: "推广", category: "广告", severity: "low" },
  { word: "返利", category: "广告", severity: "medium" },
  { word: "vx", category: "广告", severity: "medium" },
  { word: "V信", category: "广告", severity: "medium" },
  { word: "微信号", category: "广告", severity: "medium" },
  { word: "QQ号", category: "广告", severity: "medium" },

  { word: "诈骗", category: "诈骗", severity: "high" },
  { word: "刷流水", category: "诈骗", severity: "high" },
  { word: "洗钱", category: "诈骗", severity: "high" },
  { word: "网贷", category: "诈骗", severity: "medium" },

  { word: "买卖账号", category: "违规", severity: "medium" },
  { word: "外挂", category: "违规", severity: "medium" },
  { word: "代练", category: "违规", severity: "medium" },

  { word: "傻逼", category: "辱骂", severity: "medium" },
  { word: "垃圾", category: "辱骂", severity: "low" },
  { word: "畜生", category: "辱骂", severity: "medium" },

  { word: "(?<!\\d)1\\d{10}(?!\\d)", category: "广告", isRegex: true, severity: "high" },
  { word: "(?i)\\bhttps?://\\S+\\b", category: "广告", isRegex: true, severity: "high" },
  { word: "(?i)\\bwww\\.[^\\s]+\\b", category: "广告", isRegex: true, severity: "high" },
  { word: "(?i)\\b(vx|wechat|weixin)\\b", category: "广告", isRegex: true, severity: "medium" },
  { word: "(?i)\\bqq\\b\\s*[:：]?\\s*\\d{5,12}", category: "广告", isRegex: true, severity: "high" },
];

function normalizeWordKey(input: { word: string; category: string; isRegex?: boolean }) {
  const word = (input.word ?? "").trim();
  const category = (input.category ?? "").trim();
  const isRegex = input.isRegex ? "1" : "0";
  return `${category}||${isRegex}||${word}`;
}

export async function importStandardSensitiveWords(createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ word: sensitiveWords.word, category: sensitiveWords.category, isRegex: sensitiveWords.isRegex })
    .from(sensitiveWords);

  const existingSet = new Set(existing.map(w => normalizeWordKey(w)));

  const candidates = STANDARD_SENSITIVE_WORDS.filter(w => w.word && w.category).map(w => ({
    word: w.word.trim(),
    category: w.category.trim(),
    isRegex: w.isRegex ?? false,
    severity: w.severity ?? "medium",
    replacement: w.replacement,
  }));

  const toInsert: InsertSensitiveWord[] = [];
  for (const w of candidates) {
    const key = normalizeWordKey(w);
    if (existingSet.has(key)) continue;
    existingSet.add(key);
    toInsert.push({ ...w, createdBy });
  }

  if (toInsert.length > 0) {
    await db.insert(sensitiveWords).values(toInsert);
  }

  return {
    total: candidates.length,
    inserted: toInsert.length,
    skipped: candidates.length - toInsert.length,
  };
}

export async function createSensitiveWord(word: InsertSensitiveWord): Promise<SensitiveWord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(sensitiveWords).values(word);
  const [created] = await db.select().from(sensitiveWords).where(eq(sensitiveWords.id, Number(result.insertId)));
  return created!;
}

export async function getSensitiveWords(filters?: {
  category?: string;
  search?: string;
}): Promise<SensitiveWord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(sensitiveWords.category, filters.category));
  }
  if (filters?.search) {
    conditions.push(like(sensitiveWords.word, `%${filters.search}%`));
  }

  if (conditions.length > 0) {
    return await db.select().from(sensitiveWords).where(and(...conditions));
  }
  return await db.select().from(sensitiveWords);
}

export async function getSensitiveWordById(id: number): Promise<SensitiveWord | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [word] = await db.select().from(sensitiveWords).where(eq(sensitiveWords.id, id));
  return word;
}

export async function updateSensitiveWord(id: number, updates: Partial<InsertSensitiveWord>): Promise<SensitiveWord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(sensitiveWords).set(updates).where(eq(sensitiveWords.id, id));
  const [updated] = await db.select().from(sensitiveWords).where(eq(sensitiveWords.id, id));
  return updated!;
}

export async function deleteSensitiveWord(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(sensitiveWords).where(eq(sensitiveWords.id, id));
}

export async function bulkDeleteSensitiveWords(ids: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const id of ids) {
    await db.delete(sensitiveWords).where(eq(sensitiveWords.id, id));
  }
}

export async function bulkCreateSensitiveWords(words: InsertSensitiveWord[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (words.length > 0) {
    await db.insert(sensitiveWords).values(words);
  }
}

export async function getCategories(): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db.select({ category: sensitiveWords.category }).from(sensitiveWords);
  const categorySet = new Set(results.map(r => r.category));
  const uniqueCategories = Array.from(categorySet);
  return uniqueCategories;
}
