/**
 * Extraction Rules Database Operations
 * 自定义提取规则数据库操作
 */

import { getDb } from '../db';
import { extractionRules, type ExtractionRule, type InsertExtractionRule } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * 创建提取规则
 */
export async function createExtractionRule(rule: InsertExtractionRule): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const result = await db.insert(extractionRules).values(rule);
  return Number(result[0].insertId);
}

/**
 * 获取用户的所有提取规则
 */
export async function getUserExtractionRules(
  userId: number,
  projectId?: number
): Promise<ExtractionRule[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const conditions = [eq(extractionRules.userId, userId)];
  if (projectId !== undefined) {
    conditions.push(eq(extractionRules.projectId, projectId));
  }

  return await db
    .select()
    .from(extractionRules)
    .where(and(...conditions))
    .orderBy(desc(extractionRules.priority), desc(extractionRules.createdAt));
}

/**
 * 获取激活的提取规则
 */
export async function getActiveExtractionRules(
  userId: number,
  projectId?: number
): Promise<ExtractionRule[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const conditions = [
    eq(extractionRules.userId, userId),
    eq(extractionRules.isActive, true),
  ];
  if (projectId !== undefined) {
    conditions.push(eq(extractionRules.projectId, projectId));
  }

  return await db
    .select()
    .from(extractionRules)
    .where(and(...conditions))
    .orderBy(desc(extractionRules.priority));
}

/**
 * 根据ID获取提取规则
 */
export async function getExtractionRuleById(ruleId: number): Promise<ExtractionRule | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db
    .select()
    .from(extractionRules)
    .where(eq(extractionRules.id, ruleId))
    .limit(1);

  return result[0];
}

/**
 * 更新提取规则
 */
export async function updateExtractionRule(
  ruleId: number,
  updates: Partial<InsertExtractionRule>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db
    .update(extractionRules)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(extractionRules.id, ruleId));
}

/**
 * 删除提取规则
 */
export async function deleteExtractionRule(ruleId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db.delete(extractionRules).where(eq(extractionRules.id, ruleId));
}

/**
 * 切换规则激活状态
 */
export async function toggleExtractionRuleActive(ruleId: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db
    .update(extractionRules)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(extractionRules.id, ruleId));
}

/**
 * 获取预设规则模板
 */
export function getPresetRuleTemplates(): Partial<InsertExtractionRule>[] {
  return [
    {
      name: '故事线事件提取',
      description: '提取章节中的关键事件，包括事件名称、时间、地点、参与角色等',
      ruleType: 'event',
      fields: JSON.parse(JSON.stringify([
        { name: 'eventName', type: 'string', description: '事件名称' },
        { name: 'time', type: 'string', description: '事件发生时间' },
        { name: 'location', type: 'string', description: '事件发生地点' },
        { name: 'participants', type: 'array', description: '参与角色列表' },
        { name: 'description', type: 'string', description: '事件描述' },
        { name: 'importance', type: 'number', description: '重要程度(1-5)' },
      ])),
      prompt: '请从以下文本中提取所有重要的故事线事件，包括事件名称、时间、地点、参与角色、描述和重要程度。',
      priority: 10,
    },
    {
      name: '角色信息提取',
      description: '提取文本中出现的角色及其特征、关系等信息',
      ruleType: 'character',
      fields: JSON.parse(JSON.stringify([
        { name: 'name', type: 'string', description: '角色名称' },
        { name: 'appearance', type: 'string', description: '外貌特征' },
        { name: 'personality', type: 'string', description: '性格特点' },
        { name: 'background', type: 'string', description: '背景故事' },
        { name: 'relationships', type: 'array', description: '与其他角色的关系' },
      ])),
      prompt: '请从以下文本中提取所有角色信息，包括名称、外貌、性格、背景和关系。',
      priority: 9,
    },
    {
      name: '世界观设定提取',
      description: '提取世界观、魔法体系、科技设定等背景信息',
      ruleType: 'setting',
      fields: JSON.parse(JSON.stringify([
        { name: 'name', type: 'string', description: '设定名称' },
        { name: 'type', type: 'string', description: '设定类型（地理/魔法/科技/社会等）' },
        { name: 'description', type: 'string', description: '详细描述' },
        { name: 'rules', type: 'string', description: '相关规则或限制' },
      ])),
      prompt: '请从以下文本中提取世界观设定，包括名称、类型、描述和相关规则。',
      priority: 8,
    },
    {
      name: '情节转折点提取',
      description: '提取故事中的关键转折点，包括冲突、高潮、反转等',
      ruleType: 'event',
      fields: JSON.parse(JSON.stringify([
        { name: 'type', type: 'string', description: '转折类型（冲突/高潮/反转/解决）' },
        { name: 'description', type: 'string', description: '转折点描述' },
        { name: 'before', type: 'string', description: '转折前的状态' },
        { name: 'after', type: 'string', description: '转折后的状态' },
        { name: 'impact', type: 'string', description: '对后续情节的影响' },
        { name: 'emotionalTone', type: 'string', description: '情感色调' },
      ])),
      prompt: '请从以下文本中提取所有关键的情节转折点，包括类型、描述、转折前后状态、影响和情感色调。',
      priority: 7,
    },
    {
      name: '对话分析',
      description: '分析文本中的对话，提取说话者、内容、语气等信息',
      ruleType: 'custom',
      fields: JSON.parse(JSON.stringify([
        { name: 'speaker', type: 'string', description: '说话者名称' },
        { name: 'content', type: 'string', description: '对话内容' },
        { name: 'tone', type: 'string', description: '语气（平静/激动/愤怒/悲伤等）' },
        { name: 'purpose', type: 'string', description: '对话目的' },
        { name: 'response', type: 'string', description: '对方回应' },
      ])),
      prompt: '请从以下文本中提取所有重要的对话，包括说话者、内容、语气、目的和对方回应。',
      priority: 6,
    },
    {
      name: '场景描写提取',
      description: '提取文本中的场景描写，包括环境、气氛、感官细节等',
      ruleType: 'setting',
      fields: JSON.parse(JSON.stringify([
        { name: 'location', type: 'string', description: '场景地点' },
        { name: 'time', type: 'string', description: '时间（时间段、天气等）' },
        { name: 'visualDetails', type: 'string', description: '视觉细节' },
        { name: 'soundDetails', type: 'string', description: '听觉细节' },
        { name: 'atmosphere', type: 'string', description: '气氛营造' },
        { name: 'mood', type: 'string', description: '情绪色调' },
      ])),
      prompt: '请从以下文本中提取场景描写，包括地点、时间、视听觉细节、气氛和情绪色调。',
      priority: 5,
    },
    {
      name: '情感分析',
      description: '分析文本中的情感表达，包括角色情绪、情感变化等',
      ruleType: 'custom',
      fields: JSON.parse(JSON.stringify([
        { name: 'character', type: 'string', description: '角色名称' },
        { name: 'emotion', type: 'string', description: '主要情绪' },
        { name: 'intensity', type: 'number', description: '情绪强度(1-10)' },
        { name: 'trigger', type: 'string', description: '情绪触发原因' },
        { name: 'expression', type: 'string', description: '情绪表达方式' },
        { name: 'change', type: 'string', description: '情绪变化轨迹' },
      ])),
      prompt: '请从以下文本中分析角色的情感表达，包括主要情绪、强度、触发原因、表达方式和变化轨迹。',
      priority: 4,
    },
  ];
}
