import { router, protectedProcedure } from '../../_core/trpc';
import { z } from 'zod';
import { executeVoiceCommand, getCommandHelp } from '../../voiceCommandExecutor';
import { getAvailableCommands, getCommandsByCategory } from '../../voiceCommands';

export const voiceCommandsRouter = router({
  /**
   * 执行语音命令
   */
  execute: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1, '命令文本不能为空'),
        projectId: z.number().int().positive(),
        documentId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const result = executeVoiceCommand(input.text, {
        userId: ctx.user.id,
        projectId: input.projectId,
        documentId: input.documentId,
      });

      return result;
    }),

  /**
   * 获取所有可用命令
   */
  listAll: protectedProcedure.query(async () => {
    const commands = getAvailableCommands();
    return {
      total: commands.length,
      commands,
    };
  }),

  /**
   * 按分类获取命令
   */
  listByCategory: protectedProcedure
    .input(
      z.object({
        category: z.enum(['editor', 'document', 'project', 'ai']),
      })
    )
    .query(async ({ input }: any) => {
      const commands = getCommandsByCategory(input.category);
      return {
        category: input.category,
        total: commands.length,
        commands,
      };
    }),

  /**
   * 获取命令帮助信息
   */
  getHelp: protectedProcedure.query(async () => {
    const help = getCommandHelp();
    return {
      help,
    };
  }),

  /**
   * 测试命令解析
   */
  testParse: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
      })
    )
    .query(async ({ input }: any) => {
      const { parseVoiceCommand } = require('../../voiceCommands');
      const result = parseVoiceCommand(input.text);
      return result;
    }),
});
