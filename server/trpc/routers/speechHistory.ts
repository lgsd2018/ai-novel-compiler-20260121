/**
 * Speech Recognition History tRPC Router
 * 语音识别历史tRPC路由
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../../_core/trpc';
import {
  createSpeechHistory,
  getSpeechHistoryById,
  getSpeechHistoryByUser,
  updateSpeechHistory,
  deleteSpeechHistory,
  batchDeleteSpeechHistory,
  getSpeechHistoryStats,
} from '../../db/speechHistoryDb';
import { storagePut } from '../../storage';

export const speechHistoryRouter = router({
  /**
   * 创建语音识别历史记录
   */
  create: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      documentId: z.number().optional(),
      audioData: z.string().optional(), // base64编码的音频数据
      audioFormat: z.string().default('webm'),
      audioDuration: z.number().optional(),
      transcript: z.string(),
      language: z.string().default('zh'),
      recognitionType: z.enum(['file', 'streaming']).default('file'),
      confidence: z.number().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let audioUrl: string | undefined;

      // 如果提供了音频数据，上传到S3
      if (input.audioData) {
        try {
          const audioBuffer = Buffer.from(input.audioData, 'base64');
          const fileName = `speech/${ctx.user.id}/${Date.now()}.${input.audioFormat}`;
          const result = await storagePut(fileName, audioBuffer, `audio/${input.audioFormat}`);
          audioUrl = result.url;
        } catch (error) {
          console.error('[Speech History] Error uploading audio:', error);
        }
      }

      const history = await createSpeechHistory({
        userId: ctx.user.id,
        projectId: input.projectId,
        documentId: input.documentId,
        audioUrl,
        audioFormat: input.audioFormat,
        audioDuration: input.audioDuration,
        transcript: input.transcript,
        language: input.language,
        recognitionType: input.recognitionType,
        confidence: input.confidence ? input.confidence.toString() : undefined,
        metadata: input.metadata,
      });

      return history;
    }),

  /**
   * 获取语音识别历史记录列表
   */
  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      searchText: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const history = await getSpeechHistoryByUser(ctx.user.id, {
        projectId: input.projectId,
        limit: input.limit,
        offset: input.offset,
        searchText: input.searchText,
      });

      return history;
    }),

  /**
   * 获取单个语音识别历史记录
   */
  getById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input }) => {
      const history = await getSpeechHistoryById(input.id);
      return history;
    }),

  /**
   * 更新语音识别历史记录
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      transcript: z.string().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await updateSpeechHistory(input.id, {
        transcript: input.transcript,
        metadata: input.metadata,
      });

      return { success };
    }),

  /**
   * 删除语音识别历史记录
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const success = await deleteSpeechHistory(input.id);
      return { success };
    }),

  /**
   * 批量删除语音识别历史记录
   */
  batchDelete: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const success = await batchDeleteSpeechHistory(input.ids);
      return { success };
    }),

  /**
   * 获取语音识别历史统计
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const stats = await getSpeechHistoryStats(ctx.user.id);
      return stats;
    }),
});
