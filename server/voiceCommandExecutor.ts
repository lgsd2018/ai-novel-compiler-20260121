/**
 * 语音命令执行器
 * 处理和执行语音识别后的命令
 */

import { parseVoiceCommand, VoiceCommand } from './voiceCommands';

export interface CommandExecutionContext {
  userId: string;
  projectId: number;
  documentId?: number;
  editorState?: {
    selectedText?: string;
    cursorPosition?: number;
    content?: string;
  };
}

export interface CommandExecutionResult {
  success: boolean;
  command?: VoiceCommand;
  message: string;
  action?: string;
  parameters?: Record<string, any>;
}

/**
 * 执行语音命令
 */
export function executeVoiceCommand(
  text: string,
  context: CommandExecutionContext
): CommandExecutionResult {
  // 解析语音命令
  const parseResult = parseVoiceCommand(text);

  if (!parseResult.matched || !parseResult.command) {
    return {
      success: false,
      message: `无法识别命令: "${text}"`,
    };
  }

  const command = parseResult.command;

  // 检查置信度
  if (parseResult.confidence < 0.6) {
    return {
      success: false,
      message: `命令匹配度不足: "${text}" (${(parseResult.confidence * 100).toFixed(0)}%)`,
      command,
    };
  }

  // 执行命令
  return executeCommand(command, context);
}

/**
 * 执行具体的命令
 */
function executeCommand(
  command: VoiceCommand,
  context: CommandExecutionContext
): CommandExecutionResult {
  switch (command.action) {
    // 编辑器操作
    case 'save':
      return {
        success: true,
        command,
        message: '已保存文档',
        action: 'save',
      };

    case 'undo':
      return {
        success: true,
        command,
        message: '已撤销上一步操作',
        action: 'undo',
      };

    case 'redo':
      return {
        success: true,
        command,
        message: '已重做操作',
        action: 'redo',
      };

    case 'selectAll':
      return {
        success: true,
        command,
        message: '已选中全部文本',
        action: 'selectAll',
      };

    case 'copy':
      return {
        success: true,
        command,
        message: '已复制选中文本',
        action: 'copy',
      };

    case 'cut':
      return {
        success: true,
        command,
        message: '已剪切选中文本',
        action: 'cut',
      };

    case 'paste':
      return {
        success: true,
        command,
        message: '已粘贴内容',
        action: 'paste',
      };

    case 'delete':
      return {
        success: true,
        command,
        message: '已删除选中文本',
        action: 'delete',
      };

    case 'find':
      return {
        success: true,
        command,
        message: '已打开查找对话框',
        action: 'openFind',
      };

    case 'replace':
      return {
        success: true,
        command,
        message: '已打开替换对话框',
        action: 'openReplace',
      };

    // 文档操作
    case 'newDocument':
      return {
        success: true,
        command,
        message: '已创建新文档',
        action: 'newDocument',
        parameters: {
          projectId: context.projectId,
        },
      };

    case 'newChapter':
      return {
        success: true,
        command,
        message: '已创建新章节',
        action: 'newChapter',
        parameters: {
          projectId: context.projectId,
        },
      };

    case 'deleteDocument':
      return {
        success: true,
        command,
        message: '已删除文档',
        action: 'deleteDocument',
        parameters: {
          documentId: context.documentId,
        },
      };

    case 'insertTitle':
      return {
        success: true,
        command,
        message: '已插入标题',
        action: 'insertTitle',
      };

    case 'insertDivider':
      return {
        success: true,
        command,
        message: '已插入分隔符',
        action: 'insertDivider',
      };

    // 项目操作
    case 'openProject':
      return {
        success: true,
        command,
        message: '已打开项目列表',
        action: 'openProject',
      };

    case 'exportProject':
      return {
        success: true,
        command,
        message: '已开始导出项目',
        action: 'exportProject',
        parameters: {
          projectId: context.projectId,
        },
      };

    case 'publishProject':
      return {
        success: true,
        command,
        message: '已开始发布项目',
        action: 'publishProject',
        parameters: {
          projectId: context.projectId,
        },
      };

    // AI操作
    case 'generateContent':
      return {
        success: true,
        command,
        message: '已开始生成内容',
        action: 'generateContent',
        parameters: {
          projectId: context.projectId,
          documentId: context.documentId,
        },
      };

    case 'continueWriting':
      return {
        success: true,
        command,
        message: '已开始继续写作',
        action: 'continueWriting',
        parameters: {
          projectId: context.projectId,
          documentId: context.documentId,
        },
      };

    case 'optimizeContent':
      return {
        success: true,
        command,
        message: '已开始优化内容',
        action: 'optimizeContent',
        parameters: {
          projectId: context.projectId,
          documentId: context.documentId,
        },
      };

    default:
      return {
        success: false,
        command,
        message: `未知命令: ${command.action}`,
      };
  }
}

/**
 * 获取命令帮助信息
 */
export function getCommandHelp(): string {
  const { getAvailableCommands, getCommandsByCategory } = require('./voiceCommands');
  
  const commands = getAvailableCommands();
  const categories = ['editor', 'document', 'project', 'ai'];
  
  let help = '# 语音命令帮助\n\n';
  
  for (const category of categories) {
    const categoryCommands = getCommandsByCategory(category);
    if (categoryCommands.length > 0) {
      help += `## ${getCategoryName(category)}\n\n`;
      
      for (const cmd of categoryCommands) {
        help += `- **${cmd.name}**: ${cmd.description}\n`;
        help += `  说法: ${cmd.patterns.join('、')}\n\n`;
      }
    }
  }
  
  return help;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    editor: '编辑器操作',
    document: '文档操作',
    project: '项目操作',
    ai: 'AI操作',
  };
  return names[category] || category;
}
