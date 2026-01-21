import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  platformAccounts,
  publishingTasks,
  publishingLogs,
  InsertPlatformAccount,
  InsertPublishingTask,
  InsertPublishingLog,
} from "../drizzle/schema";

/**
 * Platform Account Management
 */

export async function createPlatformAccount(account: InsertPlatformAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(platformAccounts).values(account);
  return result.insertId;
}

export async function getPlatformAccountsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.isActive, true)));
}

export async function getPlatformAccount(accountId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);

  return results[0];
}

export async function updatePlatformAccount(
  accountId: number,
  updates: Partial<InsertPlatformAccount>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(platformAccounts)
    .set(updates)
    .where(eq(platformAccounts.id, accountId));
}

export async function deletePlatformAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(platformAccounts)
    .set({ isActive: false })
    .where(eq(platformAccounts.id, accountId));
}

/**
 * Publishing Task Management
 */

export async function createPublishingTask(task: InsertPublishingTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(publishingTasks).values(task);
  return result.insertId;
}

export async function getPublishingTasksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(publishingTasks)
    .where(eq(publishingTasks.userId, userId))
    .orderBy(desc(publishingTasks.createdAt));
}

export async function getPublishingTasksByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(publishingTasks)
    .where(eq(publishingTasks.projectId, projectId))
    .orderBy(desc(publishingTasks.createdAt));
}

export async function getPublishingTask(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(publishingTasks)
    .where(eq(publishingTasks.id, taskId))
    .limit(1);

  return results[0];
}

export async function updatePublishingTask(
  taskId: number,
  updates: Partial<InsertPublishingTask>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(publishingTasks)
    .set(updates)
    .where(eq(publishingTasks.id, taskId));
}

/**
 * Publishing Log Management
 */

export async function createPublishingLog(log: InsertPublishingLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(publishingLogs).values(log);
}

export async function getPublishingLogs(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(publishingLogs)
    .where(eq(publishingLogs.taskId, taskId))
    .orderBy(desc(publishingLogs.createdAt));
}

/**
 * Helper: Encrypt password (simple base64, should use proper encryption in production)
 */
export function encryptPassword(password: string): string {
  return Buffer.from(password).toString("base64");
}

/**
 * Helper: Decrypt password
 */
export function decryptPassword(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}
