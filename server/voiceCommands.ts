/**
 * 语音命令控制系统
 * 支持通过语音控制编辑器操作
 */

export interface VoiceCommand {
  id: string;
  name: string;
  description: string;
  patterns: string[]; // 支持的语音模式
  action: string; // 执行的操作
  category: 'editor' | 'document' | 'project' | 'ai'; // 命令分类
  parameters?: Record<string, any>;
}

export interface CommandParseResult {
  matched: boolean;
  command?: VoiceCommand;
  confidence: number; // 匹配置信度 0-1
  parameters?: Record<string, any>;
}

/**
 * 定义所有支持的语音命令
 */
export const VOICE_COMMANDS: VoiceCommand[] = [
  // 编辑器操作命令
  {
    id: 'save',
    name: '保存',
    description: '保存当前文档',
    patterns: ['保存', '保存文档', '保存文件', '存档'],
    action: 'save',
    category: 'editor',
  },
  {
    id: 'undo',
    name: '撤销',
    description: '撤销上一步操作',
    patterns: ['撤销', '撤销上一步', '取消', '回退'],
    action: 'undo',
    category: 'editor',
  },
  {
    id: 'redo',
    name: '重做',
    description: '重做上一步撤销的操作',
    patterns: ['重做', '重新做', '恢复'],
    action: 'redo',
    category: 'editor',
  },
  {
    id: 'selectAll',
    name: '全选',
    description: '选中全部文本',
    patterns: ['全选', '选择全部', '选中全部'],
    action: 'selectAll',
    category: 'editor',
  },
  {
    id: 'copy',
    name: '复制',
    description: '复制选中文本',
    patterns: ['复制', '复制文本', '复制选中'],
    action: 'copy',
    category: 'editor',
  },
  {
    id: 'cut',
    name: '剪切',
    description: '剪切选中文本',
    patterns: ['剪切', '剪切文本', '剪切选中'],
    action: 'cut',
    category: 'editor',
  },
  {
    id: 'paste',
    name: '粘贴',
    description: '粘贴剪贴板内容',
    patterns: ['粘贴', '粘贴内容', '贴上'],
    action: 'paste',
    category: 'editor',
  },
  {
    id: 'delete',
    name: '删除',
    description: '删除选中文本',
    patterns: ['删除', '删除选中', '清除'],
    action: 'delete',
    category: 'editor',
  },
  {
    id: 'find',
    name: '查找',
    description: '打开查找对话框',
    patterns: ['查找', '搜索', '查找文本'],
    action: 'find',
    category: 'editor',
  },
  {
    id: 'replace',
    name: '替换',
    description: '打开替换对话框',
    patterns: ['替换', '替换文本', '查找替换'],
    action: 'replace',
    category: 'editor',
  },

  // 文档操作命令
  {
    id: 'newDocument',
    name: '新建文档',
    description: '创建新的文档',
    patterns: ['新建', '新建文档', '新建文件', '创建文档'],
    action: 'newDocument',
    category: 'document',
  },
  {
    id: 'newChapter',
    name: '新建章节',
    description: '创建新的章节',
    patterns: ['新建章节', '添加章节', '创建章节'],
    action: 'newChapter',
    category: 'document',
  },
  {
    id: 'deleteDocument',
    name: '删除文档',
    description: '删除当前文档',
    patterns: ['删除文档', '删除文件', '删除当前文档'],
    action: 'deleteDocument',
    category: 'document',
  },
  {
    id: 'insertTitle',
    name: '插入标题',
    description: '在光标位置插入标题',
    patterns: ['插入标题', '添加标题', '标题'],
    action: 'insertTitle',
    category: 'document',
  },
  {
    id: 'insertDivider',
    name: '插入分隔符',
    description: '在光标位置插入分隔符',
    patterns: ['插入分隔符', '添加分隔符', '分隔符'],
    action: 'insertDivider',
    category: 'document',
  },

  // 项目操作命令
  {
    id: 'openProject',
    name: '打开项目',
    description: '打开项目列表',
    patterns: ['打开项目', '打开', '项目列表'],
    action: 'openProject',
    category: 'project',
  },
  {
    id: 'exportProject',
    name: '导出项目',
    description: '导出当前项目',
    patterns: ['导出', '导出项目', '导出文件'],
    action: 'exportProject',
    category: 'project',
  },
  {
    id: 'publishProject',
    name: '发布项目',
    description: '发布当前项目到平台',
    patterns: ['发布', '发布项目', '发布到平台'],
    action: 'publishProject',
    category: 'project',
  },

  // AI操作命令
  {
    id: 'generateContent',
    name: '生成内容',
    description: '使用AI生成内容',
    patterns: ['生成', '生成内容', '使用AI生成'],
    action: 'generateContent',
    category: 'ai',
  },
  {
    id: 'continueWriting',
    name: '继续写作',
    description: '使用AI继续写作',
    patterns: ['继续', '继续写作', '继续写'],
    action: 'continueWriting',
    category: 'ai',
  },
  {
    id: 'optimizeContent',
    name: '优化内容',
    description: '使用AI优化内容',
    patterns: ['优化', '优化内容', '润色'],
    action: 'optimizeContent',
    category: 'ai',
  },
];

/**
 * 计算两个字符串的相似度（Levenshtein距离）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * 解析语音命令
 */
export function parseVoiceCommand(text: string): CommandParseResult {
  const normalizedText = text.toLowerCase().trim();
  
  let bestMatch: VoiceCommand | undefined;
  let bestConfidence = 0;

  // 遍历所有命令，找到最匹配的
  for (const command of VOICE_COMMANDS) {
    for (const pattern of command.patterns) {
      const similarity = calculateSimilarity(normalizedText, pattern.toLowerCase());
      
      // 如果完全匹配或相似度超过阈值
      if (normalizedText === pattern.toLowerCase() || similarity > 0.7) {
        if (similarity > bestConfidence) {
          bestMatch = command;
          bestConfidence = similarity;
        }
      }
    }
  }

  return {
    matched: bestMatch !== undefined,
    command: bestMatch,
    confidence: bestConfidence,
  };
}

/**
 * 获取所有可用的命令列表
 */
export function getAvailableCommands(): VoiceCommand[] {
  return VOICE_COMMANDS;
}

/**
 * 按分类获取命令
 */
export function getCommandsByCategory(category: VoiceCommand['category']): VoiceCommand[] {
  return VOICE_COMMANDS.filter(cmd => cmd.category === category);
}
