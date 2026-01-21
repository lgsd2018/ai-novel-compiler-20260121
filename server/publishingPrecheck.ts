/**
 * Publishing Pre-check Module
 * 发布前预检查模块：章节完整性、字数限制、敏感词过滤、格式规范
 */

import * as db from './db';
import { getActivePlatformRules } from './db/platformRulesDb';
import { getSensitiveWords } from './sensitiveWordsDb';

// 敏感词库（示例，实际应从数据库或配置文件加载）
const SENSITIVE_WORDS = [
  '暴力', '色情', '赌博', '毒品', '反动', '邪教',
  // 实际应用中应该有更完整的敏感词库
];

// 平台规则配置（作为默认回退值）
const DEFAULT_PLATFORM_RULES = {
  qidian: {
    minChapterWords: 1000,
    maxChapterWords: 10000,
    minTitleLength: 1,
    maxTitleLength: 50,
    requiresCover: true,
    requiresDescription: true,
    minDescriptionLength: 20,
    maxDescriptionLength: 500,
  },
  jinjiang: {
    minChapterWords: 500,
    maxChapterWords: 15000,
    minTitleLength: 1,
    maxTitleLength: 30,
    requiresCover: false,
    requiresDescription: true,
    minDescriptionLength: 10,
    maxDescriptionLength: 1000,
  },
  zongheng: {
    minChapterWords: 800,
    maxChapterWords: 12000,
    minTitleLength: 1,
    maxTitleLength: 40,
    requiresCover: true,
    requiresDescription: true,
    minDescriptionLength: 15,
    maxDescriptionLength: 600,
  },
  '17k': {
    minChapterWords: 1000,
    maxChapterWords: 8000,
    minTitleLength: 1,
    maxTitleLength: 50,
    requiresCover: true,
    requiresDescription: true,
    minDescriptionLength: 20,
    maxDescriptionLength: 500,
  },
};

/**
 * 获取合并后的平台规则
 * 优先使用数据库中激活的规则，如果没有则使用默认规则
 */
async function getMergedPlatformRules(platform: string) {
  // 获取默认规则
  const defaultRules = DEFAULT_PLATFORM_RULES[platform as keyof typeof DEFAULT_PLATFORM_RULES] || {};
  
  // 获取数据库中的动态规则
  const activeRules = await getActivePlatformRules(platform);
  
  // 创建规则副本
  const rules = { ...defaultRules };
  
  // 应用动态规则覆盖默认值
  for (const rule of activeRules) {
    const value = rule.ruleValue as any;
    
    if (rule.ruleType === 'word_count' && value) {
      if (value.min !== undefined) rules.minChapterWords = value.min;
      if (value.max !== undefined) rules.maxChapterWords = value.max;
    }
    
    if (rule.ruleType === 'chapter_title' && value) {
      if (value.minLength !== undefined) rules.minTitleLength = value.minLength;
      if (value.maxLength !== undefined) rules.maxTitleLength = value.maxLength;
    }

    if (rule.ruleType === 'sensitive_words' && value) {
      (rules as any).sensitiveCheck = {
        enabled: value.enabled !== undefined ? value.enabled : true,
        blockPublishOnHighSeverity: value.blockPublishOnHighSeverity,
        severityThreshold: value.severityThreshold,
        useDatabaseWordlist: value.useDatabaseWordlist,
      };
    }
    
    // 可以根据需要扩展其他规则类型的映射
  }
  
  return rules;
}

export interface PrecheckIssue {
  level: 'error' | 'warning' | 'info';
  category: 'completeness' | 'wordcount' | 'sensitive' | 'format';
  message: string;
  details?: string;
  chapterId?: number;
  chapterTitle?: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export interface PrecheckResult {
  passed: boolean;
  issues: PrecheckIssue[];
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

/**
 * 检查章节完整性
 */
async function checkCompleteness(chapterIds: number[]): Promise<PrecheckIssue[]> {
  const issues: PrecheckIssue[] = [];

  if (chapterIds.length === 0) {
    issues.push({
      level: 'error',
      category: 'completeness',
      message: '没有选择任何章节',
      suggestion: '请至少选择一个章节进行发布',
    });
    return issues;
  }

  // 获取章节信息
  const chapters = await db.getDocumentsByIds(chapterIds);
  
  // 检查章节是否存在
  const missingIds = chapterIds.filter(id => !chapters.find(c => c.id === id));
  if (missingIds.length > 0) {
    issues.push({
      level: 'error',
      category: 'completeness',
      message: `有 ${missingIds.length} 个章节不存在或已被删除`,
      details: `章节ID: ${missingIds.join(', ')}`,
      suggestion: '请移除不存在的章节',
    });
  }

  // 检查章节内容是否为空
  for (const chapter of chapters) {
    if (!chapter.content || chapter.content.trim().length === 0) {
      issues.push({
        level: 'error',
        category: 'completeness',
        message: '章节内容为空',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        suggestion: '请添加章节内容后再发布',
      });
    }
  }

  // 检查章节顺序
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  const orderIssues = chapters.filter((c, i: number) => c.id !== sortedChapters[i].id);
  if (orderIssues.length > 0) {
    issues.push({
      level: 'warning',
      category: 'completeness',
      message: '章节顺序可能不正确',
      details: `建议按照章节序号顺序发布`,
      suggestion: '检查章节顺序是否符合预期',
    });
  }

  return issues;
}

/**
 * 检查字数限制
 */
async function checkWordCount(
  chapterIds: number[],
  rules: any,
  platformName: string
): Promise<PrecheckIssue[]> {
  const issues: PrecheckIssue[] = [];

  // 检查是否有关联的规则（默认规则不为空或有动态规则）
  const hasRules = Object.keys(rules).length > 0;

  if (!hasRules) {
    issues.push({
      level: 'warning',
      category: 'wordcount',
      message: `未知平台 ${platformName}，无法检查字数限制`,
    });
    return issues;
  }

  const chapters = await db.getDocumentsByIds(chapterIds);

  for (const chapter of chapters) {
    const wordCount = chapter.wordCount || 0;

    if (wordCount < rules.minChapterWords) {
      issues.push({
        level: 'error',
        category: 'wordcount',
        message: `章节字数不足`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `当前 ${wordCount} 字，${platformName} 平台要求至少 ${rules.minChapterWords} 字`,
        suggestion: '请扩充章节内容',
      });
    }

    if (wordCount > rules.maxChapterWords) {
      issues.push({
        level: 'warning',
        category: 'wordcount',
        message: `章节字数超出建议范围`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `当前 ${wordCount} 字，${platformName} 平台建议不超过 ${rules.maxChapterWords} 字`,
        suggestion: '考虑将章节拆分为多个部分',
      });
    }
  }

  return issues;
}

/**
 * 检查敏感词
 */
async function checkSensitiveWords(
  chapterIds: number[],
  rules: any
): Promise<PrecheckIssue[]> {
  const issues: PrecheckIssue[] = [];
  
  // 检查是否启用了敏感词检测
  const sensitiveCheck = rules.sensitiveCheck;
  
  // 如果明确禁用了敏感词检测，则跳过
  if (sensitiveCheck && sensitiveCheck.enabled === false) {
    return issues;
  }

  type Severity = "low" | "medium" | "high";
  const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
  const threshold: Severity = (sensitiveCheck?.severityThreshold as Severity) ?? "medium";
  const blockHigh: boolean = sensitiveCheck?.blockPublishOnHighSeverity ?? true;

  const fromDbEnabled = sensitiveCheck?.useDatabaseWordlist !== false;
  const dbWords = fromDbEnabled ? await getSensitiveWords() : [];
  const effectiveWords =
    dbWords.length > 0
      ? dbWords.map(w => ({
          word: w.word,
          category: w.category,
          isRegex: w.isRegex,
          severity: (w.severity as Severity) ?? "medium",
        }))
      : SENSITIVE_WORDS.map(w => ({ word: w, category: "默认", isRegex: false, severity: "medium" as Severity }));

  const chapters = await db.getDocumentsByIds(chapterIds);

  for (const chapter of chapters) {
    const content = chapter.content || '';
    const title = chapter.title || '';
    
    const foundInTitle: Array<{ word: string; category: string; severity: Severity }> = [];
    const foundInContent: Array<{ word: string; category: string; severity: Severity }> = [];

    for (const entry of effectiveWords) {
      if (!entry.word) continue;

      let titleHit = false;
      let contentHit = false;

      if (entry.isRegex) {
        try {
          const re = new RegExp(entry.word, "i");
          titleHit = re.test(title);
          contentHit = re.test(content);
        } catch {
          titleHit = false;
          contentHit = false;
        }
      } else {
        titleHit = title.includes(entry.word);
        contentHit = content.includes(entry.word);
      }

      if (titleHit) foundInTitle.push({ word: entry.word, category: entry.category, severity: entry.severity });
      if (contentHit) foundInContent.push({ word: entry.word, category: entry.category, severity: entry.severity });
    }

    const toIssueLevel = (found: Array<{ severity: Severity }>) => {
      if (found.some(f => blockHigh && f.severity === "high")) return "error" as const;
      const maxRank = Math.max(...found.map(f => severityRank[f.severity] ?? 2));
      return maxRank >= severityRank[threshold] ? ("error" as const) : ("warning" as const);
    };

    if (foundInTitle.length > 0) {
      issues.push({
        level: toIssueLevel(foundInTitle),
        category: 'sensitive',
        message: `章节标题包含敏感词`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `检测到 ${foundInTitle.length} 个敏感词: ${foundInTitle.map(w => `${w.word}(${w.category}/${w.severity})`).join(', ')}`,
        suggestion: '请修改标题，移除或替换敏感词',
        autoFixable: false,
      });
    }

    if (foundInContent.length > 0) {
      issues.push({
        level: toIssueLevel(foundInContent),
        category: 'sensitive',
        message: `章节内容包含敏感词`,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `检测到 ${foundInContent.length} 个敏感词: ${foundInContent.map(w => `${w.word}(${w.category}/${w.severity})`).join(', ')}`,
        suggestion: '请修改内容，移除或替换敏感词',
        autoFixable: false,
      });
    }
  }

  return issues;
}

/**
 * 检查格式规范
 */
async function checkFormat(
  chapterIds: number[],
  publishConfig: any,
  rules: any,
  platformName: string
): Promise<PrecheckIssue[]> {
  const issues: PrecheckIssue[] = [];

  // 检查是否有关联的规则
  const hasRules = Object.keys(rules).length > 0;

  if (!hasRules) {
    return issues;
  }

  const chapters = await db.getDocumentsByIds(chapterIds);

  // 检查作品标题
  if (!publishConfig.title || publishConfig.title.trim().length === 0) {
    issues.push({
      level: 'error',
      category: 'format',
      message: '作品标题不能为空',
      suggestion: '请填写作品标题',
    });
  } else {
    const titleLength = publishConfig.title.length;
    if (titleLength < rules.minTitleLength || titleLength > rules.maxTitleLength) {
      issues.push({
        level: 'error',
        category: 'format',
        message: `作品标题长度不符合要求`,
        details: `当前 ${titleLength} 字，${platformName} 平台要求 ${rules.minTitleLength}-${rules.maxTitleLength} 字`,
        suggestion: '请调整标题长度',
      });
    }
  }

  // 检查作品简介
  if (rules.requiresDescription) {
    if (!publishConfig.description || publishConfig.description.trim().length === 0) {
      issues.push({
        level: 'error',
        category: 'format',
        message: '作品简介不能为空',
        suggestion: '请填写作品简介',
      });
    } else {
      const descLength = publishConfig.description.length;
      if (descLength < rules.minDescriptionLength || descLength > rules.maxDescriptionLength) {
        issues.push({
          level: 'warning',
          category: 'format',
          message: `作品简介长度不符合建议`,
          details: `当前 ${descLength} 字，${platformName} 平台建议 ${rules.minDescriptionLength}-${rules.maxDescriptionLength} 字`,
          suggestion: '请调整简介长度',
        });
      }
    }
  }

  // 检查封面
  if (rules.requiresCover && !publishConfig.coverUrl) {
    issues.push({
      level: 'warning',
      category: 'format',
      message: '未设置作品封面',
      suggestion: `${platformName} 平台建议上传封面图片`,
    });
  }

  // 检查分类和标签
  if (!publishConfig.category || publishConfig.category.trim().length === 0) {
    issues.push({
      level: 'error',
      category: 'format',
      message: '未选择作品分类',
      suggestion: '请选择合适的作品分类',
    });
  }

  if (!publishConfig.tags || publishConfig.tags.length === 0) {
    issues.push({
      level: 'warning',
      category: 'format',
      message: '未设置作品标签',
      suggestion: '添加标签有助于读者发现您的作品',
    });
  }

  // 检查章节标题格式
  for (const chapter of chapters) {
    const title = chapter.title || '';
    
    // 标题不能为空
    if (title.trim().length === 0) {
      issues.push({
        level: 'error',
        category: 'format',
        message: '章节标题不能为空',
        chapterId: chapter.id,
        suggestion: '请为章节添加标题',
      });
    }

    // 标题不能过长
    if (title.length > 100) {
      issues.push({
        level: 'warning',
        category: 'format',
        message: '章节标题过长',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `当前 ${title.length} 字，建议不超过 100 字`,
        suggestion: '请缩短章节标题',
      });
    }

    // 检查内容格式
    const content = chapter.content || '';
    
    // 检查是否有过多的空行
    const emptyLines = (content.match(/\n\s*\n/g) || []).length;
    if (emptyLines > content.split('\n').length * 0.3) {
      issues.push({
        level: 'info',
        category: 'format',
        message: '章节包含过多空行',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        suggestion: '建议清理多余的空行',
        autoFixable: true,
      });
    }

    // 检查是否有特殊字符
    const specialChars = content.match(/[^\u4e00-\u9fa5a-zA-Z0-9\s\.,!?;:'"()\-—…、。，！？；：""''（）《》【】]/g);
    if (specialChars && specialChars.length > 10) {
      issues.push({
        level: 'info',
        category: 'format',
        message: '章节包含较多特殊字符',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        details: `检测到 ${specialChars.length} 个特殊字符`,
        suggestion: '检查是否有不必要的特殊字符',
      });
    }
  }

  return issues;
}

/**
 * 执行完整的发布前检查
 */
export async function runPrecheck(
  chapterIds: number[],
  publishConfig: any,
  platform: string
): Promise<PrecheckResult> {
  const allIssues: PrecheckIssue[] = [];
  
  // 获取合并后的平台规则（一次性获取）
  const rules = await getMergedPlatformRules(platform);

  // 1. 章节完整性检查
  const completenessIssues = await checkCompleteness(chapterIds);
  allIssues.push(...completenessIssues);

  // 2. 字数限制检查
  const wordCountIssues = await checkWordCount(chapterIds, rules, platform);
  allIssues.push(...wordCountIssues);

  // 3. 敏感词检查
  const sensitiveIssues = await checkSensitiveWords(chapterIds, rules);
  allIssues.push(...sensitiveIssues);

  // 4. 格式规范检查
  const formatIssues = await checkFormat(chapterIds, publishConfig, rules, platform);
  allIssues.push(...formatIssues);

  // 统计问题数量
  const errors = allIssues.filter(i => i.level === 'error').length;
  const warnings = allIssues.filter(i => i.level === 'warning').length;
  const infos = allIssues.filter(i => i.level === 'info').length;

  return {
    passed: errors === 0,
    issues: allIssues,
    summary: {
      totalIssues: allIssues.length,
      errors,
      warnings,
      infos,
    },
  };
}

/**
 * 自动修复可修复的问题
 */
export async function autoFixIssues(
  chapterIds: number[],
  issues: PrecheckIssue[]
): Promise<{ fixed: number; failed: number }> {
  let fixed = 0;
  let failed = 0;

  const fixableIssues = issues.filter(i => i.autoFixable && i.chapterId);

  for (const issue of fixableIssues) {
    try {
      if (issue.category === 'format' && issue.message.includes('空行')) {
        // 修复过多空行
        const chapter = await db.getDocumentById(issue.chapterId!);
        if (chapter && chapter.content) {
          const fixedContent = chapter.content.replace(/\n\s*\n\s*\n/g, '\n\n');
          await db.updateDocument(issue.chapterId!, { content: fixedContent });
          fixed++;
        }
      }
    } catch (error) {
      console.error('Auto-fix failed:', error);
      failed++;
    }
  }

  return { fixed, failed };
}
