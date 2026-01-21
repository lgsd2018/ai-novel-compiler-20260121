/**
 * Extraction Rules tRPC Router
 * 自定义提取规则API路由
 */

import { z } from 'zod';
import { publicProcedure, router } from '../../_core/trpc';
import {
  createExtractionRule,
  getUserExtractionRules,
  getActiveExtractionRules,
  getExtractionRuleById,
  updateExtractionRule,
  deleteExtractionRule,
  toggleExtractionRuleActive,
  getPresetRuleTemplates,
} from '../../db/extractionRulesDb';

const fieldSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string(),
  required: z.boolean().optional(),
  example: z.any().optional(),
});

export const extractionRulesRouter = router({
  // 创建提取规则
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        ruleType: z.enum(['event', 'character', 'setting', 'custom']),
        fields: z.array(fieldSchema),
        prompt: z.string().optional(),
        projectId: z.number().optional(),
        priority: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const ruleId = await createExtractionRule({
        userId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        fields: input.fields as any,
        prompt: input.prompt,
        priority: input.priority || 0,
        isActive: true,
      });

      return { id: ruleId };
    }),

  // 获取用户的所有规则
  list: publicProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        return [];
      }

      return await getUserExtractionRules(userId, input.projectId);
    }),

  // 获取激活的规则
  listActive: publicProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        return [];
      }

      return await getActiveExtractionRules(userId, input.projectId);
    }),

  // 根据ID获取规则
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getExtractionRuleById(input.id);
    }),

  // 更新规则
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        ruleType: z.enum(['event', 'character', 'setting', 'custom']).optional(),
        fields: z.array(fieldSchema).optional(),
        prompt: z.string().optional(),
        priority: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await updateExtractionRule(id, updates as any);
      return { success: true };
    }),

  // 删除规则
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteExtractionRule(input.id);
      return { success: true };
    }),

  // 切换激活状态
  toggleActive: publicProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await toggleExtractionRuleActive(input.id, input.isActive);
      return { success: true };
    }),

  // 获取预设模板
  getPresets: publicProcedure.query(() => {
    return getPresetRuleTemplates();
  }),

  // 从模板创建规则
  createFromTemplate: publicProcedure
    .input(
      z.object({
        templateIndex: z.number(),
        projectId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const templates = getPresetRuleTemplates();
      const template = templates[input.templateIndex];
      if (!template) {
        throw new Error('Template not found');
      }

      const ruleId = await createExtractionRule({
        ...template,
        userId,
        projectId: input.projectId,
      } as any);

      return { id: ruleId };
    }),
});
