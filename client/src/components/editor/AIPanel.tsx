import React, { useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AIChatBox, Message, InsertPayload } from "@/components/AIChatBox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface AIPanelProps {
  aiModels: any[];
  selectedModelId?: number;
  onModelChange: (id: string) => void;
  aiParams: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  onParamsChange: (key: string, value: number) => void;
  messages: Message[];
  onSendMessage: (content: string, mode: 'chat' | 'agent') => void;
  isGenerating: boolean;
  mode?: 'chat' | 'agent';
  onModeChange?: (mode: 'chat' | 'agent') => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onInsertContent?: (payload: InsertPayload) => void;
  onApplyChange?: (fileChange: any) => void;
}

export function AIPanel({
  aiModels,
  selectedModelId,
  onModelChange,
  aiParams,
  onParamsChange,
  messages,
  onSendMessage,
  isGenerating,
  mode: controlledMode,
  onModeChange,
  inputValue,
  onInputChange,
  onInsertContent,
  onApplyChange
}: AIPanelProps) {
  const [internalMode, setInternalMode] = useState<'chat' | 'agent'>('chat');
  const chatMode = controlledMode ?? internalMode;
  const [localInput, setLocalInput] = useState("");
  const input = inputValue ?? localInput;
  const setInput = onInputChange ?? setLocalInput;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleModeChange = (mode: 'chat' | 'agent') => {
    setInternalMode(mode);
    onModeChange?.(mode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isGenerating) return;

    onSendMessage(trimmedInput, chatMode);
    setInput("");

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isAgent = chatMode === 'agent';

  return (
    <div className="h-full flex flex-col bg-sidebar border-l border-border">
      {/* Header with Mode Switch */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-sidebar/50 backdrop-blur z-10">
        {/* Left: Mode Switch (Chat / Agent) */}
        <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
           <button 
             onClick={() => handleModeChange('chat')}
             className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${chatMode === 'chat' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
           >
             Chat
           </button>
           <button 
             onClick={() => handleModeChange('agent')}
             className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${chatMode === 'agent' ? "bg-background shadow-sm text-purple-600" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
           >
             Agent
           </button>
        </div>

        {/* Right: Model & Settings */}
        <div className="flex items-center gap-1">
          <Select
            value={selectedModelId?.toString()}
            onValueChange={onModelChange}
          >
            <SelectTrigger className="h-7 text-xs border-none bg-transparent hover:bg-muted/50 w-[110px] px-2 focus:ring-0 gap-1">
               <span className="truncate text-muted-foreground">
                 {aiModels?.find(m => m.id.toString() === selectedModelId?.toString())?.name || "选择模型"}
               </span>
            </SelectTrigger>
            <SelectContent align="end">
              {aiModels?.map((model) => (
                <SelectItem key={model.id} value={model.id.toString()} className="text-xs">
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-medium leading-none">生成设置</h4>
                <div className="space-y-2">
                  <Label>温度 (Temperature)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={aiParams.temperature}
                      onChange={(e) => onParamsChange("temperature", parseFloat(e.target.value))}
                      className="h-8"
                    />
                    <span className="text-xs text-muted-foreground w-12 text-right">0-2</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>最大长度 (Max Tokens)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={100}
                      max={32000}
                      step={100}
                      value={aiParams.maxTokens}
                      onChange={(e) => onParamsChange("maxTokens", parseFloat(e.target.value))}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Top P</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={aiParams.topP}
                      onChange={(e) => onParamsChange("topP", parseFloat(e.target.value))}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative">
        <AIChatBox
          messages={messages}
          onSendMessage={onSendMessage}
          isLoading={isGenerating}
          height="100%"
          className="h-full border-none shadow-none rounded-none"
          mode={chatMode}
            onModeChange={handleModeChange}
          onInsertContent={onInsertContent}
          onApplyChange={onApplyChange}
          suggestedPrompts={[
            "帮我优化这段描写",
            "分析当前章节的节奏",
            "生成一个反派角色设定",
            "检查逻辑漏洞"
          ]}
        />
      </div>

      {/* Input Area - Now part of AIPanel */}
      <div className="p-4 bg-background/50 border-t">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "relative border rounded-xl focus-within:ring-1 focus-within:ring-primary/30 transition-all shadow-sm",
            isAgent ? "bg-purple-500/5 border-purple-200 dark:border-purple-900/50" : "bg-muted/30 border-input"
          )}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAgent ? "描述您想进行的修改..." : "输入您的消息..."}
            className={cn(
              "border-none shadow-none focus-visible:ring-0 min-h-[80px] max-h-60 resize-none bg-transparent px-3 py-3",
              isAgent && "placeholder:text-purple-400/50"
            )}
            rows={1}
          />
          <div className="flex justify-between items-center px-2 pb-2 mt-1">
             <div className="flex gap-2 items-center">
                {/* Mode Switch */}
                <div className="flex bg-muted/50 rounded-md p-0.5 gap-0.5">
                   <button 
                     type="button"
                     onClick={() => handleModeChange('chat')}
                     className={cn(
                       "px-2 py-0.5 text-[10px] rounded transition-all font-medium",
                       chatMode === 'chat' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                     )}
                   >
                     Chat
                   </button>
                   <button 
                     type="button"
                     onClick={() => handleModeChange('agent')}
                     className={cn(
                       "px-2 py-0.5 text-[10px] rounded transition-all font-medium",
                       chatMode === 'agent' ? "bg-background shadow-sm text-purple-600" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                     )}
                   >
                     Agent
                   </button>
                </div>

                {/* Model Selector */}
                <Select
                  value={selectedModelId?.toString()}
                  onValueChange={onModelChange}
                >
                  <SelectTrigger className="h-6 text-[10px] border-none bg-transparent hover:bg-muted/50 w-[90px] px-1 focus:ring-0 gap-1 p-0">
                     <span className="truncate text-muted-foreground">
                       {aiModels?.find(m => m.id.toString() === selectedModelId?.toString())?.name || "模型"}
                     </span>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {aiModels?.map((model) => (
                      <SelectItem key={model.id} value={model.id.toString()} className="text-xs">
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Settings */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Settings2 className="w-3 h-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start" side="top">
                    <div className="space-y-4">
                      <h4 className="font-medium leading-none">生成设置</h4>
                      <div className="space-y-2">
                        <Label>温度 (Temperature)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={aiParams.temperature}
                            onChange={(e) => onParamsChange("temperature", parseFloat(e.target.value))}
                            className="h-8"
                          />
                          <span className="text-xs text-muted-foreground w-12 text-right">0-2</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>最大长度 (Max Tokens)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={100}
                            max={32000}
                            step={100}
                            value={aiParams.maxTokens}
                            onChange={(e) => onParamsChange("maxTokens", parseFloat(e.target.value))}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Top P</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.1}
                            value={aiParams.topP}
                            onChange={(e) => onParamsChange("topP", parseFloat(e.target.value))}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
             </div>
             <Button
               type="submit"
               size="icon"
               disabled={!input.trim() || isGenerating}
               className={cn(
                 "h-7 w-7 rounded-lg transition-all",
                 input.trim() ? (isAgent ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary/90") : "bg-muted text-muted-foreground hover:bg-muted"
               )}
             >
               {isGenerating ? (
                 <Loader2 className="size-3.5 animate-spin" />
               ) : (
                 <Send className="size-3.5" />
               )}
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
