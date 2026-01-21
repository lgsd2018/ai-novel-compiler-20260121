import { getDb } from "../db";
import { agentLogs, InsertAgentLog } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export async function createAgentLog(log: InsertAgentLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  const result = await db.insert(agentLogs).values(log);
  return result[0].insertId;
}

export async function getAgentLogs(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 50, offset = 0, status } = options;
  
  let query = db.select()
    .from(agentLogs)
    .where(and(
      eq(agentLogs.userId, userId),
      status ? eq(agentLogs.status, status as any) : undefined
    ))
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return await query;
}

export async function updateAgentLogStatus(userId: number, logId: number, status: InsertAgentLog["status"]) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(agentLogs)
    .set({ status })
    .where(and(eq(agentLogs.userId, userId), eq(agentLogs.id, logId)));

  return true;
}
