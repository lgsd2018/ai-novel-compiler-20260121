/**
 * AI Analysis Cache Service
 * AI分析结果缓存服务
 */

import { createHash } from 'crypto';
import { getDb } from './db';
import { sql } from 'drizzle-orm';

const CACHE_EXPIRY_HOURS = 24; // 缓存24小时过期

/**
 * 生成内容哈希
 */
export function generateContentHash(content: string, ruleIds?: number[]): string {
  const data = ruleIds ? `${content}:${ruleIds.join(',')}` : content;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 获取缓存的分析结果
 */
export async function getCachedAnalysis(contentHash: string): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.execute(sql`
      SELECT analysis_result, expires_at
      FROM ai_analysis_cache
      WHERE content_hash = ${contentHash}
        AND expires_at > NOW()
      LIMIT 1
    `);

    if (result && Array.isArray(result) && result.length > 0) {
      const rows = result as any[];
      const row: any = rows[0];
      
      // 更新访问计数
      await db.execute(sql`
        UPDATE ai_analysis_cache
        SET access_count = access_count + 1
        WHERE content_hash = ${contentHash}
      `);

      return typeof row.analysis_result === 'string' 
        ? JSON.parse(row.analysis_result) 
        : row.analysis_result;
    }

    return null;
  } catch (error) {
    console.error('[AI Analysis Cache] Error getting cached analysis:', error);
    return null;
  }
}

/**
 * 保存分析结果到缓存
 */
export async function cacheAnalysisResult(
  contentHash: string,
  analysisResult: any
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_EXPIRY_HOURS);

    await db.execute(sql`
      INSERT INTO ai_analysis_cache (content_hash, analysis_result, expires_at)
      VALUES (${contentHash}, ${JSON.stringify(analysisResult)}, ${expiresAt})
      ON DUPLICATE KEY UPDATE
        analysis_result = VALUES(analysis_result),
        expires_at = VALUES(expires_at),
        access_count = access_count + 1
    `);
  } catch (error) {
    console.error('[AI Analysis Cache] Error caching analysis result:', error);
  }
}

/**
 * 清理过期缓存
 */
export async function cleanExpiredCache(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.execute(sql`
      DELETE FROM ai_analysis_cache
      WHERE expires_at < NOW()
    `);

    const affectedRows = (result as any)?.affectedRows || 0;
    console.log(`[AI Analysis Cache] Cleaned ${affectedRows} expired cache entries`);
    return affectedRows;
  } catch (error) {
    console.error('[AI Analysis Cache] Error cleaning expired cache:', error);
    return 0;
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalAccessCount: number;
  avgAccessCount: number;
}> {
  const db = await getDb();
  if (!db) {
    return { totalEntries: 0, totalAccessCount: 0, avgAccessCount: 0 };
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_entries,
        SUM(access_count) as total_access_count,
        AVG(access_count) as avg_access_count
      FROM ai_analysis_cache
      WHERE expires_at > NOW()
    `);

    if (result && Array.isArray(result) && result.length > 0) {
      const rows = result as any[];
      const row: any = rows[0];
      return {
        totalEntries: Number(row.total_entries) || 0,
        totalAccessCount: Number(row.total_access_count) || 0,
        avgAccessCount: Math.round((Number(row.avg_access_count) || 0) * 100) / 100,
      };
    }

    return { totalEntries: 0, totalAccessCount: 0, avgAccessCount: 0 };
  } catch (error) {
    console.error('[AI Analysis Cache] Error getting cache stats:', error);
    return { totalEntries: 0, totalAccessCount: 0, avgAccessCount: 0 };
  }
}

// 定期清理过期缓存（每小时执行一次）
setInterval(() => {
  cleanExpiredCache();
}, 60 * 60 * 1000);
