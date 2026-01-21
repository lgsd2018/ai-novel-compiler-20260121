/**
 * Timeline Sync Service
 * 故事线自动同步服务
 */

import { getDb } from './db';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { timelineNodes } from '../drizzle/schema';
import { ExtractedEvent } from './aiContentAnalyzer';
import { eq, and } from 'drizzle-orm';

/**
 * 同步提取的事件到故事线
 */
export async function syncEventsToTimeline(
  projectId: number,
  userId: number,
  events: ExtractedEvent[],
  options?: {
    branchId?: number;
    autoPosition?: boolean;
  }
): Promise<{ created: number; updated: number; skipped: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // 获取项目现有的事件
    const existingEvents = await db
      .select()
      .from(timelineNodes)
      .where(
        eq(timelineNodes.projectId, projectId)
      );

    // 计算下一个位置
    let nextPosition = 0;
    if (options?.autoPosition && existingEvents.length > 0) {
      nextPosition = Math.max(...existingEvents.map((e: any) => e.timePosition || 0)) + 100;
    }

    for (const event of events) {
      try {
        // 检查是否已存在相似事件（标题相同）
        const existing = existingEvents.find(
          (e: any) => e.title.toLowerCase() === event.title.toLowerCase()
        );

        if (existing) {
          // 更新现有事件
          await db
            .update(timelineNodes)
            .set({
              description: event.description || existing.description,
              characterIds: event.characters ? event.characters : existing.characterIds,
              tags: event.location ? [event.location] : existing.tags,
              updatedAt: new Date(),
            })
            .where(eq(timelineNodes.id, existing.id));
          
          updated++;
        } else {
          // 创建新事件
          await db.insert(timelineNodes).values({
            projectId,
            title: event.title,
            description: event.description,
            nodeType: 'event' as const,
            timePosition: options?.autoPosition ? nextPosition : 0,
            groupPosition: 0,
            characterIds: event.characters || null,
            tags: event.location ? [event.location] : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          created++;
          if (options?.autoPosition) {
            nextPosition += 100;
          }
        }
      } catch (error) {
        console.error('[Timeline Sync] Error syncing event:', event.title, error);
        skipped++;
      }
    }

    console.log(`[Timeline Sync] Synced ${events.length} events: ${created} created, ${updated} updated, ${skipped} skipped`);

    return { created, updated, skipped };
  } catch (error) {
    console.error('[Timeline Sync] Error syncing events to timeline:', error);
    throw error;
  }
}

/**
 * 从AI生成内容中提取并同步事件
 */
export async function extractAndSyncEvents(
  projectId: number,
  userId: number,
  content: string,
  context?: {
    chapterTitle?: string;
    branchId?: number;
  }
): Promise<{ created: number; updated: number; skipped: number }> {
  const { analyzeGeneratedContent } = await import('./aiContentAnalyzer');

  try {
    // 分析内容提取事件
    const analysis = await analyzeGeneratedContent(content, {
      chapterTitle: context?.chapterTitle,
      userId,
    });

    // 同步到故事线
    return await syncEventsToTimeline(projectId, userId, analysis.events, {
      branchId: context?.branchId,
      autoPosition: true,
    });
  } catch (error) {
    console.error('[Timeline Sync] Error extracting and syncing events:', error);
    return { created: 0, updated: 0, skipped: 0 };
  }
}

/**
 * 批量同步多个章节的事件
 */
export async function batchSyncChapterEvents(
  projectId: number,
  userId: number,
  chapters: Array<{ title: string; content: string }>,
  options?: {
    branchId?: number;
  }
): Promise<{ created: number; updated: number; skipped: number }> {
  const { analyzeBatchContent } = await import('./aiContentAnalyzer');

  try {
    // 批量分析内容
    const analysis = await analyzeBatchContent(
      chapters.map(ch => ({ chapterTitle: ch.title, content: ch.content }))
    );

    // 同步到故事线
    return await syncEventsToTimeline(projectId, userId, analysis.events, {
      branchId: options?.branchId,
      autoPosition: true,
    });
  } catch (error) {
    console.error('[Timeline Sync] Error batch syncing chapter events:', error);
    return { created: 0, updated: 0, skipped: 0 };
  }
}
