import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as ai from "./ai";
import { authorAgentInteract, getMultiAgentTrace, multiAgentInteract, runMultiAgentAsync, startTaskPlannerAsync, getTaskPlannerTrace, updateTaskPlannerItem, setTaskPlannerPaused } from "./aiAgents";
import * as publishingDb from "./publishingDb";
import { createQidianClient } from "./platforms/qidian";
import { createJinjiangClient } from "./platforms/jinjiang";
import * as precheck from "./publishingPrecheck";
import * as tts from "./tts";
import * as stt from "./stt";
import { createAgentLog } from "./db/agentLogsDb";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";
import { voiceCommandsRouter } from "./trpc/routers/voiceCommands";
import { agentLogsRouter } from "./trpc/routers/agentLogs";
import { fileSystemRouter } from "./trpc/routers/fileSystem";

const defaultProjectFolders = [
  { title: "故事大纲", purpose: "存放故事主线与整体结构" },
  { title: "物品库", purpose: "管理道具与关键物品设定" },
  { title: "人物库", purpose: "记录角色信息与人物关系" },
  { title: "技能库", purpose: "整理能力、技能与规则设定" },
  { title: "地图库", purpose: "整理地理与场景信息" },
  { title: "数值库", purpose: "管理数值体系与规则参数" },
  { title: "故事章节", purpose: "存放章节正文与章节草稿" },
  { title: "任务列表", purpose: "管理创作任务与执行计划" },
];

function formatTaskListTitle(index: number) {
  return `任务列表_${String(index).padStart(3, "0")}`;
}

function countTaskItems(content: string) {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) return true;
      if (/^[-*]\s+/.test(line)) return true;
      return /^\d+\.\s+/.test(line);
    }).length;
}

/**
 * 规范化任务列表文档
 * 确保所有任务列表文件都位于"任务列表"文件夹下，并按顺序命名
 */
async function normalizeTaskListDocuments(userId: number, projectId: number, docs: any[]) {
  let changed = false;
  let taskListFolder = docs.find(doc => doc.type === "folder" && doc.title === "任务列表");
  
  // 如果任务列表文件夹不存在，则创建
  if (!taskListFolder) {
    const folderId = await db.createDocument({
      projectId,
      parentId: null,
      title: "任务列表",
      type: "folder",
      content: "",
      order: 80,
      wordCount: 0,
      isDeleted: false,
    });
    await createAgentLog({
      userId,
      operation: "create_folder",
      filePath: `projects/${projectId}/任务列表`,
      contentBefore: null,
      contentAfter: JSON.stringify({
        projectId,
        folderTitle: "任务列表",
        purpose: "管理创作任务与执行计划",
      }),
      reason: "管理创作任务与执行计划",
      status: "auto_approved",
    });
    taskListFolder = { id: folderId };
    changed = true;
  }
  
  const taskListFolderId = taskListFolder?.id;
  if (taskListFolderId) {
    // 过滤出所有任务列表文档（排除文件夹本身）
    const taskListDocs = docs.filter(doc => 
      doc.id !== taskListFolderId && 
      (doc.title === "任务列表" || doc.title.startsWith("任务列表_"))
    );
    
    // 计算当前最大的索引
    const maxIndex = taskListDocs
      .map(doc => {
        const match = doc.title.match(/任务列表_(\d+)/);
        return match ? Number(match[1]) : 0;
      })
      .reduce((max, value) => Math.max(max, value), 0);
      
    let nextIndex = Math.max(maxIndex, 0) + 1;
    
    for (const doc of taskListDocs) {
      // 如果文档名为"任务列表"，重命名为带序号的格式
      if (doc.title === "任务列表") {
        const nextTitle = formatTaskListTitle(nextIndex);
        await db.updateDocument(doc.id, { title: nextTitle });
        nextIndex += 1;
        changed = true;
      }
      
      // 确保文档在任务列表文件夹下
      if (doc.parentId !== taskListFolderId) {
        await db.updateDocument(doc.id, { parentId: taskListFolderId });
        changed = true;
      }
    }
  }
  
  // 如果有变更，重新获取文档列表
  if (changed) {
    return await db.getProjectDocuments(projectId);
  }
  return docs;
}

export const appRouter = router({
  system: systemRouter,
  agentLogs: agentLogsRouter,
  fileSystem: fileSystemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============= 项目管理 =============
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProjects(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        templateType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const projectId = await db.createProject({
          userId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          templateType: input.templateType ?? null,
          coverImageUrl: null,
          coverImageKey: null,
          status: 'draft',
          wordCount: 0,
        });
        const folderIdMap = new Map<string, number>();
        for (let index = 0; index < defaultProjectFolders.length; index += 1) {
          const folder = defaultProjectFolders[index];
          const folderId = await db.createDocument({
            projectId,
            parentId: null,
            title: folder.title,
            type: "folder",
            content: "",
            order: (index + 1) * 10,
            wordCount: 0,
            isDeleted: false,
          });
          folderIdMap.set(folder.title, folderId);
          await createAgentLog({
            userId: ctx.user.id,
            operation: "create_folder",
            filePath: `projects/${projectId}/${folder.title}`,
            contentBefore: null,
            contentAfter: JSON.stringify({
              projectId,
              folderTitle: folder.title,
              purpose: folder.purpose,
            }),
            reason: folder.purpose,
            status: "auto_approved",
          });
        }
        const taskListFolderId = folderIdMap.get("任务列表");
        if (taskListFolderId) {
          await db.createDocument({
            projectId,
            parentId: taskListFolderId,
            title: formatTaskListTitle(1),
            type: "setting",
            content: "",
            order: 10,
            wordCount: 0,
            isDeleted: false,
          });
        }
        return { projectId };
      }),

    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectById(input.projectId);
      }),

    update: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['draft', 'writing', 'completed', 'archived']).optional(),
        coverImageUrl: z.string().optional(),
        coverImageKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { projectId, ...updates } = input;
        await db.updateProject(projectId, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.projectId);
        return { success: true };
      }),
  }),

  // ============= 文档管理 =============
  documents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const documents = await db.getProjectDocuments(input.projectId);
        return await normalizeTaskListDocuments(ctx.user.id, input.projectId, documents);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        parentId: z.number().optional(),
        title: z.string().min(1).max(255),
        type: z.enum(['chapter', 'character', 'setting', 'outline', 'worldview', 'folder']),
        content: z.string().optional(),
        order: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const documents = await db.getProjectDocuments(input.projectId);
        const normalizedDocs = await normalizeTaskListDocuments(ctx.user.id, input.projectId, documents);
        const taskListFolder = normalizedDocs.find(
          doc => doc.type === "folder" && doc.title === "任务列表"
        );
        const taskListFolderId = taskListFolder?.id;
        const isTaskListDoc = input.title === "任务列表" || input.title.startsWith("任务列表_");
        const resolvedParentId = isTaskListDoc && taskListFolderId
          ? taskListFolderId
          : input.parentId ?? null;
        let resolvedTitle = input.title;
        if (input.title === "任务列表") {
          const maxIndex = normalizedDocs
            .filter(doc => doc.title.startsWith("任务列表_"))
            .map(doc => {
              const match = doc.title.match(/任务列表_(\d+)/);
              return match ? Number(match[1]) : 0;
            })
            .reduce((max, value) => Math.max(max, value), 0);
          resolvedTitle = formatTaskListTitle(Math.max(maxIndex + 1, 1));
        }
        const documentId = await db.createDocument({
          projectId: input.projectId,
          parentId: resolvedParentId,
          title: resolvedTitle,
          type: input.type,
          content: input.content ?? '',
          order: input.order,
          wordCount: input.content?.length ?? 0,
          isDeleted: false,
        });

        // 创建初始版本
        if (input.content) {
          await db.createDocumentVersion({
            documentId,
            content: input.content,
            wordCount: input.content.length,
            versionNumber: 1,
            createdBy: ctx.user.id,
          });
        }

        return { documentId };
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentById(input.documentId);
      }),

    update: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        order: z.number().optional(),
        parentId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { documentId, ...updates } = input;
        
        // 如果内容变更，更新字数
        if (updates.content !== undefined) {
          const wordCount = updates.content.length;
          await db.updateDocument(documentId, { ...updates, wordCount });

          // 创建新版本
          const doc = await db.getDocumentById(documentId);
          if (doc) {
            const versions = await db.getDocumentVersions(documentId);
            const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
            
            await db.createDocumentVersion({
              documentId,
              content: updates.content,
              wordCount,
              versionNumber: nextVersion,
              createdBy: ctx.user.id,
            });
          }
        } else {
          await db.updateDocument(documentId, updates);
        }

        return { success: true };
      }),

    appendTask: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        task: z.string().min(1),
        threshold: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const threshold = input.threshold ?? 100;
        const documents = await db.getProjectDocuments(input.projectId);
        const normalizedDocs = await normalizeTaskListDocuments(ctx.user.id, input.projectId, documents);
        const taskListFolder = normalizedDocs.find(
          doc => doc.type === "folder" && doc.title === "任务列表"
        );
        if (!taskListFolder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务列表文件夹未创建" });
        }
        const taskListDocs = normalizedDocs
          .filter(doc => doc.parentId === taskListFolder.id && doc.title.startsWith("任务列表_"))
          .map(doc => {
            const match = doc.title.match(/任务列表_(\d+)/);
            return { doc, index: match ? Number(match[1]) : 0 };
          })
          .sort((a, b) => b.index - a.index);
        let targetDoc = taskListDocs[0]?.doc;
        let targetIndex = taskListDocs[0]?.index ?? 1;
        if (!targetDoc) {
          const documentId = await db.createDocument({
            projectId: input.projectId,
            parentId: taskListFolder.id,
            title: formatTaskListTitle(1),
            type: "setting",
            content: "",
            order: 10,
            wordCount: 0,
            isDeleted: false,
          });
          targetDoc = await db.getDocumentById(documentId);
          targetIndex = 1;
        }
        const initialContent = targetDoc?.content ?? "";
        const currentCount = countTaskItems(initialContent);
        if (currentCount >= threshold) {
          const nextIndex = Math.max(targetIndex + 1, 1);
          const documentId = await db.createDocument({
            projectId: input.projectId,
            parentId: taskListFolder.id,
            title: formatTaskListTitle(nextIndex),
            type: "setting",
            content: "",
            order: (nextIndex + 1) * 10,
            wordCount: 0,
            isDeleted: false,
          });
          targetDoc = await db.getDocumentById(documentId);
          targetIndex = nextIndex;
        }
        if (!targetDoc) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "任务列表创建失败" });
        }
        const currentContent = targetDoc.content ?? "";
        const nextContent = currentContent
          ? `${currentContent}\n- [ ] ${input.task}`
          : `- [ ] ${input.task}`;
        await db.updateDocument(targetDoc.id, {
          content: nextContent,
          wordCount: nextContent.length,
        });
        const versions = await db.getDocumentVersions(targetDoc.id);
        const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
        await db.createDocumentVersion({
          documentId: targetDoc.id,
          content: nextContent,
          wordCount: nextContent.length,
          versionNumber: nextVersion,
          createdBy: ctx.user.id,
        });
        return {
          documentId: targetDoc.id,
          title: targetDoc.title,
          taskCount: countTaskItems(nextContent),
          listIndex: targetIndex,
        };
      }),

    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        await db.softDeleteDocument(input.documentId);
        return { success: true };
      }),

    versions: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentVersions(input.documentId);
      }),
  }),

  // ============= 角色管理 =============
  characters: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectCharacters(input.projectId);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        appearance: z.string().optional(),
        personality: z.string().optional(),
        background: z.string().optional(),
        role: z.string().optional(),
        age: z.number().optional(),
        gender: z.string().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const characterId = await db.createCharacter({
          projectId: input.projectId,
          name: input.name,
          appearance: input.appearance ?? null,
          personality: input.personality ?? null,
          background: input.background ?? null,
          role: input.role ?? null,
          age: input.age ?? null,
          gender: input.gender ?? null,
          avatarUrl: input.avatarUrl ?? null,
          avatarKey: input.avatarKey ?? null,
          customFields: null,
        });
        return { characterId };
      }),

    get: protectedProcedure
      .input(z.object({ characterId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCharacterById(input.characterId);
      }),

    update: protectedProcedure
      .input(z.object({
        characterId: z.number(),
        name: z.string().optional(),
        appearance: z.string().optional(),
        personality: z.string().optional(),
        background: z.string().optional(),
        role: z.string().optional(),
        age: z.number().optional(),
        gender: z.string().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { characterId, ...updates } = input;
        await db.updateCharacter(characterId, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ characterId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCharacter(input.characterId);
        return { success: true };
      }),

    relationships: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectCharacterRelationships(input.projectId);
      }),

    createRelationship: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        characterAId: z.number(),
        characterBId: z.number(),
        relationshipType: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const relationshipId = await db.createCharacterRelationship({
          projectId: input.projectId,
          characterAId: input.characterAId,
          characterBId: input.characterBId,
          relationshipType: input.relationshipType,
          description: input.description ?? null,
        });
        return { relationshipId };
      }),

    deleteRelationship: protectedProcedure
      .input(z.object({ relationshipId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCharacterRelationship(input.relationshipId);
        return { success: true };
      }),
  }),

  // ============= Timeline Management =============
  timeline: router({
    nodes: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectTimelineNodes(input.projectId);
      }),

    createNode: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        nodeType: z.enum(['event', 'decision', 'branch', 'merge']),
        timePosition: z.number(),
        groupPosition: z.number().default(0),
        documentId: z.number().optional(),
        characterIds: z.array(z.number()).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const nodeId = await db.createTimelineNode({
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          nodeType: input.nodeType,
          timePosition: input.timePosition,
          groupPosition: input.groupPosition,
          documentId: input.documentId ?? null,
          characterIds: input.characterIds ?? null,
          tags: input.tags ?? null,
        });
        return { nodeId };
      }),

    updateNode: protectedProcedure
      .input(z.object({
        nodeId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        timePosition: z.number().optional(),
        groupPosition: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { nodeId, ...updates } = input;
        await db.updateTimelineNode(nodeId, updates);
        return { success: true };
      }),

    deleteNode: protectedProcedure
      .input(z.object({ nodeId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTimelineNode(input.nodeId);
        return { success: true };
      }),

    connections: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectTimelineConnections(input.projectId);
      }),

    createConnection: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        sourceNodeId: z.number(),
        targetNodeId: z.number(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
        connectionType: z.string().default('normal'),
        label: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const connectionId = await db.createTimelineConnection({
          projectId: input.projectId,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          sourceHandle: input.sourceHandle ?? null,
          targetHandle: input.targetHandle ?? null,
          connectionType: input.connectionType,
          label: input.label ?? null,
        });
        return { connectionId };
      }),

    deleteConnection: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTimelineConnection(input.connectionId);
        return { success: true };
      }),
  }),

  // ============= AI Model Configuration =============
  aiModels: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAiModelConfigs(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        provider: z.string(),
        modelName: z.string(),
        apiKey: z.string(),
        apiEndpoint: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        topP: z.number().min(0).max(1).optional(),
        maxTokens: z.number().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const configId = await db.createAiModelConfig({
          userId: ctx.user.id,
          name: input.name,
          provider: input.provider,
          modelName: input.modelName,
          apiKey: input.apiKey,
          apiEndpoint: input.apiEndpoint ?? null,
          temperature: input.temperature?.toString() ?? '0.7',
          topP: input.topP?.toString() ?? '0.9',
          maxTokens: input.maxTokens ?? 2000,
          isDefault: input.isDefault ?? false,
          isActive: true,
        });
        return { configId };
      }),

    update: protectedProcedure
      .input(z.object({
        configId: z.number(),
        name: z.string().optional(),
        apiKey: z.string().optional(),
        apiEndpoint: z.string().optional(),
        temperature: z.number().optional(),
        topP: z.number().optional(),
        maxTokens: z.number().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { configId, ...updates } = input;
        const dbUpdates: any = { ...updates };
        if (updates.temperature !== undefined) dbUpdates.temperature = updates.temperature.toString();
        if (updates.topP !== undefined) dbUpdates.topP = updates.topP.toString();
        await db.updateAiModelConfig(configId, dbUpdates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiModelConfig(input.configId);
        return { success: true };
      }),

    usageLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ ctx, input }) => {
        return await db.getUserAiUsageLogs(ctx.user.id, input.limit);
      }),
  }),

  // ============= AI Generation =============
  ai: router({
    getChatHistory: protectedProcedure
      .input(z.object({ projectId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const messages = await db.getChatMessages(input.projectId, input.limit);
        return messages.reverse(); // Return in chronological order
      }),

    saveChatMessage: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createChatMessage({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: input.role,
          content: input.content
        });
        return { success: true };
      }),

    generateChapter: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        prompt: z.string(),
        context: z.string().optional(),
        temperature: z.number().optional(),
        topP: z.number().optional(),
        maxTokens: z.number().optional(),
        autoSync: z.boolean().optional(),
        chapterTitle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await ai.generateChapterContent(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.prompt,
          input.context,
          {
            temperature: input.temperature,
            topP: input.topP,
            maxTokens: input.maxTokens,
          }
        );

        // 如果启用自动同步，提取并同步信息
        if (input.autoSync && result.content) {
          const { fullSyncFromGeneratedContent } = await import('./characterSettingSync');
          const syncResult = await fullSyncFromGeneratedContent(
            input.projectId,
            ctx.user.id,
            result.content,
            {
              chapterTitle: input.chapterTitle,
            }
          );
          return { ...result, syncResult };
        }

        return result;
      }),

    continue: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        documentId: z.number(),
        existingContent: z.string(),
        length: z.enum(['short', 'medium', 'long']).default('medium'),
        temperature: z.number().optional(),
        topP: z.number().optional(),
        maxTokens: z.number().optional(),
        autoSync: z.boolean().optional(),
        chapterTitle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await ai.continueWriting(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.documentId,
          input.existingContent,
          input.length,
          {
            temperature: input.temperature,
            topP: input.topP,
            maxTokens: input.maxTokens,
          }
        );

        // 如果启用自动同步，提取并同步信息
        if (input.autoSync && result.content) {
          const { fullSyncFromGeneratedContent } = await import('./characterSettingSync');
          const syncResult = await fullSyncFromGeneratedContent(
            input.projectId,
            ctx.user.id,
            result.content,
            {
              chapterTitle: input.chapterTitle,
            }
          );
          return { ...result, syncResult };
        }

        return result;
      }),

    optimize: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        documentId: z.number(),
        content: z.string(),
        type: z.enum(['polish', 'expand', 'rewrite']),
      }))
      .mutation(async ({ ctx, input }) => {
        return await ai.optimizeContent(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.documentId,
          input.content,
          input.type
        );
      }),

    generateInspiration: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        topic: z.string(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await ai.generateInspiration(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.topic,
          input.context
        );
      }),

    generateCharacterProfile: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        characterName: z.string(),
        characterRole: z.string(),
        worldviewContext: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await ai.generateCharacterProfile(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.characterName,
          input.characterRole,
          input.worldviewContext
        );
      }),

    checkConsistency: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        content: z.string(),
        characters: z.array(z.string()),
        settings: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        return await ai.checkConsistency(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.content,
          input.characters,
          input.settings
        );
      }),

    batchGenerate: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        prompt: z.string(),
        context: z.string().optional(),
        count: z.number().min(2).max(5).default(3),
      }))
      .mutation(async ({ ctx, input }) => {
        const modelConfig = await db.getAiModelConfigById(input.modelConfigId);
        if (!modelConfig) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Model config not found' });
        }

        const { batchGenerate } = await import('./aiStream');
        const results = await batchGenerate({
          prompt: input.prompt,
          context: input.context,
          apiKey: modelConfig.apiKey,
          apiEndpoint: modelConfig.apiEndpoint || undefined,
          temperature: Number(modelConfig.temperature),
          count: input.count,
        });

        // Log AI usage for each version
        for (const result of results) {
          await db.createAiUsageLog({
            userId: ctx.user.id,
            projectId: input.projectId,
            modelConfigId: input.modelConfigId,
            operationType: 'batch_generate',
            promptTokens: Math.ceil(input.prompt.length / 4),
            completionTokens: Math.ceil(result.length / 4),
            totalTokens: Math.ceil((input.prompt.length + result.length) / 4),
            success: true,
          });
        }

        return { versions: results };
      }),

    agentInteract: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        message: z.string(),
        currentFile: z.object({
          path: z.string(),
          content: z.string(),
        }).optional(),
        useMultiAgent: z.boolean().optional(),
        history: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const useMultiAgent = input.useMultiAgent ?? ENV.multiAgentEnabled;
        const result = useMultiAgent
          ? await multiAgentInteract(
              input.modelConfigId,
              ctx.user.id,
              input.projectId,
              input.message,
              input.currentFile,
              input.history
            )
          : {
              action: await ai.generateAgentAction(
                input.modelConfigId,
                ctx.user.id,
                input.projectId,
                input.message,
                input.currentFile,
                input.history
              ),
              trace: [],
              requestId: null,
            };
        const action = result.action;

        // Persist Planner's plan if available (Multi-Agent mode)
        if (useMultiAgent && result.trace) {
          const plannerStep = result.trace.find((t: any) => t.role === 'planner');
          if (plannerStep && plannerStep.action?.message) {
             await db.createChatMessage({
                projectId: input.projectId,
                userId: ctx.user.id,
                role: "assistant",
                content: `【写作规划】\n${plannerStep.action.message}`
             });
          }
        }

        // Persist final response
        let contentToSave = "";
        if (action.type === 'modify_file') {
          contentToSave = `我已经提出了修改建议 ${action.filePath || '文件'}。请查看。`;
        } else {
          contentToSave = action.message || "我不确定如何回答。";
        }
        await db.createChatMessage({
           projectId: input.projectId,
           userId: ctx.user.id,
           role: "assistant",
           content: contentToSave
        });

        if (action.type === 'modify_file' && action.filePath) {
             const logId = await createAgentLog({
                 userId: ctx.user.id,
                 operation: 'modify_file',
                 filePath: action.filePath,
                 contentBefore: input.currentFile?.content, 
                 contentAfter: action.newContent,
                 reason: action.reason,
                 status: 'pending',
             });
             return { ...action, logId, trace: result.trace, requestId: result.requestId };
        }

        return { ...action, trace: result.trace, requestId: result.requestId };
      }),

    startAgentInteract: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        message: z.string(),
        currentFile: z.object({
          path: z.string(),
          content: z.string(),
        }).optional(),
        history: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const requestId = runMultiAgentAsync(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.message,
          input.currentFile,
          input.history,
          async ({ final: action, trace }) => {
            // Persist Planner's plan
            const plannerStep = trace.find((t: any) => t.role === 'planner');
            if (plannerStep && plannerStep.action?.message) {
               await db.createChatMessage({
                  projectId: input.projectId,
                  userId: ctx.user.id,
                  role: "assistant",
                  content: `【写作规划】\n${plannerStep.action.message}`
               });
            }

            // Persist final response
            let contentToSave = "";
            if (action.type === 'modify_file') {
              contentToSave = `我已经提出了修改建议 ${action.filePath || '文件'}。请查看。`;
            } else {
              contentToSave = action.message || "我不确定如何回答。";
            }
            await db.createChatMessage({
               projectId: input.projectId,
               userId: ctx.user.id,
               role: "assistant",
               content: contentToSave
            });

            if (action.type === 'modify_file' && action.filePath) {
                 await createAgentLog({
                     userId: ctx.user.id,
                     operation: 'modify_file',
                     filePath: action.filePath,
                     contentBefore: input.currentFile?.content, 
                     contentAfter: action.newContent,
                     reason: action.reason,
                     status: 'pending',
                 });
            }
          }
        );
        return { requestId };
      }),

    pollAgentInteract: protectedProcedure
      .input(z.object({ requestId: z.string() }))
      .query(async ({ input }) => {
        const trace = getMultiAgentTrace(input.requestId);
        if (!trace) {
           throw new TRPCError({ code: 'NOT_FOUND', message: 'Trace not found' });
        }
        return trace;
      }),

    startTaskPlanner: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        repoUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const requestId = await startTaskPlannerAsync(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.repoUrl
        );
        return { requestId };
      }),

    pollTaskPlanner: protectedProcedure
      .input(z.object({ requestId: z.string() }))
      .query(async ({ input }) => {
        const trace = getTaskPlannerTrace(input.requestId);
        if (!trace) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Task planner trace not found' });
        }
        return trace;
      }),

    updateTaskPlannerItem: protectedProcedure
      .input(z.object({
        requestId: z.string(),
        id: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "paused"]).optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const updated = await updateTaskPlannerItem(input.requestId, {
          id: input.id,
          status: input.status,
          priority: input.priority,
        });
        if (!updated) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Task item not found' });
        }
        return { item: updated };
      }),

    pauseTaskPlanner: protectedProcedure
      .input(z.object({
        requestId: z.string(),
        paused: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const status = await setTaskPlannerPaused(input.requestId, input.paused);
        if (!status) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Task planner not found' });
        }
        return { status };
      }),

    authorInteract: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        message: z.string(),
        history: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const docSpecs = [
          { key: "mainStory", title: "主故事文档", type: "chapter" },
          { key: "characterProfiles", title: "人物设定档案", type: "character" },
          { key: "outline", title: "章节大纲", type: "outline" },
          { key: "worldview", title: "世界观设定", type: "worldview" },
          { key: "memo", title: "写作备忘录", type: "setting" },
        ] as const;

        const existingDocs = await db.getProjectDocuments(input.projectId);
        const ensuredDocs = new Map<string, { id: number; title: string; type: string; content: string | null }>();

        for (const spec of docSpecs) {
          const found = existingDocs.find(
            doc => doc.title === spec.title && doc.type === spec.type
          );
          if (found) {
            ensuredDocs.set(spec.key, found as any);
            continue;
          }
          const documentId = await db.createDocument({
            projectId: input.projectId,
            parentId: null,
            title: spec.title,
            type: spec.type,
            content: "",
            order: 0,
            wordCount: 0,
            isDeleted: false,
          });
          ensuredDocs.set(spec.key, {
            id: documentId,
            title: spec.title,
            type: spec.type,
            content: "",
          });
        }

        const agentResult = await authorAgentInteract(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.message,
          {
            history: input.history,
            documents: {
              mainStory: {
                title: "主故事文档",
                content: ensuredDocs.get("mainStory")?.content ?? "",
              },
              characterProfiles: {
                title: "人物设定档案",
                content: ensuredDocs.get("characterProfiles")?.content ?? "",
              },
              outline: {
                title: "章节大纲",
                content: ensuredDocs.get("outline")?.content ?? "",
              },
              worldview: {
                title: "世界观设定",
                content: ensuredDocs.get("worldview")?.content ?? "",
              },
              memo: {
                title: "写作备忘录",
                content: ensuredDocs.get("memo")?.content ?? "",
              },
            },
          }
        );

        const updatedDocuments: Array<{ documentId: number; title: string }> = [];
        for (const spec of docSpecs) {
          const target = ensuredDocs.get(spec.key);
          if (!target) continue;
          const update = agentResult.documents[spec.key];
          if (!update?.content || update.content === target.content) continue;
          await db.updateDocument(target.id, {
            content: update.content,
            wordCount: update.content.length,
          });
          const versions = await db.getDocumentVersions(target.id);
          const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
          await db.createDocumentVersion({
            documentId: target.id,
            content: update.content,
            wordCount: update.content.length,
            versionNumber: nextVersion,
            createdBy: ctx.user.id,
          });
          updatedDocuments.push({ documentId: target.id, title: target.title });
        }

        let relationshipsCreated = 0;
        if (agentResult.relationships.length > 0) {
          const characters = await db.getProjectCharacters(input.projectId);
          const relationships = await db.getProjectCharacterRelationships(input.projectId);
          const byName = new Map(
            characters.map(char => [char.name.toLowerCase(), char])
          );
          const relationshipKeys = new Set(
            relationships.map(rel => `${rel.characterAId}-${rel.characterBId}-${rel.relationshipType}`)
          );
          for (const relation of agentResult.relationships) {
            if (!relation.from || !relation.to || !relation.type) continue;
            const fromKey = relation.from.toLowerCase();
            const toKey = relation.to.toLowerCase();
            let fromChar = byName.get(fromKey);
            let toChar = byName.get(toKey);
            if (!fromChar) {
              const id = await db.createCharacter({
                projectId: input.projectId,
                name: relation.from,
                appearance: null,
                personality: null,
                background: null,
                role: null,
                age: null,
                gender: null,
                avatarUrl: null,
                avatarKey: null,
                customFields: null,
              });
              fromChar = { id, name: relation.from } as any;
            }
            if (fromChar) {
              byName.set(fromKey, fromChar);
            }
            if (!toChar) {
              const id = await db.createCharacter({
                projectId: input.projectId,
                name: relation.to,
                appearance: null,
                personality: null,
                background: null,
                role: null,
                age: null,
                gender: null,
                avatarUrl: null,
                avatarKey: null,
                customFields: null,
              });
              toChar = { id, name: relation.to } as any;
            }
            if (toChar) {
              byName.set(toKey, toChar);
            }
            if (!fromChar || !toChar) continue;
            const keyA = `${fromChar.id}-${toChar.id}-${relation.type}`;
            const keyB = `${toChar.id}-${fromChar.id}-${relation.type}`;
            if (relationshipKeys.has(keyA) || relationshipKeys.has(keyB)) continue;
            await db.createCharacterRelationship({
              projectId: input.projectId,
              characterAId: fromChar.id,
              characterBId: toChar.id,
              relationshipType: relation.type,
              description: relation.description ?? null,
            });
            relationshipKeys.add(keyA);
            relationshipsCreated += 1;
          }
        }

        let timelineNodesCreated = 0;
        if (agentResult.timeline.length > 0) {
          const nodes = await db.getProjectTimelineNodes(input.projectId);
          const basePosition = nodes.length;
          let idx = 0;
          for (const item of agentResult.timeline) {
            if (!item.title) continue;
            const timePosition = typeof item.timePosition === "number"
              ? item.timePosition
              : (basePosition + idx) * 100;
            await db.createTimelineNode({
              projectId: input.projectId,
              title: item.title,
              description: item.description ?? null,
              nodeType: "event",
              timePosition,
              groupPosition: 0,
              documentId: ensuredDocs.get("mainStory")?.id ?? null,
              characterIds: null,
              tags: item.importance ? [item.importance] : null,
            });
            timelineNodesCreated += 1;
            idx += 1;
          }
        }

        return {
          reply: agentResult.reply,
          intent: agentResult.intent,
          contextSummary: agentResult.contextSummary,
          documents: agentResult.documents,
          suggestions: agentResult.suggestions,
          relationships: agentResult.relationships,
          timeline: agentResult.timeline,
          consistency: agentResult.consistency,
          creativity: agentResult.creativity,
          durationMs: agentResult.durationMs,
          requestId: agentResult.requestId,
          updates: {
            documents: updatedDocuments,
            relationshipsCreated,
            timelineNodesCreated,
          },
        };
      }),

    getAgentTrace: protectedProcedure
      .input(z.object({ requestId: z.string() }))
      .query(async ({ input }) => {
        return getMultiAgentTrace(input.requestId);
      }),

    chat: protectedProcedure
      .input(z.object({
        modelConfigId: z.number(),
        projectId: z.number(),
        message: z.string(),
        history: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const content = await ai.generateChatResponse(
          input.modelConfigId,
          ctx.user.id,
          input.projectId,
          input.message,
          input.history
        );
        await db.createChatMessage({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "assistant",
          content: content,
        });
        return { content };
      }),
  }),

  // ============= Export =============
  exports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserExportRecords(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        format: z.enum(['pdf', 'epub', 'word', 'html']),
      }))
      .mutation(async ({ ctx, input }) => {
        const recordId = await db.createExportRecord({
          projectId: input.projectId,
          userId: ctx.user.id,
          format: input.format,
          fileUrl: null,
          fileKey: null,
          fileSize: null,
          status: 'pending',
          errorMessage: null,
        });
        
        // Start export process asynchronously
        const exportLib = await import('./export');
        exportLib.generateExport(input.projectId, input.format, ctx.user.id, recordId).catch(err => {
          console.error('Export failed:', err);
        });
        
        return { recordId };
      }),

    get: protectedProcedure
      .input(z.object({ recordId: z.number() }))
      .query(async ({ input }) => {
        return await db.getExportRecordById(input.recordId);
      }),
  }),

  // ============= Statistics =============
  statistics: router({
    get: protectedProcedure
      .query(async ({ ctx }) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const records = await db.getUserWritingStatistics(ctx.user.id, startDate, endDate);
        
        // Calculate aggregated statistics
        const totalWords = records.reduce((sum, r) => sum + r.wordsWritten, 0);
        const totalMinutes = records.reduce((sum, r) => sum + r.writingDuration, 0);
        const totalAiCalls = records.reduce((sum, r) => sum + r.aiUsageCount, 0);
        const aiGeneratedWords = records.reduce((sum, r) => sum + r.aiGeneratedWords, 0);
        
        return {
          totalWords,
          totalMinutes,
          totalAiCalls,
          totalProjects: 0, // TODO: calculate from projects table
          avgWordsPerDay: Math.round(totalWords / 30),
          avgMinutesPerDay: Math.round(totalMinutes / 30),
          activeDays: records.length,
          totalTokens: totalAiCalls * 500, // Estimated
          aiGeneratedWords,
          avgResponseTime: 2, // Estimated
          mostActiveHour: 14, // TODO: calculate from records
          longestStreak: 0, // TODO: calculate
          currentStreak: 0, // TODO: calculate
          totalChapters: 0, // TODO: calculate from documents
          totalCharacters: 0, // TODO: calculate from characters
          avgChapterWords: 0, // TODO: calculate
        };
      }),

    record: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        wordsWritten: z.number().default(0),
        writingDuration: z.number().default(0),
        aiGeneratedWords: z.number().default(0),
        aiUsageCount: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        await db.createOrUpdateWritingStatistic({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          date: today,
          wordsWritten: input.wordsWritten,
          writingDuration: input.writingDuration,
          aiGeneratedWords: input.aiGeneratedWords,
          aiUsageCount: input.aiUsageCount,
        });
        
        return { success: true };
      }),
  }),

  // ============= Platform Publishing =============
  publishing: router({
    // Platform account management
    createAccount: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        username: z.string(),
        password: z.string().optional(),
        apiKey: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const accountId = await publishingDb.createPlatformAccount({
          userId: ctx.user.id,
          platform: input.platform,
          username: input.username,
          encryptedPassword: input.password ? publishingDb.encryptPassword(input.password) : undefined,
          apiKey: input.apiKey || undefined,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
        });
        return { accountId };
      }),

    listAccounts: protectedProcedure.query(async ({ ctx }) => {
      return await publishingDb.getPlatformAccountsByUser(ctx.user.id);
    }),

    deleteAccount: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        await publishingDb.deletePlatformAccount(input.accountId);
        return { success: true };
      }),

    // Publishing task management
    createTask: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        platformAccountId: z.number(),
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        publishConfig: z.object({
          title: z.string(),
          description: z.string(),
          coverUrl: z.string().optional(),
          category: z.string(),
          tags: z.array(z.string()),
          chapterIds: z.array(z.number()),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const taskId = await publishingDb.createPublishingTask({
          userId: ctx.user.id,
          projectId: input.projectId,
          platformAccountId: input.platformAccountId,
          platform: input.platform,
          publishConfig: JSON.stringify(input.publishConfig),
          totalChapters: input.publishConfig.chapterIds.length,
          publishedChapters: 0,
          failedChapters: 0,
          platformWorkId: undefined,
          platformWorkUrl: undefined,
          errorMessage: undefined,
          errorLog: undefined,
          completedAt: undefined,
        });
        return { taskId };
      }),

    listTasks: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.projectId) {
          return await publishingDb.getPublishingTasksByProject(input.projectId);
        }
        return await publishingDb.getPublishingTasksByUser(ctx.user.id);
      }),

    getTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await publishingDb.getPublishingTask(input.taskId);
      }),

    getLogs: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await publishingDb.getPublishingLogs(input.taskId);
      }),

    // Pre-check before publishing
    precheck: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        publishConfig: z.object({
          title: z.string(),
          description: z.string(),
          coverUrl: z.string().optional(),
          category: z.string(),
          tags: z.array(z.string()),
          chapterIds: z.array(z.number()),
        }),
      }))
      .mutation(async ({ input }) => {
        const result = await precheck.runPrecheck(
          input.publishConfig.chapterIds,
          input.publishConfig,
          input.platform
        );
        return result;
      }),

    // Auto-fix issues
    autoFix: protectedProcedure
      .input(z.object({
        chapterIds: z.array(z.number()),
        issues: z.array(z.any()),
      }))
      .mutation(async ({ input }) => {
        const result = await precheck.autoFixIssues(input.chapterIds, input.issues);
        return result;
      }),

    // Execute publishing (simplified - actual implementation would be async job)
    executeTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await publishingDb.getPublishingTask(input.taskId);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

        const account = await publishingDb.getPlatformAccount(task.platformAccountId);
        if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform account not found' });

        // Update task status
        await publishingDb.updatePublishingTask(input.taskId, { status: "processing" });
        await publishingDb.createPublishingLog({
          taskId: input.taskId,
          level: "info",
          message: "Publishing task started",
          details: null,
        });

        try {
          const config = JSON.parse((task.publishConfig as string) || "{}");
          
          // Note: This is a simplified synchronous implementation
          // In production, this should be an async background job
          
          if (task.platform === "qidian") {
            const client = createQidianClient({
              username: account.username,
              accessToken: account.accessToken || undefined,
              apiKey: account.apiKey || undefined,
            });

            // Simulate work creation
            await publishingDb.createPublishingLog({
              taskId: input.taskId,
              level: "info",
              message: `Creating work on Qidian: ${config.title}`,
              details: null,
            });

            // In real implementation, call: const work = await client.createWork({...});
            // For now, simulate success
            const mockWorkId = `qd_${Date.now()}`;
            await publishingDb.updatePublishingTask(input.taskId, {
              platformWorkId: mockWorkId,
              platformWorkUrl: `https://www.qidian.com/book/${mockWorkId}`,
            });

            // Simulate chapter uploads
            const chapterCount = config.chapterIds?.length || 0;
            await publishingDb.updatePublishingTask(input.taskId, {
              publishedChapters: chapterCount,
            });

            await publishingDb.createPublishingLog({
              taskId: input.taskId,
              level: "info",
              message: `Successfully published ${chapterCount} chapters`,
              details: null,
            });
          } else if (task.platform === "jinjiang") {
            const client = createJinjiangClient({
              username: account.username,
              accessToken: account.accessToken || undefined,
              apiKey: account.apiKey || undefined,
            });

            await publishingDb.createPublishingLog({
              taskId: input.taskId,
              level: "info",
              message: `Creating work on Jinjiang: ${config.title}`,
              details: null,
            });

            const mockWorkId = `jj_${Date.now()}`;
            await publishingDb.updatePublishingTask(input.taskId, {
              platformWorkId: mockWorkId,
              platformWorkUrl: `https://www.jjwxc.net/onebook.php?novelid=${mockWorkId}`,
            });

            const chapterCount = config.chapterIds?.length || 0;
            await publishingDb.updatePublishingTask(input.taskId, {
              publishedChapters: chapterCount,
            });

            await publishingDb.createPublishingLog({
              taskId: input.taskId,
              level: "info",
              message: `Successfully published ${chapterCount} chapters`,
              details: null,
            });
          }

          await publishingDb.updatePublishingTask(input.taskId, {
            status: "completed",
            completedAt: new Date(),
          });

          await publishingDb.createPublishingLog({
            taskId: input.taskId,
            level: "info",
            message: "Publishing task completed successfully",
            details: null,
          });

          return { success: true };
        } catch (error: any) {
          await publishingDb.updatePublishingTask(input.taskId, {
            status: "failed",
            errorMessage: error.message,
          });

          await publishingDb.createPublishingLog({
            taskId: input.taskId,
            level: "error",
            message: "Publishing task failed",
            details: error.message,
          });

          throw error;
        }
      }),
  }),

  // ============= Collaboration =============
  collaboration: router({
    listCollaborators: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectCollaborators(input.projectId);
      }),

    addCollaborator: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        role: z.enum(['owner', 'editor', 'viewer']),
      }))
      .mutation(async ({ ctx, input }) => {
        const collaboratorId = await db.addProjectCollaborator({
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
          permissions: null,
          invitedBy: ctx.user.id,
          acceptedAt: null,
        });
        return { collaboratorId };
      }),

    removeCollaborator: protectedProcedure
      .input(z.object({ collaboratorId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeProjectCollaborator(input.collaboratorId);
        return { success: true };

      }),
  }),
  // ============= TTS (Text-to-Speech) =============
  tts: router({
    // Generate speech from text
    generate: protectedProcedure
      .input(z.object({
        text: z.string(),
        voice: z.string().optional(),
        rate: z.number().min(0.1).max(10).optional(),
        pitch: z.number().min(0).max(2).optional(),
        volume: z.number().min(0).max(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await tts.generateSpeech(input);
        
        if (result.error) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error });
        }
        
        // Convert audio buffer to base64 for transmission
        const audioBase64 = result.audioData?.toString('base64');
        
        return {
          audioData: audioBase64,
          duration: result.duration,
        };
      }),

    // Get available voices
    getVoices: publicProcedure
      .query(() => {
        return tts.getAvailableVoices();
      }),

    // Split long text for TTS
    splitText: publicProcedure
      .input(z.object({
        text: z.string(),
        maxLength: z.number().optional(),
      }))
      .query(({ input }) => {
        return tts.splitTextForTTS(input.text, input.maxLength);
      }),
  }),

  // ============= STT (Speech-to-Text) =============
  stt: router({
    // Transcribe audio to text
    transcribe: protectedProcedure
      .input(z.object({
        audioData: z.string(), // Base64 encoded audio
        language: z.string().optional(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const audioBuffer = Buffer.from(input.audioData, "base64");
        const result = await stt.transcribeAudio({
          audioData: audioBuffer,
          language: input.language,
          prompt: input.prompt,
        });
        return result;
      }),

    // Get supported languages
    getSupportedLanguages: publicProcedure
      .query(() => {
        return stt.getSupportedLanguages();
      }),
  }),

  // ============= Sensitive Words Management =============
  sensitiveWords: router({
    // Get all sensitive words with optional filters
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getSensitiveWords } = await import("./sensitiveWordsDb");
        return await getSensitiveWords(input);
      }),

    // Get categories
    getCategories: protectedProcedure
      .query(async () => {
        const { getCategories } = await import("./sensitiveWordsDb");
        return await getCategories();
      }),

    // Create sensitive word
    create: protectedProcedure
      .input(z.object({
        word: z.string(),
        category: z.string(),
        isRegex: z.boolean().optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        replacement: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { createSensitiveWord } = await import("./sensitiveWordsDb");
        return await createSensitiveWord({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    // Update sensitive word
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        word: z.string().optional(),
        category: z.string().optional(),
        isRegex: z.boolean().optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        replacement: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateSensitiveWord } = await import("./sensitiveWordsDb");
        const { id, ...updates } = input;
        return await updateSensitiveWord(id, updates);
      }),

    // Delete sensitive word
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteSensitiveWord } = await import("./sensitiveWordsDb");
        await deleteSensitiveWord(input.id);
        return { success: true };
      }),

    // Bulk delete
    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { bulkDeleteSensitiveWords } = await import("./sensitiveWordsDb");
        await bulkDeleteSensitiveWords(input.ids);
        return { success: true };
      }),

    // Bulk import
    bulkImport: protectedProcedure
      .input(z.object({
        words: z.array(z.object({
          word: z.string(),
          category: z.string(),
          isRegex: z.boolean().optional(),
          severity: z.enum(["low", "medium", "high"]).optional(),
          replacement: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const { bulkCreateSensitiveWords } = await import("./sensitiveWordsDb");
        const wordsWithCreator = input.words.map(w => ({
          ...w,
          createdBy: ctx.user.id,
        }));
        await bulkCreateSensitiveWords(wordsWithCreator);
        return { success: true, count: input.words.length };
      }),

    importStandard: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { importStandardSensitiveWords } = await import("./sensitiveWordsDb");
        return await importStandardSensitiveWords(ctx.user.id);
      }),
  }),

  // ============= Platform Rules Management =============
  platformRules: router({
    // Get all platforms
    getAllPlatforms: protectedProcedure
      .query(async () => {
        const { getAllPlatforms } = await import("./db/platformRulesDb");
        return await getAllPlatforms();
      }),

    // Get rules for a specific platform
    getRules: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      }))
      .query(async ({ input }) => {
        const { getPlatformRules } = await import("./db/platformRulesDb");
        return await getPlatformRules(input.platform);
      }),

    getPresets: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      }))
      .query(async ({ input }) => {
        const { getPresetPlatformRules } = await import("./db/platformRulesDb");
        return getPresetPlatformRules(input.platform);
      }),

    importPresets: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        activate: z.boolean().default(true),
        version: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { importPresetPlatformRules } = await import("./db/platformRulesDb");
        return await importPresetPlatformRules(input.platform, {
          activate: input.activate,
          version: input.version,
        });
      }),

    // Get latest active rule
    getLatestRule: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
      }))
      .query(async ({ input }) => {
        const { getLatestPlatformRule } = await import("./db/platformRulesDb");
        return await getLatestPlatformRule(input.platform);
      }),

    // Get rule by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getPlatformRuleById } = await import("./db/platformRulesDb");
        return await getPlatformRuleById(input.id);
      }),

    // Create a new rule
    create: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        ruleType: z.string(),
        ruleName: z.string(),
        ruleValue: z.any(),
        description: z.string().optional(),
        version: z.string().default("1.0"),
        isActive: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { createPlatformRule } = await import("./db/platformRulesDb");
        const ruleId = await createPlatformRule(input);
        return { id: ruleId, success: true };
      }),

    // Update a rule
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        ruleType: z.string().optional(),
        ruleName: z.string().optional(),
        ruleValue: z.any().optional(),
        description: z.string().optional(),
        version: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updatePlatformRule } = await import("./db/platformRulesDb");
        const { id, ...updates } = input;
        await updatePlatformRule(id, updates);
        return { success: true };
      }),

    // Delete a rule
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deletePlatformRule } = await import("./db/platformRulesDb");
        await deletePlatformRule(input.id);
        return { success: true };
      }),

    // Activate a rule
    activate: protectedProcedure
      .input(z.object({
        platform: z.enum(["qidian", "jinjiang", "zongheng", "17k"]),
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { activatePlatformRule } = await import("./db/platformRulesDb");
        await activatePlatformRule(input.platform, input.id);
        return { success: true };
      }),
  }),

  // ============= Task Queue Monitoring =============
  queue: router({
    // Get all tasks for current user
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const { getAllTasks } = await import("./queue");
        return await getAllTasks(ctx.user.id);
      }),

    // Get task status by job ID
    getStatus: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const { getTaskStatus } = await import("./queue");
        return await getTaskStatus(input.jobId);
      }),

    // Pause task
    pause: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input }) => {
        const { pauseTask } = await import("./queue");
        const success = await pauseTask(input.jobId);
        return { success };
      }),

    // Resume task
    resume: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input }) => {
        const { resumeTask } = await import("./queue");
        const success = await resumeTask(input.jobId);
        return { success };
      }),

    // Cancel task
    cancel: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input }) => {
        const { cancelTask } = await import("./queue");
        const success = await cancelTask(input.jobId);
        return { success };
      }),

    // Get queue statistics
    stats: protectedProcedure
      .query(async () => {
        const { publishQueue } = await import("./queue");
        const [waiting, active, completed, failed] = await Promise.all([
          publishQueue.getWaitingCount(),
          publishQueue.getActiveCount(),
          publishQueue.getCompletedCount(),
          publishQueue.getFailedCount(),
        ]);
        return { waiting, active, completed, failed };
      }),
  }),

  // ============= Speech Recognition History =============
  speechHistory: router({
    // Create speech history
    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        documentId: z.number().optional(),
        audioData: z.string().optional(),
        audioFormat: z.string().default('webm'),
        audioDuration: z.number().optional(),
        transcript: z.string(),
        language: z.string().default('zh'),
        recognitionType: z.enum(['file', 'streaming']).default('file'),
        confidence: z.number().optional(),
        metadata: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createSpeechHistory } = await import("./db/speechHistoryDb");
        let audioUrl: string | undefined;

        // Upload audio to S3 if provided
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
          projectId: input.projectId ?? null,
          documentId: input.documentId ?? null,
          audioUrl: audioUrl ?? null,
          audioFormat: input.audioFormat,
          audioDuration: input.audioDuration ?? null,
          transcript: input.transcript,
          language: input.language,
          recognitionType: input.recognitionType,
          confidence: input.confidence ? input.confidence.toString() : null,
          metadata: input.metadata ?? null,
        });

        return history;
      }),

    // List speech history
    list: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
        searchText: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getSpeechHistoryByUser } = await import("./db/speechHistoryDb");
        return await getSpeechHistoryByUser(ctx.user.id, {
          projectId: input.projectId,
          limit: input.limit,
          offset: input.offset,
          searchText: input.searchText,
        });
      }),

    // Get speech history by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getSpeechHistoryById } = await import("./db/speechHistoryDb");
        return await getSpeechHistoryById(input.id);
      }),

    // Update speech history
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        transcript: z.string().optional(),
        metadata: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateSpeechHistory } = await import("./db/speechHistoryDb");
        const success = await updateSpeechHistory(input.id, {
          transcript: input.transcript,
          metadata: input.metadata ?? null,
        });
        return { success };
      }),

    // Delete speech history
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteSpeechHistory } = await import("./db/speechHistoryDb");
        const success = await deleteSpeechHistory(input.id);
        return { success };
      }),

    // Batch delete speech history
    batchDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { batchDeleteSpeechHistory } = await import("./db/speechHistoryDb");
        const success = await batchDeleteSpeechHistory(input.ids);
        return { success };
      }),

    // Get speech history stats
    stats: protectedProcedure
      .query(async ({ ctx }) => {
        const { getSpeechHistoryStats } = await import("./db/speechHistoryDb");
        return await getSpeechHistoryStats(ctx.user.id);
      }),
  }),

  // ============= Extraction Rules =============
  extractionRules: router({
    // Create extraction rule
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        ruleType: z.enum(['event', 'character', 'setting', 'custom']),
        fields: z.array(z.object({
          name: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
          description: z.string(),
          required: z.boolean().optional(),
          example: z.any().optional(),
        })),
        prompt: z.string().optional(),
        projectId: z.number().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createExtractionRule } = await import('./db/extractionRulesDb');
        const ruleId = await createExtractionRule({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          name: input.name,
          description: input.description ?? null,
          ruleType: input.ruleType,
          fields: input.fields as any,
          prompt: input.prompt ?? null,
          priority: input.priority ?? 0,
          isActive: true,
        });
        return { id: ruleId };
      }),

    // List extraction rules
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getUserExtractionRules } = await import('./db/extractionRulesDb');
        return await getUserExtractionRules(ctx.user.id, input.projectId);
      }),

    // List active extraction rules
    listActive: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getActiveExtractionRules } = await import('./db/extractionRulesDb');
        return await getActiveExtractionRules(ctx.user.id, input.projectId);
      }),

    // Get extraction rule by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getExtractionRuleById } = await import('./db/extractionRulesDb');
        return await getExtractionRuleById(input.id);
      }),

    // Update extraction rule
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        ruleType: z.enum(['event', 'character', 'setting', 'custom']).optional(),
        fields: z.array(z.object({
          name: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
          description: z.string(),
          required: z.boolean().optional(),
          example: z.any().optional(),
        })).optional(),
        prompt: z.string().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateExtractionRule } = await import('./db/extractionRulesDb');
        const { id, ...updates } = input;
        await updateExtractionRule(id, updates as any);
        return { success: true };
      }),

    // Delete extraction rule
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteExtractionRule } = await import('./db/extractionRulesDb');
        await deleteExtractionRule(input.id);
        return { success: true };
      }),

    // Toggle extraction rule active status
    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const { toggleExtractionRuleActive } = await import('./db/extractionRulesDb');
        await toggleExtractionRuleActive(input.id, input.isActive);
        return { success: true };
      }),

    // Get preset templates
    getPresets: protectedProcedure
      .query(async () => {
        const { getPresetRuleTemplates } = await import('./db/extractionRulesDb');
        return getPresetRuleTemplates();
      }),

    // Create from template
    createFromTemplate: protectedProcedure
      .input(z.object({ templateIndex: z.number(), projectId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { getPresetRuleTemplates, createExtractionRule } = await import('./db/extractionRulesDb');
        const templates = getPresetRuleTemplates();
        const template = templates[input.templateIndex];
        if (!template) {
          throw new Error('Template not found');
        }
        const ruleId = await createExtractionRule({
          ...template,
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
        } as any);
        return { id: ruleId };
      }),
  }),

  // ============= Rule Stats =============
  ruleStats: router({
    // Get rule analytics
    getAnalytics: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getRuleAnalytics } = await import('./db/ruleStatsDb');
        return getRuleAnalytics(ctx.user.id, input.projectId);
      }),

    // Get rule usage history
    getUsageHistory: protectedProcedure
      .input(z.object({ ruleId: z.number(), limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const { getRuleUsageHistory } = await import('./db/ruleStatsDb');
        return getRuleUsageHistory(input.ruleId, ctx.user.id, input.limit);
      }),

    // Clean old stats
    cleanOldStats: protectedProcedure
      .mutation(async () => {
        const { cleanOldStats } = await import('./db/ruleStatsDb');
        const deletedCount = await cleanOldStats();
        return { deletedCount };
      }),
  }),
});

export type AppRouter = typeof appRouter;
