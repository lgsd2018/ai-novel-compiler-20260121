/**
 * 编辑器命令执行器
 * 将语音命令映射到编辑器操作
 */

export interface EditorCommand {
  name: string;
  action: string;
  parameters?: Record<string, any>;
}

export interface CommandExecutionResult {
  success: boolean;
  message: string;
  action?: string;
}

// 命令到编辑器操作的映射
const COMMAND_ACTION_MAP: Record<string, string> = {
  'save': 'editor:save',
  'undo': 'editor:undo',
  'redo': 'editor:redo',
  'selectAll': 'editor:selectAll',
  'copy': 'editor:copy',
  'cut': 'editor:cut',
  'paste': 'editor:paste',
  'delete': 'editor:delete',
  'find': 'editor:find',
  'replace': 'editor:replace',
  'newDocument': 'document:new',
  'newChapter': 'document:newChapter',
  'deleteDocument': 'document:delete',
  'insertTitle': 'document:insertTitle',
  'insertDivider': 'document:insertDivider',
  'openProject': 'project:open',
  'exportProject': 'project:export',
  'publishProject': 'project:publish',
  'generateContent': 'ai:generate',
  'continueWriting': 'ai:continue',
  'optimizeContent': 'ai:optimize',
};

/**
 * 执行编辑器命令
 */
export function executeEditorCommand(
  commandAction: string,
  parameters?: Record<string, any>
): CommandExecutionResult {
  try {
    // 创建自定义事件
    const event = new CustomEvent('voiceCommand', {
      detail: {
        action: commandAction,
        parameters: parameters || {},
      },
    });

    // 分发事件到document
    document.dispatchEvent(event);

    return {
      success: true,
      message: `已执行命令: ${commandAction}`,
      action: commandAction,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `命令执行失败: ${error.message}`,
    };
  }
}

/**
 * 将命令名称映射到编辑器操作
 */
export function mapCommandNameToEditorCommand(commandName: string): string | null {
  return COMMAND_ACTION_MAP[commandName] || null;
}

/**
 * 执行带参数的命令
 */
export function executeCommandWithParameters(
  commandName: string,
  parameters?: Record<string, any>
): CommandExecutionResult {
  const editorAction = mapCommandNameToEditorCommand(commandName);
  
  if (!editorAction) {
    return {
      success: false,
      message: `未知命令: ${commandName}`,
    };
  }

  return executeEditorCommand(editorAction, parameters);
}

/**
 * 注册命令监听器
 */
export function registerCommandListener(callback: (detail: any) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  document.addEventListener('voiceCommand', handler);

  // 返回取消注册函数
  return () => {
    document.removeEventListener('voiceCommand', handler);
  };
}

/**
 * 获取所有支持的编辑器命令
 */
export function getSupportedCommands(): string[] {
  return Object.keys(COMMAND_ACTION_MAP);
}

/**
 * 检查命令是否支持
 */
export function isCommandSupported(commandName: string): boolean {
  return commandName in COMMAND_ACTION_MAP;
}
