/**
 * Language Detection Service
 * 语言检测服务
 */

/**
 * 检测文本的语言
 * 使用简单的字符集分析进行语言检测
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return "zh"; // 默认中文
  }

  const trimmedText = text.trim();
  
  // 统计各种字符类型
  const chineseChars = (trimmedText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const japaneseChars = (trimmedText.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const koreanChars = (trimmedText.match(/[\uac00-\ud7af]/g) || []).length;
  const englishChars = (trimmedText.match(/[a-zA-Z]/g) || []).length;
  
  const totalChars = trimmedText.length;
  
  // 计算各语言字符占比
  const chineseRatio = chineseChars / totalChars;
  const japaneseRatio = japaneseChars / totalChars;
  const koreanRatio = koreanChars / totalChars;
  const englishRatio = englishChars / totalChars;
  
  // 根据占比判断语言
  if (chineseRatio > 0.3) {
    return "zh";
  } else if (japaneseRatio > 0.2) {
    return "ja";
  } else if (koreanRatio > 0.2) {
    return "ko";
  } else if (englishRatio > 0.5) {
    return "en";
  }
  
  // 如果没有明显特征，检查常见词汇
  if (containsCommonWords(trimmedText, "zh")) {
    return "zh";
  } else if (containsCommonWords(trimmedText, "en")) {
    return "en";
  } else if (containsCommonWords(trimmedText, "ja")) {
    return "ja";
  } else if (containsCommonWords(trimmedText, "ko")) {
    return "ko";
  }
  
  // 默认返回中文
  return "zh";
}

/**
 * 检查文本是否包含特定语言的常见词汇
 */
function containsCommonWords(text: string, language: string): boolean {
  const commonWords: Record<string, string[]> = {
    zh: ["的", "了", "是", "在", "我", "有", "和", "人", "这", "中"],
    en: ["the", "be", "to", "of", "and", "a", "in", "that", "have", "I"],
    ja: ["の", "に", "は", "を", "た", "が", "で", "て", "と", "し"],
    ko: ["이", "그", "저", "것", "수", "등", "들", "및", "년", "월"],
  };
  
  const words = commonWords[language] || [];
  const lowerText = text.toLowerCase();
  
  return words.some(word => lowerText.includes(word));
}

/**
 * 获取语言的完整名称
 */
export function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    zh: "中文",
    en: "英文",
    ja: "日文",
    ko: "韩文",
  };
  return languages[code] || code;
}

/**
 * 获取语言的置信度
 * 返回0-1之间的数值，表示检测的置信度
 */
export function getLanguageConfidence(text: string, detectedLanguage: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const trimmedText = text.trim();
  const totalChars = trimmedText.length;
  
  // 统计目标语言的字符数
  let targetChars = 0;
  
  switch (detectedLanguage) {
    case "zh":
      targetChars = (trimmedText.match(/[\u4e00-\u9fa5]/g) || []).length;
      break;
    case "ja":
      targetChars = (trimmedText.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
      break;
    case "ko":
      targetChars = (trimmedText.match(/[\uac00-\ud7af]/g) || []).length;
      break;
    case "en":
      targetChars = (trimmedText.match(/[a-zA-Z]/g) || []).length;
      break;
  }
  
  // 计算置信度
  const confidence = Math.min(targetChars / totalChars, 1.0);
  
  // 如果置信度较低，检查常见词汇
  if (confidence < 0.5 && containsCommonWords(trimmedText, detectedLanguage)) {
    return Math.max(confidence, 0.6);
  }
  
  return confidence;
}
