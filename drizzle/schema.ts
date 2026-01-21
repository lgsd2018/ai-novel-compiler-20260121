import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal, binary, datetime } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["FREE", "BASIC", "PRO", "ENTERPRISE"]).default("FREE").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "trialing"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table - 小说项目
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  templateType: varchar("templateType", { length: 50 }), // novel, script, etc.
  coverImageUrl: text("coverImageUrl"),
  coverImageKey: text("coverImageKey"),
  status: mysqlEnum("status", ["draft", "writing", "completed", "archived"]).default("draft").notNull(),
  wordCount: int("wordCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Documents table - 文档（章节、设定、大纲等）
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  parentId: int("parentId"), // for folder structure
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["chapter", "character", "setting", "outline", "worldview", "folder"]).notNull(),
  content: text("content"), // Markdown content
  order: int("order").default(0).notNull(), // for sorting
  wordCount: int("wordCount").default(0).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Document versions table - 文档版本历史
 */
export const documentVersions = mysqlTable("documentVersions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  content: text("content").notNull(),
  wordCount: int("wordCount").default(0).notNull(),
  versionNumber: int("versionNumber").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

/**
 * Characters table - 角色卡片
 */
export const characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatarUrl"),
  avatarKey: text("avatarKey"),
  appearance: text("appearance"),
  personality: text("personality"),
  background: text("background"),
  role: varchar("role", { length: 100 }), // protagonist, antagonist, supporting, etc.
  age: int("age"),
  gender: varchar("gender", { length: 50 }),
  customFields: json("customFields"), // flexible additional fields
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;

/**
 * Character relationships table - 角色关系
 */
export const characterRelationships = mysqlTable("characterRelationships", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  characterAId: int("characterAId").notNull(),
  characterBId: int("characterBId").notNull(),
  relationshipType: varchar("relationshipType", { length: 100 }).notNull(), // family, friend, enemy, lover, etc.
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CharacterRelationship = typeof characterRelationships.$inferSelect;
export type InsertCharacterRelationship = typeof characterRelationships.$inferInsert;

/**
 * Story timeline nodes table - 故事线节点
 */
export const timelineNodes = mysqlTable("timelineNodes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  nodeType: mysqlEnum("nodeType", ["event", "decision", "branch", "merge"]).notNull(),
  timePosition: int("timePosition").notNull(), // x-axis position
  groupPosition: int("groupPosition").default(0).notNull(), // y-axis position for branches
  documentId: int("documentId"), // linked to chapter/document
  characterIds: json("characterIds"), // array of character IDs involved
  tags: json("tags"), // array of tags
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TimelineNode = typeof timelineNodes.$inferSelect;
export type InsertTimelineNode = typeof timelineNodes.$inferInsert;

/**
 * Timeline connections table - 故事线连接
 */
export const timelineConnections = mysqlTable("timelineConnections", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceNodeId: int("sourceNodeId").notNull(),
  targetNodeId: int("targetNodeId").notNull(),
  sourceHandle: varchar("sourceHandle", { length: 50 }),
  targetHandle: varchar("targetHandle", { length: 50 }),
  connectionType: varchar("connectionType", { length: 50 }).default("normal").notNull(), // normal, branch, merge
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimelineConnection = typeof timelineConnections.$inferSelect;
export type InsertTimelineConnection = typeof timelineConnections.$inferInsert;

/**
 * AI model configurations table - AI模型配置
 */
export const aiModelConfigs = mysqlTable("aiModelConfigs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(), // deepseek, openai, glm, etc.
  modelName: varchar("modelName", { length: 255 }).notNull(),
  apiKey: text("apiKey").notNull(), // encrypted
  apiEndpoint: text("apiEndpoint"),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  topP: decimal("topP", { precision: 3, scale: 2 }).default("0.9"),
  maxTokens: int("maxTokens").default(2000),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiModelConfig = typeof aiModelConfigs.$inferSelect;
export type InsertAiModelConfig = typeof aiModelConfigs.$inferInsert;

/**
 * AI usage logs table - AI使用记录
 */
export const aiUsageLogs = mysqlTable("aiUsageLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  documentId: int("documentId"),
  modelConfigId: int("modelConfigId").notNull(),
  operationType: varchar("operationType", { length: 100 }).notNull(), // generate, continue, optimize, rewrite, etc.
  promptTokens: int("promptTokens").default(0).notNull(),
  completionTokens: int("completionTokens").default(0).notNull(),
  totalTokens: int("totalTokens").default(0).notNull(),
  cost: decimal("cost", { precision: 10, scale: 6 }).default("0"),
  duration: int("duration"), // milliseconds
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogs.$inferInsert;

/**
 * Project collaborators table - 项目协作者
 */
export const projectCollaborators = mysqlTable("projectCollaborators", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "editor", "viewer"]).notNull(),
  permissions: json("permissions"), // granular permissions
  invitedBy: int("invitedBy").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
});

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;

/**
 * Export records table - 导出记录
 */
export const exportRecords = mysqlTable("exportRecords", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  format: varchar("format", { length: 50 }).notNull(), // pdf, epub, word, html
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileSize: int("fileSize"), // bytes
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ExportRecord = typeof exportRecords.$inferSelect;
export type InsertExportRecord = typeof exportRecords.$inferInsert;

/**
 * Writing statistics table - 写作统计
 */
export const writingStatistics = mysqlTable("writingStatistics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  date: timestamp("date").notNull(), // daily statistics
  wordsWritten: int("wordsWritten").default(0).notNull(),
  writingDuration: int("writingDuration").default(0).notNull(), // minutes
  aiGeneratedWords: int("aiGeneratedWords").default(0).notNull(),
  aiUsageCount: int("aiUsageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WritingStatistic = typeof writingStatistics.$inferSelect;
export type InsertWritingStatistic = typeof writingStatistics.$inferInsert;

/**
 * Subscription plans table - 订阅套餐
 */
export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).notNull(),
  features: json("features"), // feature limits and permissions
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User subscriptions table - 用户订阅
 */
export const userSubscriptions = mysqlTable("userSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "trial"]).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

/**
 * Tenants table - 租户（企业/团队）
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).unique(),
  ownerId: int("ownerId").notNull(),
  planId: int("planId"),
  settings: json("settings"), // custom configurations
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Tenant members table - 租户成员
 */
export const tenantMembers = mysqlTable("tenantMembers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "member"]).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type TenantMember = typeof tenantMembers.$inferSelect;
export type InsertTenantMember = typeof tenantMembers.$inferInsert;

/**
 * Platform accounts table - 平台账号配置
 */
export const platformAccounts = mysqlTable("platformAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: mysqlEnum("platform", ["qidian", "jinjiang", "zongheng", "17k"]).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  // Encrypted credentials
  encryptedPassword: text("encryptedPassword"),
  apiKey: text("apiKey"),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformAccount = typeof platformAccounts.$inferSelect;
export type InsertPlatformAccount = typeof platformAccounts.$inferInsert;

/**
 * Publishing tasks table - 发布任务
 */
export const publishingTasks = mysqlTable("publishingTasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  platformAccountId: int("platformAccountId").notNull(),
  platform: mysqlEnum("platform", ["qidian", "jinjiang", "zongheng", "17k"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  // Work info on the platform
  platformWorkId: text("platformWorkId"),
  platformWorkUrl: text("platformWorkUrl"),
  // Publishing config
  publishConfig: json("publishConfig"), // { chapters: [], coverImage, tags, etc }
  // Progress tracking
  totalChapters: int("totalChapters").default(0).notNull(),
  publishedChapters: int("publishedChapters").default(0).notNull(),
  failedChapters: int("failedChapters").default(0).notNull(),
  // Error handling
  errorMessage: text("errorMessage"),
  errorLog: text("errorLog"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type PublishingTask = typeof publishingTasks.$inferSelect;
export type InsertPublishingTask = typeof publishingTasks.$inferInsert;

/**
 * Publishing logs table - 发布日志
 */
export const publishingLogs = mysqlTable("publishingLogs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  level: mysqlEnum("level", ["info", "warning", "error"]).default("info").notNull(),
  message: text("message").notNull(),
  details: text("details"), // JSON: additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PublishingLog = typeof publishingLogs.$inferSelect;
export type InsertPublishingLog = typeof publishingLogs.$inferInsert;


// 敏感词库表
export const sensitiveWords = mysqlTable("sensitive_words", {
  id: int("id").autoincrement().primaryKey(),
  word: text("word").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // 分类：政治、色情、暴力、广告等
  isRegex: boolean("isRegex").default(false).notNull(), // 是否为正则表达式
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("medium").notNull(),
  replacement: text("replacement"), // 替换词
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SensitiveWord = typeof sensitiveWords.$inferSelect;
export type InsertSensitiveWord = typeof sensitiveWords.$inferInsert;

// 平台发布规则表
export const platformRules = mysqlTable("platform_rules", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["qidian", "jinjiang", "zongheng", "17k"]).notNull(),
  ruleType: varchar("ruleType", { length: 100 }).notNull(), // word_count, tags, category, etc.
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  ruleValue: json("ruleValue").notNull(), // flexible rule configuration
  description: text("description"),
  version: varchar("version", { length: 50 }).default("1.0").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformRule = typeof platformRules.$inferSelect;
export type InsertPlatformRule = typeof platformRules.$inferInsert;

// TTS音频缓存表
export const ttsCache = mysqlTable("tts_cache", {
  id: int("id").autoincrement().primaryKey(),
  cacheKey: varchar("cacheKey", { length: 64 }).unique().notNull(), // SHA256 hash
  audioData: text("audioData").notNull(), // 音频数据 (base64编码)
  format: varchar("format", { length: 10 }).default("mp3").notNull(), // mp3, wav, ogg
  duration: int("duration"), // 音频时长（秒）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
  accessCount: int("accessCount").default(1).notNull(), // 访问次数
});

export type TTSCache = typeof ttsCache.$inferSelect;
export type InsertTTSCache = typeof ttsCache.$inferInsert;

// AI分析结果缓存表
export const aiAnalysisCache = mysqlTable("ai_analysis_cache", {
  contentHash: varchar("content_hash", { length: 64 }).primaryKey(),
  analysisResult: json("analysis_result").notNull(),
  expiresAt: datetime("expires_at").notNull(),
  accessCount: int("access_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiAnalysisCache = typeof aiAnalysisCache.$inferSelect;
export type InsertAiAnalysisCache = typeof aiAnalysisCache.$inferInsert;

// 语音识别历史表
export const speechRecognitionHistory = mysqlTable("speech_recognition_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  documentId: int("documentId"),
  audioUrl: text("audioUrl"), // S3存储的音频文件URL
  audioFormat: varchar("audioFormat", { length: 20 }).default("webm").notNull(),
  audioDuration: int("audioDuration"), // 音频时长（秒）
  transcript: text("transcript").notNull(), // 转录文本
  language: varchar("language", { length: 10 }).default("zh").notNull(),
  recognitionType: mysqlEnum("recognitionType", ["file", "streaming"]).default("file").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }), // 识别置信度
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpeechRecognitionHistory = typeof speechRecognitionHistory.$inferSelect;
export type InsertSpeechRecognitionHistory = typeof speechRecognitionHistory.$inferInsert;

/**
 * Chat messages table - 对话历史
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["system", "user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Agent 操作日志表
export const agentLogs = mysqlTable("agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  operation: varchar("operation", { length: 50 }).notNull(), // modify_file, delete_file, etc.
  filePath: text("filePath").notNull(),
  contentBefore: text("contentBefore"), // For rollback
  contentAfter: text("contentAfter"),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "auto_approved", "reverted"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentLog = typeof agentLogs.$inferSelect;
export type InsertAgentLog = typeof agentLogs.$inferInsert;

// Extraction Rules Table
export const extractionRules = mysqlTable("extraction_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ruleType: mysqlEnum("ruleType", ["event", "character", "setting", "custom"]).notNull().default("custom"),
  fields: json("fields").notNull(), // JSON array of field definitions
  prompt: text("prompt"), // Custom prompt template
  isActive: boolean("isActive").notNull().default(true),
  priority: int("priority").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExtractionRule = typeof extractionRules.$inferSelect;
export type InsertExtractionRule = typeof extractionRules.$inferInsert;
