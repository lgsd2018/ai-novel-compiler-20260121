import { z } from 'zod';
import { publicProcedure, router } from '../../_core/trpc';
import { createAgentLog, getAgentLogs, updateAgentLogStatus } from '../../db/agentLogsDb';

export const agentLogsRouter = router({
  create: publicProcedure
    .input(z.object({
      operation: z.string(),
      filePath: z.string(),
      contentBefore: z.string().optional(),
      contentAfter: z.string().optional(),
      reason: z.string().optional(),
      status: z.enum(['pending', 'approved', 'rejected', 'auto_approved', 'reverted']),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const logId = await createAgentLog({
        userId,
        ...input,
      });
      return { success: true, logId };
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
      status: z.enum(['pending', 'approved', 'rejected', 'auto_approved', 'reverted']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) return [];
      
      return await getAgentLogs(userId, input);
    }),

  updateStatus: publicProcedure
    .input(z.object({
      logId: z.number(),
      status: z.enum(['pending', 'approved', 'rejected', 'auto_approved', 'reverted']),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('Unauthorized');

      const updated = await updateAgentLogStatus(userId, input.logId, input.status);
      return { success: updated };
    }),
});
