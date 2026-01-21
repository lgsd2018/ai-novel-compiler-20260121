/**
 * Character and Setting Sync Service
 * 角色和设定自动同步服务
 */

import { getDb } from './db';
import { characters, documents } from '../drizzle/schema';
import { ExtractedCharacter, ExtractedSetting } from './aiContentAnalyzer';
import { eq, and } from 'drizzle-orm';

/**
 * 同步提取的角色到项目
 */
export async function syncCharactersToProject(
  projectId: number,
  userId: number,
  extractedCharacters: ExtractedCharacter[]
): Promise<{ created: number; updated: number; skipped: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // 获取项目现有的角色
    const existingCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId));

    for (const char of extractedCharacters) {
      try {
        // 检查是否已存在相同名称的角色
        const existing = existingCharacters.find(
          (c: any) => c.name.toLowerCase() === char.name.toLowerCase()
        );

        if (existing) {
          // 更新现有角色（只更新有新信息的字段）
          const updates: any = {
            updatedAt: new Date(),
          };

          if (char.appearance && !existing.appearance) {
            updates.appearance = char.appearance;
          }
          if (char.personality && !existing.personality) {
            updates.personality = char.personality;
          }
          if (char.background && !existing.background) {
            updates.background = char.background;
          }
          // 注意：description和relationships字段不在characters表中
          // 关系信息应该存储在characterRelationships表中

          // 只有在有更新时才执行
          if (Object.keys(updates).length > 1) {
            await db
              .update(characters)
              .set(updates)
              .where(eq(characters.id, existing.id));
            updated++;
          } else {
            skipped++;
          }
        } else {
          // 创建新角色
          await db.insert(characters).values({
            projectId,
            name: char.name,
            appearance: char.appearance || null,
            personality: char.personality || null,
            background: char.background || null,
            role: null,
            avatarUrl: null,
            avatarKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          created++;
        }
      } catch (error) {
        console.error('[Character Sync] Error syncing character:', char.name, error);
        skipped++;
      }
    }

    console.log(`[Character Sync] Synced ${extractedCharacters.length} characters: ${created} created, ${updated} updated, ${skipped} skipped`);

    return { created, updated, skipped };
  } catch (error) {
    console.error('[Character Sync] Error syncing characters:', error);
    throw error;
  }
}

/**
 * 同步提取的设定到项目
 */
export async function syncSettingsToProject(
  projectId: number,
  userId: number,
  extractedSettings: ExtractedSetting[]
): Promise<{ created: number; updated: number; skipped: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // 获取项目现有的设定文档
    const existingSettings = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.type, 'setting')
        )
      );

    for (const setting of extractedSettings) {
      try {
        // 检查是否已存在相同名称和类型的设定
        const existing = existingSettings.find(
          (s: any) =>
            s.title.toLowerCase() === setting.name.toLowerCase()
        );

        if (existing) {
          // 更新现有设定（如果有更详细的描述）
          if (setting.description && setting.description.length > (existing.content?.length || 0)) {
            await db
              .update(documents)
              .set({
                content: setting.description,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existing.id));
            updated++;
          } else {
            skipped++;
          }
        } else {
          // 创建新设定
          await db.insert(documents).values({
            projectId,
            title: setting.name,
            type: 'setting',
            content: setting.description,
            order: 0,
            wordCount: setting.description.length,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          created++;
        }
      } catch (error) {
        console.error('[Setting Sync] Error syncing setting:', setting.name, error);
        skipped++;
      }
    }

    console.log(`[Setting Sync] Synced ${extractedSettings.length} settings: ${created} created, ${updated} updated, ${skipped} skipped`);

    return { created, updated, skipped };
  } catch (error) {
    console.error('[Setting Sync] Error syncing settings:', error);
    throw error;
  }
}

/**
 * 从AI生成内容中提取并同步角色和设定
 */
export async function extractAndSyncCharactersAndSettings(
  projectId: number,
  userId: number,
  content: string,
  context?: {
    chapterTitle?: string;
  }
): Promise<{
  characters: { created: number; updated: number; skipped: number };
  settings: { created: number; updated: number; skipped: number };
}> {
  const { analyzeGeneratedContent } = await import('./aiContentAnalyzer');

  try {
    // 分析内容提取角色和设定
    const analysis = await analyzeGeneratedContent(content, {
      chapterTitle: context?.chapterTitle,
      userId,
    });

    // 同步角色
    const characterResult = await syncCharactersToProject(
      projectId,
      userId,
      analysis.characters
    );

    // 同步设定
    const settingResult = await syncSettingsToProject(
      projectId,
      userId,
      analysis.settings
    );

    return {
      characters: characterResult,
      settings: settingResult,
    };
  } catch (error) {
    console.error('[Sync] Error extracting and syncing characters and settings:', error);
    return {
      characters: { created: 0, updated: 0, skipped: 0 },
      settings: { created: 0, updated: 0, skipped: 0 },
    };
  }
}

/**
 * 完整同步：从AI生成内容中提取并同步所有信息
 */
export async function fullSyncFromGeneratedContent(
  projectId: number,
  userId: number,
  content: string,
  context?: {
    chapterTitle?: string;
    branchId?: number;
  }
): Promise<{
  events: { created: number; updated: number; skipped: number };
  characters: { created: number; updated: number; skipped: number };
  settings: { created: number; updated: number; skipped: number };
}> {
  const { extractAndSyncEvents } = await import('./timelineSync');

  try {
    // 同步事件
    const eventResult = await extractAndSyncEvents(projectId, userId, content, {
      chapterTitle: context?.chapterTitle,
      branchId: context?.branchId,
    });

    // 同步角色和设定
    const { characters: characterResult, settings: settingResult } =
      await extractAndSyncCharactersAndSettings(projectId, userId, content, {
        chapterTitle: context?.chapterTitle,
      });

    return {
      events: eventResult,
      characters: characterResult,
      settings: settingResult,
    };
  } catch (error) {
    console.error('[Full Sync] Error syncing all content:', error);
    return {
      events: { created: 0, updated: 0, skipped: 0 },
      characters: { created: 0, updated: 0, skipped: 0 },
      settings: { created: 0, updated: 0, skipped: 0 },
    };
  }
}
