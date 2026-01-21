import axios from 'axios';
import { getAiModelConfigById, createAiUsageLog } from './db';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerateOptions {
  messages: AIMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIGenerateResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

/**
 * Calculate cost based on token usage
 * DeepSeek pricing (example): $0.14 per 1M input tokens, $0.28 per 1M output tokens
 */
function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1000000) * 0.14;
  const outputCost = (completionTokens / 1000000) * 0.28;
  return inputCost + outputCost;
}

/**
 * Generate content using AI model
 */
export async function generateWithAI(
  modelConfigId: number,
  options: AIGenerateOptions,
  userId: number,
  projectId?: number,
  documentId?: number
): Promise<AIGenerateResult> {
  const startTime = Date.now();
  
  try {
    // Get model configuration
    const config = await getAiModelConfigById(modelConfigId);
    if (!config) {
      throw new Error('AI model configuration not found');
    }

    // Prepare request
    const endpoint = config.apiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
    const temperature = options.temperature ?? Number(config.temperature) ?? 0.7;
    const topP = options.topP ?? Number(config.topP) ?? 0.9;
    const maxTokens = options.maxTokens ?? config.maxTokens ?? 2000;

    const response = await axios.post(
      endpoint,
      {
        model: config.modelName,
        messages: options.messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        timeout: 60000, // 60 seconds timeout
      }
    );

    const content = response.data.choices[0]?.message?.content || '';
    const promptTokens = response.data.usage?.prompt_tokens || 0;
    const completionTokens = response.data.usage?.completion_tokens || 0;
    const totalTokens = response.data.usage?.total_tokens || 0;
    const cost = calculateCost(promptTokens, completionTokens);
    const duration = Date.now() - startTime;

    // Log usage
    await createAiUsageLog({
      userId,
      projectId: projectId ?? null,
      documentId: documentId ?? null,
      modelConfigId,
      operationType: 'generate',
      promptTokens,
      completionTokens,
      totalTokens,
      cost: cost.toString(),
      duration,
      success: true,
      errorMessage: null,
    });

    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error("AI Generation Error:", error);
    if (error.response) {
      console.error("Response Data:", error.response.data);
      console.error("Response Status:", error.response.status);
    }

    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';

    // Log failed usage
    await createAiUsageLog({
      userId,
      projectId: projectId ?? null,
      documentId: documentId ?? null,
      modelConfigId,
      operationType: 'generate',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: '0',
      duration,
      success: false,
      errorMessage: errorMessage,
    });

    throw new Error(`AI generation failed: ${errorMessage}`);
  }
}

/**
 * Generate content for chapter
 */
export async function generateChapterContent(
  modelConfigId: number,
  userId: number,
  projectId: number,
  prompt: string,
  context?: string,
  paramOverrides?: { temperature?: number; topP?: number; maxTokens?: number }
): Promise<AIGenerateResult> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的小说创作助手，擅长根据提示生成高质量的小说内容。请保持故事的连贯性和文学性。',
    },
  ];

  if (context) {
    messages.push({
      role: 'user',
      content: `以下是故事的上下文：\n\n${context}`,
    });
  }

  messages.push({
    role: 'user',
    content: `请根据以下提示生成小说内容：\n\n${prompt}`,
  });

  return await generateWithAI(
    modelConfigId,
    {
      messages,
      temperature: paramOverrides?.temperature,
      topP: paramOverrides?.topP,
      maxTokens: paramOverrides?.maxTokens,
    },
    userId,
    projectId
  );
}

/**
 * Continue writing based on existing content
 */
export async function continueWriting(
  modelConfigId: number,
  userId: number,
  projectId: number,
  documentId: number,
  existingContent: string,
  length: 'short' | 'medium' | 'long' = 'medium',
  paramOverrides?: { temperature?: number; topP?: number; maxTokens?: number }
): Promise<AIGenerateResult> {
  const lengthTokens = {
    short: 500,
    medium: 1000,
    long: 2000,
  };

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的小说创作助手。请根据已有内容自然地续写，保持风格、语气和情节的连贯性。',
    },
    {
      role: 'user',
      content: `以下是已有的小说内容：\n\n${existingContent}\n\n请自然地续写这段内容。`,
    },
  ];

  return await generateWithAI(
    modelConfigId,
    {
      messages,
      temperature: paramOverrides?.temperature,
      topP: paramOverrides?.topP,
      maxTokens: paramOverrides?.maxTokens ?? lengthTokens[length],
    },
    userId,
    projectId,
    documentId
  );
}

/**
 * Optimize/polish content
 */
export async function optimizeContent(
  modelConfigId: number,
  userId: number,
  projectId: number,
  documentId: number,
  content: string,
  optimizationType: 'polish' | 'expand' | 'rewrite'
): Promise<AIGenerateResult> {
  const prompts = {
    polish: '请对以下内容进行润色，提升文字的流畅性和表现力，但保持原意不变：',
    expand: '请对以下内容进行扩写，增加更多细节描写和情感表达：',
    rewrite: '请用不同的方式重写以下内容，保持核心意思但改变表达方式：',
  };

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的文字编辑和小说创作助手，擅长优化和改进文学作品。',
    },
    {
      role: 'user',
      content: `${prompts[optimizationType]}\n\n${content}`,
    },
  ];

  return await generateWithAI(modelConfigId, { messages }, userId, projectId, documentId);
}

/**
 * Generate creative suggestions/inspiration
 */
export async function generateInspiration(
  modelConfigId: number,
  userId: number,
  projectId: number,
  topic: string,
  context?: string
): Promise<AIGenerateResult> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位富有创意的小说创作顾问，擅长提供创作灵感和建议。',
    },
  ];

  if (context) {
    messages.push({
      role: 'user',
      content: `故事背景：\n\n${context}`,
    });
  }

  messages.push({
    role: 'user',
    content: `请为以下主题提供3-5个创作灵感或建议：\n\n${topic}`,
  });

  return await generateWithAI(modelConfigId, { messages }, userId, projectId);
}

export interface AgentAction {
  type: 'modify_file' | 'chat';
  thought?: string;
  filePath?: string;
  originalContent?: string;
  newContent?: string;
  reason?: string;
  message?: string;
  logId?: number;
}

export async function generateAgentAction(
  modelConfigId: number,
  userId: number,
  projectId: number,
  userMessage: string,
  currentFile?: { path: string; content: string },
  conversationHistory: AIMessage[] = []
): Promise<AgentAction> {
  const systemPrompt = `你是一个具备文件修改能力的写作助手。
你必须只输出JSON对象，不得输出任何额外文本。
必须包含 'thought' 字段进行思考（Chain of Thought）。

你可以返回聊天消息或文件修改方案。
当用户明确或强烈暗示要写作/修改当前文档时，必须返回 modify_file。
当用户请求创作新内容（如'写第一章'）且当前没有打开文件时，也必须返回 modify_file（用于新建文件）。

modify_file 的结构如下：
{
  "type": "modify_file",
  "thought": "你的思考过程...",
  "filePath": "文件名（现有文件名或新文件名）",
  "originalContent": "当前文件中的原始内容（必须精确匹配，新建文件则为空字符串）",
  "newContent": "新的完整内容或替换片段",
  "reason": "中文说明"
}

当用户只是聊天或询问时，返回：
{
  "type": "chat",
  "thought": "你的思考过程...",
  "message": "中文回复"
}

当前上下文：
${currentFile ? `文件: ${currentFile.path}\n内容:\n${currentFile.content}` : "当前没有打开文件。"}

重要约束：
1. 若存在当前文件并要求写作，请使用完整替换，originalContent 必须等于当前文件内容。
2. 如果需要新建文件，originalContent 必须为空字符串。
3. 回复必须是合法JSON。
4. 所有文本必须使用中文。
`;

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const result = await generateWithAI(modelConfigId, { messages, temperature: 0.2 }, userId, projectId);
  
  try {
    let cleanContent = result.content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const action = JSON.parse(cleanContent);
    // Basic validation
    if (action.type === 'modify_file' || action.type === 'chat') {
        return action;
    }
    throw new Error("Invalid action type");
  } catch (e) {
    return {
      type: 'chat',
      message: result.content
    };
  }
}

/**
 * Generate character profile
 */
export async function generateCharacterProfile(
  modelConfigId: number,
  userId: number,
  projectId: number,
  characterName: string,
  characterRole: string,
  worldviewContext?: string
): Promise<AIGenerateResult> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的角色设计师，擅长创建立体丰满的小说角色。',
    },
  ];

  if (worldviewContext) {
    messages.push({
      role: 'user',
      content: `世界观设定：\n\n${worldviewContext}`,
    });
  }

  messages.push({
    role: 'user',
    content: `请为名为"${characterName}"的${characterRole}角色创建详细的人物档案，包括：外貌特征、性格特点、背景故事、能力特长、人际关系等。`,
  });

  return await generateWithAI(modelConfigId, { messages }, userId, projectId);
}

export async function generateChatResponse(
  modelConfigId: number,
  userId: number,
  projectId: number,
  userMessage: string,
  conversationHistory: AIMessage[] = []
): Promise<string> {
  const messages: AIMessage[] = [
    { 
      role: 'system', 
      content: '你是一个小说创作平台的智能助手。你可以提供建议、回答问题并帮助处理写作任务。你不能直接修改文件，但可以提供建议。请全程使用中文回答。' 
    },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const result = await generateWithAI(modelConfigId, { messages }, userId, projectId);
  return result.content;
}

/**
 * Check story consistency
 */
export async function checkConsistency(
  modelConfigId: number,
  userId: number,
  projectId: number,
  content: string,
  characters: string[],
  settings: string[]
): Promise<AIGenerateResult> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的小说编辑，擅长发现故事中的逻辑漏洞和设定冲突。',
    },
    {
      role: 'user',
      content: `角色设定：\n${characters.join('\n\n')}\n\n世界观设定：\n${settings.join('\n\n')}\n\n故事内容：\n${content}\n\n请检查以上内容是否存在逻辑矛盾、设定冲突或不一致的地方，并给出具体的问题和建议。`,
    },
  ];

  return await generateWithAI(modelConfigId, { messages }, userId, projectId);
}
