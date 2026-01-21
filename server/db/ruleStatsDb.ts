/**
 * Rule Stats Database Helper
 * 规则效果分析数据库辅助函数
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';

export interface RuleStats {
  id: number;
  ruleId: number;
  userId: number;
  projectId?: number;
  usedAt: Date;
  success: boolean;
  processingTimeMs?: number;
  extractedCount: number;
  errorMessage?: string;
}

export interface RuleAnalytics {
  ruleId: number;
  ruleName: string;
  totalUses: number;
  successRate: number;
  avgProcessingTime: number;
  avgExtractedCount: number;
  lastUsedAt: Date;
}

/**
 * 记录规则使用统计
 */
export async function recordRuleUsage(data: {
  ruleId: number;
  userId: number;
  projectId?: number;
  success: boolean;
  processingTimeMs?: number;
  extractedCount?: number;
  errorMessage?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.execute(sql`
    INSERT INTO extraction_rule_stats 
    (rule_id, user_id, project_id, success, processing_time_ms, extracted_count, error_message)
    VALUES (${data.ruleId}, ${data.userId}, ${data.projectId || null}, ${data.success}, 
            ${data.processingTimeMs || null}, ${data.extractedCount || 0}, ${data.errorMessage || null})
  `);
}

/**
 * 获取规则效果分析数据
 */
export async function getRuleAnalytics(userId: number, projectId?: number): Promise<RuleAnalytics[]> {
  const db = await getDb();
  if (!db) return [];
  
  const whereClause = projectId 
    ? sql`WHERE s.user_id = ${userId} AND s.project_id = ${projectId}`
    : sql`WHERE s.user_id = ${userId}`;
  
  const result = await db.execute(sql`
    SELECT 
      s.rule_id as ruleId,
      r.name as ruleName,
      COUNT(*) as totalUses,
      (SUM(CASE WHEN s.success THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as successRate,
      AVG(s.processing_time_ms) as avgProcessingTime,
      AVG(s.extracted_count) as avgExtractedCount,
      MAX(s.used_at) as lastUsedAt
    FROM extraction_rule_stats s
    LEFT JOIN extraction_rules r ON s.rule_id = r.id
    ${whereClause}
    GROUP BY s.rule_id, r.name
    ORDER BY totalUses DESC
  `);
  
  return (result as any).rows || [];
}

/**
 * 获取规则详细使用历史
 */
export async function getRuleUsageHistory(
  ruleId: number,
  userId: number,
  limit: number = 50
): Promise<RuleStats[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT * FROM extraction_rule_stats
    WHERE rule_id = ${ruleId} AND user_id = ${userId}
    ORDER BY used_at DESC
    LIMIT ${limit}
  `);
  
  return (result as any).rows || [];
}

/**
 * 删除旧的统计数据（保留最近30天）
 */
export async function cleanOldStats(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.execute(sql`
    DELETE FROM extraction_rule_stats
    WHERE used_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
  `);
  
  return (result as any).rowsAffected || 0;
}
