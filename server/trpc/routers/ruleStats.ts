/**
 * Rule Stats Router
 * 规则效果分析tRPC路由
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../../_core/trpc';
import { getRuleAnalytics, getRuleUsageHistory, cleanOldStats } from '../../db/ruleStatsDb';

export const ruleStatsRouter = router({
  /**
   * 获取规则效果分析数据
   */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analytics = await getRuleAnalytics(ctx.user.id, input.projectId);
      return analytics;
    }),

  /**
   * 获取规则详细使用历史
   */
  getUsageHistory: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const history = await getRuleUsageHistory(input.ruleId, ctx.user.id, input.limit);
      return history;
    }),

  /**
   * 清理旧的统计数据
   */
  cleanOldStats: protectedProcedure.mutation(async () => {
    const deletedCount = await cleanOldStats();
    return { deletedCount };
  }),
});
