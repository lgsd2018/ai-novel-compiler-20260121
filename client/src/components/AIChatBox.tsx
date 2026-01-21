import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, User, Sparkles, FileCode, ChevronDown, ChevronUp, GitBranch, Copy } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Diff } from "@/lib/diff-utils";
import { useMemo } from "react";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  thought?: string;
  fileChange?: {
    filePath: string;
    originalContent: string;
    newContent: string;
    logId?: string;
  };
};

export type InsertPayload = {
  content: string;
  filePath?: string;
  language?: string;
};

const ThinkingBubble = ({ content }: { content: string }) => {
  return (
    <div className="mb-2 animate-in fade-in duration-300">
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground cursor-help hover:bg-muted transition-colors border border-transparent hover:border-border max-w-fit focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="查看思考过程"
            >
              <span className="font-mono tracking-widest text-base leading-none pb-1">...</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-[400px] p-4 bg-popover/95 backdrop-blur border-border text-popover-foreground shadow-xl">
             <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="size-3" />
                思考过程
             </div>
             <div className="prose prose-xs dark:prose-invert max-h-[300px] overflow-y-auto">
               <Streamdown>{content}</Streamdown>
             </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

const DiffViewer = ({ 
  original, 
  modified, 
  isOpen, 
  onClose, 
  onApply 
}: { 
  original: string; 
  modified: string; 
  isOpen: boolean; 
  onClose: () => void;
  onApply: () => void;
}) => {
  const [mode, setMode] = useState<'split' | 'inline'>('split');
  const diffs = useMemo(() => Diff.diffLines(original, modified), [original, modified]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="size-5 text-primary" />
            变更对比
          </DialogTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg p-1 bg-muted/30">
               <Button 
                 variant={mode === 'split' ? 'secondary' : 'ghost'} 
                 size="sm" 
                 className="h-6 text-xs"
                 onClick={() => setMode('split')}
                 aria-pressed={mode === 'split'}
               >
                 并排
               </Button>
               <Button 
                 variant={mode === 'inline' ? 'secondary' : 'ghost'} 
                 size="sm" 
                 className="h-6 text-xs"
                 onClick={() => setMode('inline')}
                 aria-pressed={mode === 'inline'}
               >
                 行内
               </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/10 p-4 font-mono text-xs">
           {mode === 'split' ? (
             <div className="grid grid-cols-2 gap-4 h-full">
               <div className="border rounded-md overflow-hidden bg-background">
                 <div className="px-3 py-2 bg-muted/30 border-b text-muted-foreground font-medium">原文</div>
                 <div className="p-2 whitespace-pre-wrap overflow-x-auto">
                   {diffs.filter(d => !d.added).map((part, i) => (
                     <span key={i} className={cn(part.removed && "bg-red-500/20 text-red-700 dark:text-red-300 block")}>
                       {part.value}
                     </span>
                   ))}
                 </div>
               </div>
               <div className="border rounded-md overflow-hidden bg-background">
                 <div className="px-3 py-2 bg-muted/30 border-b text-muted-foreground font-medium">修改后</div>
                 <div className="p-2 whitespace-pre-wrap overflow-x-auto">
                    {diffs.filter(d => !d.removed).map((part, i) => (
                     <span key={i} className={cn(part.added && "bg-green-500/20 text-green-700 dark:text-green-300 block")}>
                       {part.value}
                     </span>
                   ))}
                 </div>
               </div>
             </div>
           ) : (
             <div className="border rounded-md overflow-hidden bg-background h-full">
                <div className="p-2 whitespace-pre-wrap overflow-x-auto">
                   {diffs.map((part, i) => (
                     <span key={i} className={cn(
                       "block",
                       part.added && "bg-green-500/20 text-green-700 dark:text-green-300",
                       part.removed && "bg-red-500/20 text-red-700 dark:text-red-300 line-through opacity-70"
                     )}>
                       {part.value}
                     </span>
                   ))}
                </div>
             </div>
           )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/10">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={onApply}>应用修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FileChangeCard = ({ 
  fileChange, 
  onViewDiff 
}: { 
  fileChange: NonNullable<Message['fileChange']>;
  onViewDiff: () => void;
}) => {
  const diffs = useMemo(() => Diff.diffLines(fileChange.originalContent, fileChange.newContent), [fileChange]);
  const countLines = (value: string) => {
    const lines = value.split("\n").length - 1;
    return Math.max(lines, 0);
  };
  const additions = diffs.filter(d => d.added).reduce((sum, part) => sum + countLines(part.value), 0);
  const deletions = diffs.filter(d => d.removed).reduce((sum, part) => sum + countLines(part.value), 0);

  return (
     <div className="border rounded-lg p-3 bg-card flex items-center justify-between gap-3 my-2 shadow-sm">
        <div className="flex items-center gap-3">
           <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
             <FileCode className="size-4" />
           </div>
           <div>
             <div className="text-sm font-medium flex items-center gap-2">
               {fileChange.filePath}
             </div>
             <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                <span className="text-muted-foreground">[</span>
                <span className="text-green-600 font-medium">+{additions}</span>
                <span className="text-muted-foreground">]</span>
                <span className="text-muted-foreground">[</span>
                <span className="text-red-600 font-medium">-{deletions}</span>
                <span className="text-muted-foreground">]</span>
             </div>
           </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onViewDiff} aria-label="查看变更">
           <GitBranch className="size-3.5" />
           查看变更
        </Button>
     </div>
  );
};

const CollapsibleMessage = ({ 
  message, 
  onInsertContent,
  isLoading 
}: { 
  message: Message;
  onInsertContent?: (payload: InsertPayload) => void;
  isLoading: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const rawContent = message.content ?? "";
  const contentLines = useMemo(() => rawContent.split("\n"), [rawContent]);
  const lineCount = contentLines.length;
  const shouldCollapse = rawContent.length > 400 || lineCount > 8;
  const previewText = useMemo(() => {
    const previewLines = contentLines.slice(0, 6).join("\n");
    if (previewLines.length >= 240) {
      return `${previewLines.slice(0, 240)}…`;
    }
    if (lineCount > 6 || rawContent.length > 240) {
      return `${previewLines}…`;
    }
    return previewLines;
  }, [contentLines, lineCount, rawContent.length]);

  const buildInsertPayload = () => {
    const content = message.fileChange?.newContent ?? message.content;
    const filePath = message.fileChange?.filePath;
    return { content, filePath };
  };
  
  // Auto-expand if loading (streaming)
  useEffect(() => {
    if (isLoading) {
      setIsExpanded(true);
    }
  }, [isLoading]);

  const isOpen = isExpanded || isLoading || !shouldCollapse;

  return (
    <div className="relative group/message">
      {isOpen ? (
        <>
          {!isLoading && onInsertContent && (
            <div className="absolute top-0 right-0 -mt-3 opacity-0 group-hover/message:opacity-100 transition-opacity z-20 bg-background/80 backdrop-blur rounded-md border shadow-sm p-0.5 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                }}
                title="复制"
                aria-label="复制内容"
              >
                <Copy className="size-3" />
              </Button>
            </div>
          )}

          <div 
            ref={contentRef}
            className="prose prose-sm dark:prose-invert max-w-none transition-all duration-300"
          >
            <Streamdown>{message.content}</Streamdown>
          </div>

          {shouldCollapse && !isLoading && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="h-6 text-xs gap-1 hover:bg-background/80"
                aria-expanded={isOpen}
                aria-label="收起内容"
              >
                <ChevronUp className="size-3" />
                收起
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">已缩减</Badge>
              <span className="text-xs text-muted-foreground truncate">
                {lineCount} 行 · {rawContent.length} 字符
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onInsertContent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertContent(buildInsertPayload());
                  }}
                >
                  插入
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                aria-expanded={isOpen}
                aria-label="展开内容"
              >
                <ChevronDown className="size-3" />
                展开
              </Button>
            </div>
          </div>
          <div className="mt-2 text-sm whitespace-pre-wrap text-foreground/80">
            {previewText}
          </div>
        </div>
      )}
    </div>
  );
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string, mode: 'chat' | 'agent') => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  minHeightForLastMessage?: number;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /**
   * Current mode of the chat
   */
  mode?: 'chat' | 'agent';

  /**
   * Callback when mode changes
   */
  onModeChange?: (mode: 'chat' | 'agent') => void;

  /**
   * Callback when user clicks "Insert to File"
   */
  onInsertContent?: (payload: InsertPayload) => void;
  onApplyChange?: (fileChange: any) => void;
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 * ...
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  className,
  height = "600px",
  emptyStateMessage = "开始与 AI 对话",
  minHeightForLastMessage = 0,
  suggestedPrompts,
  mode: controlledMode,
  onModeChange,
  onInsertContent,
  onApplyChange,
}: AIChatBoxProps) {
  const [internalMode, setInternalMode] = useState<'chat' | 'agent'>('chat');
  const mode = controlledMode ?? internalMode;
  
  const [diffViewerState, setDiffViewerState] = useState<{
    isOpen: boolean;
    fileChange?: Message['fileChange'];
  }>({ isOpen: false });

  const handleModeChange = (newMode: string) => {
    const m = newMode as 'chat' | 'agent';
    setInternalMode(m);
    onModeChange?.(m);
  };

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const isAgent = mode === 'agent';
  const themeColor = isAgent ? "border-purple-500/50" : "border-border";
  const bgColor = isAgent ? "bg-purple-500/5" : "bg-card";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border shadow-sm transition-colors duration-300",
        themeColor,
        bgColor,
        className
      )}
      style={{ height }}
    >
      {/* Header removed (handled by parent) */}

      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                {isAgent ? (
                  <FileCode className="size-12 opacity-20 text-purple-500" />
                ) : (
                  <Sparkles className="size-12 opacity-20" />
                )}
                <p className="text-sm">
                  {isAgent 
                    ? "Agent 模式可直接修改文件。请描述您的修改需求。" 
                    : emptyStateMessage}
                </p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt, mode)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className={cn(
                        "size-8 shrink-0 mt-1 rounded-full flex items-center justify-center",
                        isAgent ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-primary/10 text-primary"
                      )}>
                        {isAgent ? <FileCode className="size-4" /> : <Sparkles className="size-4" />}
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5 relative group",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                      <div className="flex flex-col gap-1 w-full">
                        {message.thought && <ThinkingBubble content={message.thought} />}
                        
                        {message.fileChange && (
                          <FileChangeCard 
                            fileChange={message.fileChange} 
                            onViewDiff={() => setDiffViewerState({ isOpen: true, fileChange: message.fileChange })}
                          />
                        )}
                        
                        {(message.content || (!message.thought && !message.fileChange)) && (
                          <CollapsibleMessage 
                            message={message}
                            onInsertContent={onInsertContent}
                            isLoading={isLastMessage && isLoading}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </p>
                    )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className={cn(
                    "size-8 shrink-0 mt-1 rounded-full flex items-center justify-center",
                    isAgent ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-primary/10 text-primary"
                  )}>
                    {isAgent ? <FileCode className="size-4" /> : <Sparkles className="size-4" />}
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area removed - moved to AIPanel */}
      
      {diffViewerState.fileChange && (
        <DiffViewer 
           isOpen={diffViewerState.isOpen}
           original={diffViewerState.fileChange.originalContent}
           modified={diffViewerState.fileChange.newContent}
           onClose={() => setDiffViewerState({ isOpen: false, fileChange: undefined })}
           onApply={() => {
              onApplyChange?.(diffViewerState.fileChange);
              setDiffViewerState({ isOpen: false, fileChange: undefined });
           }}
        />
      )}
    </div>
  );
}
