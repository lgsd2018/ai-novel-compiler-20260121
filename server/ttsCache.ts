/**
 * TTS Audio Cache Module
 * 音频缓存模块：缓存TTS生成的音频，避免重复生成
 */

import { createHash } from 'crypto';
import { getDb } from './db';
import { ttsCache } from '../drizzle/schema';
import { eq, lt, and, sql } from 'drizzle-orm';

/**
 * 生成缓存键
 * 基于文本内容、语音、语速、音调等参数生成唯一键
 */
export function generateCacheKey(
  text: string,
  voice: string = 'default',
  rate: number = 1.0,
  pitch: number = 1.0,
  format: string = 'mp3'
): string {
  const params = `${text}|${voice}|${rate}|${pitch}|${format}`;
  return createHash('sha256').update(params).digest('hex');
}

/**
 * 从缓存中获取音频
 */
export async function getCachedAudio(cacheKey: string): Promise<Buffer | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(ttsCache)
      .where(eq(ttsCache.cacheKey, cacheKey))
      .limit(1);

    if (result && result.length > 0) {
      const cached = result[0];

      // 更新访问时间和访问次数
      await db
        .update(ttsCache)
        .set({
          lastAccessedAt: new Date(),
          accessCount: sql`${ttsCache.accessCount} + 1`,
        })
        .where(eq(ttsCache.id, cached.id));

      // 将base64字符串转换回Buffer
      return Buffer.from(cached.audioData, 'base64');
    }

    return null;
  } catch (error) {
    console.error('[TTS Cache] Failed to get cached audio:', error);
    return null;
  }
}

/**
 * 将音频保存到缓存
 */
export async function setCachedAudio(
  cacheKey: string,
  audioData: Buffer,
  format: string = 'mp3',
  duration?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // 将Buffer转换为base64字符串存储
    const audioDataBase64 = audioData.toString('base64');

    // 检查是否已存在
    const existing = await db
      .select()
      .from(ttsCache)
      .where(eq(ttsCache.cacheKey, cacheKey))
      .limit(1);

    if (existing && existing.length > 0) {
      // 更新现有记录
      await db
        .update(ttsCache)
        .set({
          audioData: audioDataBase64,
          format,
          duration: duration || null,
          lastAccessedAt: new Date(),
          accessCount: sql`${ttsCache.accessCount} + 1`,
        })
        .where(eq(ttsCache.cacheKey, cacheKey));
    } else {
      // 插入新记录
      await db.insert(ttsCache).values({
        cacheKey,
        audioData: audioDataBase64,
        format,
        duration: duration || null,
        accessCount: 1,
      });
    }

    return true;
  } catch (error) {
    console.error('[TTS Cache] Failed to cache audio:', error);
    return false;
  }
}

/**
 * 清理过期缓存
 * 删除超过指定天数未访问的缓存
 */
export async function cleanExpiredCache(daysOld: number = 30): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db
      .delete(ttsCache)
      .where(lt(ttsCache.lastAccessedAt, cutoffDate));

    const deletedCount = (result as any).rowsAffected || 0;
    console.log(`[TTS Cache] Cleaned ${deletedCount} expired cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('[TTS Cache] Failed to clean expired cache:', error);
    return 0;
  }
}

/**
 * 清理低频访问的缓存
 * 删除访问次数低于阈值的缓存
 */
export async function cleanLowAccessCache(minAccessCount: number = 2): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await db
      .delete(ttsCache)
      .where(
        and(
          lt(ttsCache.accessCount, minAccessCount),
          lt(ttsCache.lastAccessedAt, cutoffDate)
        )
      );

    const deletedCount = (result as any).rowsAffected || 0;
    console.log(`[TTS Cache] Cleaned ${deletedCount} low-access cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('[TTS Cache] Failed to clean low-access cache:', error);
    return 0;
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  avgAccessCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalEntries: 0,
      totalSize: 0,
      avgAccessCount: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  try {
    const result = await db
      .select({
        totalEntries: sql<number>`COUNT(*)`,
        totalSize: sql<number>`SUM(LENGTH(${ttsCache.audioData}))`,
        avgAccessCount: sql<number>`AVG(${ttsCache.accessCount})`,
        oldestEntry: sql<Date>`MIN(${ttsCache.createdAt})`,
        newestEntry: sql<Date>`MAX(${ttsCache.createdAt})`,
      })
      .from(ttsCache);

    if (result && result.length > 0) {
      const row = result[0];
      return {
        totalEntries: Number(row.totalEntries) || 0,
        totalSize: Number(row.totalSize) || 0,
        avgAccessCount: Number(row.avgAccessCount) || 0,
        oldestEntry: row.oldestEntry ? new Date(row.oldestEntry) : null,
        newestEntry: row.newestEntry ? new Date(row.newestEntry) : null,
      };
    }

    return {
      totalEntries: 0,
      totalSize: 0,
      avgAccessCount: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  } catch (error) {
    console.error('[TTS Cache] Failed to get cache stats:', error);
    return {
      totalEntries: 0,
      totalSize: 0,
      avgAccessCount: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

/**
 * 删除特定缓存
 */
export async function deleteCachedAudio(cacheKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(ttsCache).where(eq(ttsCache.cacheKey, cacheKey));
    return true;
  } catch (error) {
    console.error('[TTS Cache] Failed to delete cached audio:', error);
    return false;
  }
}

/**
 * 清空所有缓存
 */
export async function clearAllCache(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(ttsCache);
    console.log('[TTS Cache] All cache cleared');
    return true;
  } catch (error) {
    console.error('[TTS Cache] Failed to clear all cache:', error);
    return false;
  }
}
