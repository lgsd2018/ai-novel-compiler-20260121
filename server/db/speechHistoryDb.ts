/**
 * Speech Recognition History Database Helper Functions
 * 语音识别历史数据库辅助函数
 */

import { getDb } from '../db';
import { speechRecognitionHistory, type InsertSpeechRecognitionHistory, type SpeechRecognitionHistory } from '../../drizzle/schema';
import { eq, desc, and, like, or } from 'drizzle-orm';

/**
 * 创建语音识别历史记录
 */
export async function createSpeechHistory(data: InsertSpeechRecognitionHistory): Promise<SpeechRecognitionHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(speechRecognitionHistory).values(data);
  
  if (result && result[0].insertId) {
    return await getSpeechHistoryById(Number(result[0].insertId));
  }
  
  return null;
}

/**
 * 根据ID获取语音识别历史记录
 */
export async function getSpeechHistoryById(id: number): Promise<SpeechRecognitionHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(speechRecognitionHistory)
    .where(eq(speechRecognitionHistory.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * 获取用户的语音识别历史记录列表
 */
export async function getSpeechHistoryByUser(
  userId: number,
  options?: {
    projectId?: number;
    limit?: number;
    offset?: number;
    searchText?: string;
  }
): Promise<SpeechRecognitionHistory[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select()
    .from(speechRecognitionHistory)
    .where(eq(speechRecognitionHistory.userId, userId))
    .$dynamic();

  // 按项目筛选
  if (options?.projectId) {
    query = query.where(eq(speechRecognitionHistory.projectId, options.projectId));
  }

  // 搜索文本
  if (options?.searchText) {
    query = query.where(like(speechRecognitionHistory.transcript, `%${options.searchText}%`));
  }

  // 排序和分页
  query = query
    .orderBy(desc(speechRecognitionHistory.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);

  return await query;
}

/**
 * 更新语音识别历史记录
 */
export async function updateSpeechHistory(
  id: number,
  data: Partial<InsertSpeechRecognitionHistory>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(speechRecognitionHistory)
    .set(data)
    .where(eq(speechRecognitionHistory.id, id));

  return true;
}

/**
 * 删除语音识别历史记录
 */
export async function deleteSpeechHistory(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(speechRecognitionHistory)
    .where(eq(speechRecognitionHistory.id, id));

  return true;
}

/**
 * 批量删除语音识别历史记录
 */
export async function batchDeleteSpeechHistory(ids: number[]): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  for (const id of ids) {
    await db
      .delete(speechRecognitionHistory)
      .where(eq(speechRecognitionHistory.id, id));
  }

  return true;
}

/**
 * 获取用户的语音识别历史统计
 */
export async function getSpeechHistoryStats(userId: number): Promise<{
  totalCount: number;
  totalDuration: number;
  byLanguage: Record<string, number>;
  byType: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCount: 0,
      totalDuration: 0,
      byLanguage: {},
      byType: {},
    };
  }

  const records = await db
    .select()
    .from(speechRecognitionHistory)
    .where(eq(speechRecognitionHistory.userId, userId));

  const stats = {
    totalCount: records.length,
    totalDuration: records.reduce((sum, r) => sum + (r.audioDuration || 0), 0),
    byLanguage: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  };

  records.forEach(record => {
    // 按语言统计
    stats.byLanguage[record.language] = (stats.byLanguage[record.language] || 0) + 1;
    
    // 按类型统计
    stats.byType[record.recognitionType] = (stats.byType[record.recognitionType] || 0) + 1;
  });

  return stats;
}
