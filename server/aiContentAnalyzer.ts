/**
 * AI Content Analyzer
 * AI内容分析器 - 从生成的内容中提取故事线、角色、设定等信息
 */

import { generateWithAI } from './ai';
import { generateContentHash, getCachedAnalysis, cacheAnalysisResult } from './aiAnalysisCache';

/**
 * 提取的故事线事件
 */
export interface ExtractedEvent {
  title: string;
  description: string;
  timestamp?: string;
  characters?: string[];
  location?: string;
  importance: 'high' | 'medium' | 'low';
}

/**
 * 提取的角色信息
 */
export interface ExtractedCharacter {
  name: string;
  description?: string;
  appearance?: string;
  personality?: string;
  background?: string;
  relationships?: Array<{
    targetName: string;
    relationship: string;
  }>;
}

/**
 * 提取的世界观设定
 */
export interface ExtractedSetting {
  type: 'location' | 'rule' | 'item' | 'concept';
  name: string;
  description: string;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  events: ExtractedEvent[];
  characters: ExtractedCharacter[];
  settings: ExtractedSetting[];
}

/**
 * 从AI生成的内容中提取信息
 */
export async function analyzeGeneratedContent(
  content: string,
  context?: {
    projectTitle?: string;
    chapterTitle?: string;
    existingCharacters?: string[];
    existingLocations?: string[];
    modelConfigId?: number;
    userId?: number;
    projectId?: number;
    useCustomRules?: boolean;
  }
): Promise<AnalysisResult> {
  try {
    // 生成缓存键
    const cacheKey = context?.useCustomRules 
      ? `${content}:custom:${context.userId}:${context.projectId}`
      : content;
    const contentHash = generateContentHash(cacheKey);
    
    // 尝试从缓存获取
    const cached = await getCachedAnalysis(contentHash);
    if (cached) {
      console.log('[AI Content Analyzer] Using cached analysis result');
      return cached;
    }
    
    console.log('[AI Content Analyzer] Cache miss, analyzing content...');
    // 检查是否使用自定义规则
    let customRules: any[] = [];
    if (context?.useCustomRules && context?.userId) {
      const { getActiveExtractionRules } = await import('./db/extractionRulesDb');
      customRules = await getActiveExtractionRules(context.userId, context.projectId);
      console.log(`[AI Content Analyzer] Found ${customRules.length} active custom rules`);
    }

    // 构建分析提示词
    const analysisPrompt = buildAnalysisPromptWithRules(content, context, customRules);

    // 如果没有提供modelConfigId，使用默认模型
    let modelConfigId = context?.modelConfigId;
    if (!modelConfigId) {
      // 获取默认模型
      const { getDefaultAiModelConfig } = await import('./db');
      const defaultModel = await getDefaultAiModelConfig();
      if (!defaultModel) {
        console.warn('[AI Content Analyzer] No AI model configured, returning empty result');
        return {
          events: [],
          characters: [],
          settings: [],
        };
      }
      modelConfigId = defaultModel.id;
    }

    // 调用AI进行分析
    console.log('[AI Content Analyzer] Analyzing content with AI...');
    const result = await generateWithAI(
      modelConfigId,
      {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的小说内容分析助手，擅长从文本中提取故事线事件、角色信息和世界观设定。请以JSON格式返回分析结果。',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.3, // 使用较低的temperature以获得更稳定的结果
        maxTokens: 4000,
      },
      context?.userId || 0
    );

    // 解析AI返回的JSON
    const analysisResult = parseAnalysisResult(result.content);
    console.log(`[AI Content Analyzer] Analysis complete: ${analysisResult.events.length} events, ${analysisResult.characters.length} characters, ${analysisResult.settings.length} settings`);
    
    // 保存到缓存
    await cacheAnalysisResult(contentHash, analysisResult);
    
    return analysisResult;
  } catch (error) {
    console.error('[AI Content Analyzer] Error analyzing content:', error);
    // 返回空结果而不是抛出错误
    return {
      events: [],
      characters: [],
      settings: [],
    };
  }
}

/**
 * 构建分析提示词（支持自定义规则）
 */
function buildAnalysisPromptWithRules(
  content: string,
  context?: {
    projectTitle?: string;
    chapterTitle?: string;
    existingCharacters?: string[];
    existingLocations?: string[];
  },
  customRules?: any[]
): string {
  if (customRules && customRules.length > 0) {
    // 使用自定义规则构建提示词
    let prompt = `请根据以下自定义规则分析文本并提取信息：\n\n`;

    customRules.forEach((rule, index) => {
      prompt += `### 规则 ${index + 1}: ${rule.name}\n`;
      if (rule.description) {
        prompt += `描述: ${rule.description}\n`;
      }
      if (rule.prompt) {
        prompt += `要求: ${rule.prompt}\n`;
      }
      prompt += `字段定义:\n`;
      const fields = JSON.parse(JSON.stringify(rule.fields));
      fields.forEach((field: any) => {
        prompt += `  - ${field.name} (${field.type}): ${field.description}`;
        if (field.example) {
          prompt += ` 示例: ${JSON.stringify(field.example)}`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    });

    prompt += `\n文本内容：\n${content}\n\n`;
    prompt += `请以JSON格式返回结果，每个规则的结果作为一个数组。格式示例：\n`;
    prompt += `{\n`;
    customRules.forEach((rule) => {
      prompt += `  "${rule.ruleType}": [...],\n`;
    });
    prompt += `}`;

    return prompt;
  } else {
    // 使用默认提示词
    return buildAnalysisPrompt(content, context);
  }
}

/**
 * 构建默认分析提示词
 */
function buildAnalysisPrompt(
  content: string,
  context?: {
    projectTitle?: string;
    chapterTitle?: string;
    existingCharacters?: string[];
    existingLocations?: string[];
  }
): string {
  let prompt = `你是一个专业的小说分析助手，擅长从文学作品中提取结构化信息。

分析原则：
1. 只提取文本中明确出现的信息，不要自行推测或编造
2. 对于模糊或不确定的信息，可以留空或标记为"unknown"
3. 保持原文的语境和意思，不要过度解读
4. 对于复杂的信息，尽量提供详细的描述
5. 注意上下文关系，避免信息碎片化
\n请分析以下小说内容：\n\n`;

  if (context?.projectTitle) {
    prompt += `作品标题：${context.projectTitle}\n`;
  }
  if (context?.chapterTitle) {
    prompt += `章节标题：${context.chapterTitle}\n`;
  }
  if (context?.existingCharacters && context.existingCharacters.length > 0) {
    prompt += `已知角色：${context.existingCharacters.join('、')}\n`;
  }
  if (context?.existingLocations && context.existingLocations.length > 0) {
    prompt += `已知地点：${context.existingLocations.join('、')}\n`;
  }

  prompt += `\n---\n待分析文本：\n${content}\n---\n\n`;

  prompt += `请按照以下要求提取信息，并以JSON格式返回：

1. **故事线事件** (events)：提取重要的情节事件
   - title: 事件标题（简短概括）
   - description: 事件描述（详细说明）
   - timestamp: 时间点（如果文中提到）
   - characters: 参与的角色名称列表
   - location: 发生地点
   - importance: 重要程度 (high/medium/low)

2. **角色信息** (characters)：提取新出现或有重要描写的角色
   - name: 角色名称
   - description: 简短描述
   - appearance: 外貌特征
   - personality: 性格特点
   - background: 背景信息
   - relationships: 与其他角色的关系 [{targetName, relationship}]

3. **世界观设定** (settings)：提取重要的设定信息
   - type: 类型 (location/rule/item/concept)
   - name: 名称
   - description: 描述

返回格式示例：
\`\`\`json
{
  "events": [
    {
      "title": "主角初次遇见导师",
      "description": "在古老的图书馆中，主角偶然遇见了隐居多年的剑术大师",
      "timestamp": "春季，清晨",
      "characters": ["李明", "剑术大师"],
      "location": "古老图书馆",
      "importance": "high"
    }
  ],
  "characters": [
    {
      "name": "剑术大师",
      "description": "隐居多年的武林高手",
      "appearance": "白发苍苍，身材挺拔",
      "personality": "沉默寡言，但眼神锐利",
      "background": "曾是武林盟主，因故隐退",
      "relationships": [
        {"targetName": "李明", "relationship": "师徒"}
      ]
    }
  ],
  "settings": [
    {
      "type": "location",
      "name": "古老图书馆",
      "description": "藏有武林秘籍的神秘图书馆，位于深山之中"
    }
  ]
}
\`\`\`

注意：
- 只提取明确出现在文本中的信息，不要推测
- 对于已知角色，只在有新信息时才包含
- 事件要有实质性内容，避免提取过于琐碎的细节
- 确保返回有效的JSON格式`;

  return prompt;
}

/**
 * 解析AI返回的分析结果
 */
function parseAnalysisResult(aiResponse: string): AnalysisResult {
  try {
    // 尝试直接解析JSON
    const parsed = JSON.parse(aiResponse);
    
    // 验证和规范化数据
    return {
      events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : [],
      characters: Array.isArray(parsed.characters) ? parsed.characters.map(normalizeCharacter) : [],
      settings: Array.isArray(parsed.settings) ? parsed.settings.map(normalizeSetting) : [],
    };
  } catch (error) {
    console.error('[AI Content Analyzer] Error parsing AI response:', error);
    
    // 尝试从markdown代码块中提取JSON
    const jsonMatch = aiResponse.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : [],
          characters: Array.isArray(parsed.characters) ? parsed.characters.map(normalizeCharacter) : [],
          settings: Array.isArray(parsed.settings) ? parsed.settings.map(normalizeSetting) : [],
        };
      } catch (e) {
        console.error('[AI Content Analyzer] Error parsing JSON from markdown:', e);
      }
    }
    
    // 返回空结果
    return {
      events: [],
      characters: [],
      settings: [],
    };
  }
}

/**
 * 规范化事件数据
 */
function normalizeEvent(event: any): ExtractedEvent {
  return {
    title: String(event.title || '未命名事件'),
    description: String(event.description || ''),
    timestamp: event.timestamp ? String(event.timestamp) : undefined,
    characters: Array.isArray(event.characters) ? event.characters.map(String) : undefined,
    location: event.location ? String(event.location) : undefined,
    importance: ['high', 'medium', 'low'].includes(event.importance) ? event.importance : 'medium',
  };
}

/**
 * 规范化角色数据
 */
function normalizeCharacter(character: any): ExtractedCharacter {
  return {
    name: String(character.name || '未命名角色'),
    description: character.description ? String(character.description) : undefined,
    appearance: character.appearance ? String(character.appearance) : undefined,
    personality: character.personality ? String(character.personality) : undefined,
    background: character.background ? String(character.background) : undefined,
    relationships: Array.isArray(character.relationships)
      ? character.relationships.map((rel: any) => ({
          targetName: String(rel.targetName || ''),
          relationship: String(rel.relationship || ''),
        }))
      : undefined,
  };
}

/**
 * 规范化设定数据
 */
function normalizeSetting(setting: any): ExtractedSetting {
  return {
    type: ['location', 'rule', 'item', 'concept'].includes(setting.type) ? setting.type : 'concept',
    name: String(setting.name || '未命名设定'),
    description: String(setting.description || ''),
  };
}

/**
 * 批量分析多个章节内容
 */
export async function analyzeBatchContent(
  contents: Array<{ chapterTitle: string; content: string }>,
  context?: {
    projectTitle?: string;
    existingCharacters?: string[];
    existingLocations?: string[];
  }
): Promise<AnalysisResult> {
  const allResults: AnalysisResult = {
    events: [],
    characters: [],
    settings: [],
  };

  for (const { chapterTitle, content } of contents) {
    const result = await analyzeGeneratedContent(content, {
      ...context,
      chapterTitle,
    });

    allResults.events.push(...result.events);
    allResults.characters.push(...result.characters);
    allResults.settings.push(...result.settings);
  }

  // 去重和合并
  return deduplicateResults(allResults);
}

/**
 * 去重和合并分析结果
 */
function deduplicateResults(results: AnalysisResult): AnalysisResult {
  // 去重角色（按名称）
  const uniqueCharacters = new Map<string, ExtractedCharacter>();
  for (const char of results.characters) {
    if (!uniqueCharacters.has(char.name)) {
      uniqueCharacters.set(char.name, char);
    } else {
      // 合并信息
      const existing = uniqueCharacters.get(char.name)!;
      uniqueCharacters.set(char.name, {
        ...existing,
        description: char.description || existing.description,
        appearance: char.appearance || existing.appearance,
        personality: char.personality || existing.personality,
        background: char.background || existing.background,
        relationships: [
          ...(existing.relationships || []),
          ...(char.relationships || []),
        ],
      });
    }
  }

  // 去重设定（按名称和类型）
  const uniqueSettings = new Map<string, ExtractedSetting>();
  for (const setting of results.settings) {
    const key = `${setting.type}:${setting.name}`;
    if (!uniqueSettings.has(key)) {
      uniqueSettings.set(key, setting);
    }
  }

  return {
    events: results.events, // 事件不去重，保留所有
    characters: Array.from(uniqueCharacters.values()),
    settings: Array.from(uniqueSettings.values()),
  };
}
