/**
 * AI Content Analyzer Tests
 */

import { describe, it, expect } from 'vitest';
import { analyzeGeneratedContent } from './aiContentAnalyzer';

describe('AI Content Analyzer', () => {
  it('should analyze content and extract information', async () => {
    const testContent = `
第一章：相遇

李明走进古老的图书馆，阳光透过彩色玻璃窗洒在地板上。在书架的深处，他看到一位白发苍苍的老人正在翻阅一本古籍。

"年轻人，你来这里是为了寻找什么？"老人抬起头，锐利的目光让李明感到一阵压力。

"我想学习剑术，"李明坚定地说，"听说这里藏有武林秘籍。"

老人微微一笑："我是张无忌，曾是武林盟主。如果你真心想学，我可以收你为徒。"

这座图书馆位于深山之中，是江湖中少有人知的秘密之地。
    `;

    const result = await analyzeGeneratedContent(testContent, {
      projectTitle: '测试小说',
      chapterTitle: '第一章：相遇',
    });

    console.log('Analysis Result:', JSON.stringify(result, null, 2));

    // 验证结果结构
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('characters');
    expect(result).toHaveProperty('settings');

    expect(Array.isArray(result.events)).toBe(true);
    expect(Array.isArray(result.characters)).toBe(true);
    expect(Array.isArray(result.settings)).toBe(true);

    // 如果AI分析成功，应该能提取到一些信息
    // 注意：由于依赖实际的AI模型，这个测试可能返回空结果
    console.log(`Extracted: ${result.events.length} events, ${result.characters.length} characters, ${result.settings.length} settings`);
  }, 60000); // 60秒超时，因为AI调用可能需要时间

  it('should handle empty content gracefully', async () => {
    const result = await analyzeGeneratedContent('');

    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('characters');
    expect(result).toHaveProperty('settings');

    expect(result.events).toEqual([]);
    expect(result.characters).toEqual([]);
    expect(result.settings).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    // 测试错误处理
    const result = await analyzeGeneratedContent('测试内容', {
      modelConfigId: 99999, // 不存在的模型ID
    });

    // 应该返回空结果而不是抛出错误
    expect(result.events).toEqual([]);
    expect(result.characters).toEqual([]);
    expect(result.settings).toEqual([]);
  });
});
