import React from "react";
import {
  BarChart2,
  CheckSquare,
  Book,
  ShieldAlert,
  Mic,
  FileSearch,
  Activity,
  Files,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ActivityType = 
  | "files" 
  | "stats" 
  | "tasks" 
  | "rules" 
  | "sensitive" 
  | "voice" 
  | "extract" 
  | "analysis";

interface ActivityBarProps {
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
}

const activities: { id: ActivityType; icon: React.ElementType; label: string }[] = [
  { id: "files", icon: Files, label: "资源管理器" },
  { id: "stats", icon: BarChart2, label: "统计面板" },
  { id: "tasks", icon: CheckSquare, label: "任务监控" },
  { id: "rules", icon: Book, label: "平台规则" },
  { id: "sensitive", icon: ShieldAlert, label: "敏感词库" },
  { id: "voice", icon: Mic, label: "语音历史" },
  { id: "extract", icon: FileSearch, label: "提取规则" },
  { id: "analysis", icon: Activity, label: "规则分析" },
];

export function ActivityBar({ activeActivity, onActivityChange }: ActivityBarProps) {
  return (
    <div className="w-14 bg-muted/30 border-r border-border flex flex-col items-center py-2 gap-2 shrink-0">
      <TooltipProvider delayDuration={0}>
        {activities.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onActivityChange(item.id)}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-md transition-colors relative",
                  activeActivity === item.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-6 h-6" strokeWidth={1.5} />
                {activeActivity === item.id && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
      
      <div className="flex-1" />
      
      {/* Bottom actions */}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            设置
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
