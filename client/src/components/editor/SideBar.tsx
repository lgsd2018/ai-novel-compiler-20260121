import React, { useMemo, useState } from "react";
import { ActivityType } from "./ActivityBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PlatformRulesContent } from "@/pages/PlatformRules";
import { SensitiveWordsContent } from "@/pages/SensitiveWords";
import { SpeechHistoryContent } from "@/pages/SpeechHistory";
import { TaskMonitorContent } from "@/pages/TaskMonitor";
import { ExtractionRulesContent } from "@/pages/ExtractionRules";
import { RuleAnalyticsContent } from "@/pages/RuleAnalytics";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  MoreVertical,
  Plus,
  Trash2,
  Copy,
  Sparkles,
} from "lucide-react";

export type DocumentItem = {
  id: number;
  title: string;
  type: "chapter" | "character" | "setting" | "outline" | "worldview" | "folder";
  parentId: number | null;
  order: number;
  content?: string;
};

interface SideBarProps {
  activeActivity: ActivityType;
  documents: DocumentItem[];
  selectedDocId: number | null;
  expandedFolderIds: Set<number>;
  onSelectDoc: (id: number) => void;
  onToggleFolder: (id: number) => void;
  onDeleteDoc: (id: number) => void;
  onOpenCreateDialog: (type?: DocumentItem["type"], parentId?: number | null) => void;
  onCopyPath?: (path: string, doc: DocumentItem) => void;
  onSendToAI?: (path: string, doc: DocumentItem, instruction: string) => void;
  onMoveDoc: (params: { draggedId: number; targetId: number; dropPosition: "before" | "after" | "inside" }) => void;
}

export function SideBar({
  activeActivity,
  documents,
  selectedDocId,
  expandedFolderIds,
  onSelectDoc,
  onToggleFolder,
  onDeleteDoc,
  onOpenCreateDialog,
  onCopyPath,
  onSendToAI,
  onMoveDoc,
}: SideBarProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | "inside">("after");
  const statsQuery = trpc.statistics.get.useQuery(undefined, { enabled: activeActivity === "stats" });
  const stats = statsQuery.data;
  const renderActivityContent = () => {
    switch (activeActivity) {
      case "tasks":
        return <TaskMonitorContent />;
      case "rules":
        return <PlatformRulesContent />;
      case "sensitive":
        return <SensitiveWordsContent />;
      case "voice":
        return <SpeechHistoryContent />;
      case "extract":
        return <ExtractionRulesContent />;
      case "analysis":
        return <RuleAnalyticsContent />;
      default:
        return (
          <div className="p-4 text-sm text-muted-foreground text-center mt-10">
            功能开发中...
          </div>
        );
    }
  };
  const documentsByParent = useMemo(() => {
    const map = new Map<number | null, DocumentItem[]>();
    if (!documents) return map;
    const sorted = [...documents].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.title.localeCompare(b.title, "zh");
    });
    for (const doc of sorted) {
      const key = doc.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    return map;
  }, [documents]);
  const documentsById = useMemo(() => {
    const map = new Map<number, DocumentItem>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const getDocPath = (doc: DocumentItem) => {
    const parts = [doc.title];
    let current = doc;
    while (current.parentId != null) {
      const parent = documentsById.get(current.parentId);
      if (!parent) break;
      parts.unshift(parent.title);
      current = parent;
    }
    const path = parts.join("/");
    return doc.type === "folder" ? `${path}/` : path;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  const renderDocumentItem = (doc: DocumentItem, depth: number) => {
    const isFolder = doc.type === "folder";
    const isExpanded = isFolder && expandedFolderIds.has(doc.id);
    const children = documentsByParent.get(doc.id) ?? [];
    const paddingLeft = depth > 0 ? Math.min(depth * 12 + 12, 48) : 0;
    const docPath = getDocPath(doc);
    const aiInstruction = isFolder
      ? `请查看文件夹：${docPath}`
      : `请查看或修改文件：${docPath}`;

    const isDragOver = dragOverId === doc.id;
    const dragIndicatorClass = isDragOver
      ? dragOverPosition === "inside"
        ? "ring-2 ring-sidebar-primary/60"
        : dragOverPosition === "before"
          ? "before:absolute before:left-2 before:right-2 before:top-0 before:h-0.5 before:bg-sidebar-primary/70"
          : "after:absolute after:left-2 after:right-2 after:bottom-0 after:h-0.5 after:bg-sidebar-primary/70"
      : "";

    return (
      <div key={doc.id} className="space-y-0.5">
        <div
          className={cn(
            "group relative flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer select-none",
            selectedDocId === doc.id
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            draggingId === doc.id ? "opacity-40" : "",
            dragIndicatorClass
          )}
          style={paddingLeft ? { paddingLeft } : undefined}
          draggable
          onClick={() => {
            if (isFolder) {
              onToggleFolder(doc.id);
              return;
            }
            onSelectDoc(doc.id);
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", String(doc.id));
            event.dataTransfer.effectAllowed = "move";
            setDraggingId(doc.id);
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDragOverId(null);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingId === doc.id) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const offsetY = event.clientY - rect.top;
            const ratio = rect.height === 0 ? 0 : offsetY / rect.height;
            let position: "before" | "after" | "inside" = "after";
            if (isFolder && ratio > 0.25 && ratio < 0.75) {
              position = "inside";
            } else if (ratio < 0.5) {
              position = "before";
            } else {
              position = "after";
            }
            setDragOverId(doc.id);
            setDragOverPosition(position);
          }}
          onDragLeave={() => {
            setDragOverId((prev) => (prev === doc.id ? null : prev));
          }}
          onDrop={(event) => {
            event.preventDefault();
            const draggedRaw = event.dataTransfer.getData("text/plain");
            const draggedId = Number(draggedRaw);
            if (!draggedId || draggedId === doc.id) {
              setDragOverId(null);
              return;
            }
            onMoveDoc({ draggedId, targetId: doc.id, dropPosition: dragOverPosition });
            setDragOverId(null);
          }}
        >
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFolder(doc.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          {isFolder ? (
            <Folder className={cn("w-4 h-4 shrink-0", selectedDocId === doc.id ? "text-sidebar-primary" : "text-muted-foreground")} />
          ) : (
            <File className={cn("w-4 h-4 shrink-0", selectedDocId === doc.id ? "text-sidebar-primary" : "text-muted-foreground")} />
          )}
          <span className="flex-1 truncate">{doc.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/20">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  const parentId = doc.type === "folder" ? doc.id : doc.parentId ?? null;
                  onOpenCreateDialog("chapter", parentId);
                }}
              >
                新建文档
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  const parentId = doc.type === "folder" ? doc.id : doc.parentId ?? null;
                  onOpenCreateDialog("folder", parentId);
                }}
              >
                新建文件夹
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  navigator.clipboard.writeText(docPath);
                  onCopyPath?.(docPath, doc);
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                复制路径
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onSendToAI?.(docPath, doc, aiInstruction);
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                发送给 AI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteDoc(doc.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isFolder && isExpanded && children.length > 0 ? (
          <div className="space-y-0.5">
            {children.map((child) => renderDocumentItem(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (activeActivity !== "files") {
    return (
      <div className="flex flex-col h-full bg-sidebar">
        <div className="h-10 px-4 flex items-center border-b border-sidebar-border/50 shrink-0">
          <span className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
            {activeActivity === "stats" ? "统计面板" :
             activeActivity === "tasks" ? "任务监控" :
             activeActivity === "rules" ? "平台规则" :
             activeActivity === "sensitive" ? "敏感词库" :
             activeActivity === "voice" ? "语音历史" :
             activeActivity === "extract" ? "提取规则" :
             activeActivity === "analysis" ? "规则分析" : "功能"}
          </span>
        </div>
        {activeActivity === "stats" ? (
          <div className="p-4 space-y-4 overflow-auto">
            {statsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground text-center">统计数据加载中...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm bg-muted/30 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">总字数</span>
                    <span className="font-medium">{stats?.totalWords?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-muted/30 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">写作时长</span>
                    <span className="font-medium">{formatDuration(stats?.totalMinutes || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-muted/30 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">AI使用</span>
                    <span className="font-medium">{stats?.totalAiCalls || 0} 次</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-muted/30 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">项目数</span>
                    <span className="font-medium">{stats?.totalProjects || 0}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">最近30天写作趋势</div>
                  <div className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">日均字数</span>
                    <span className="font-medium">{stats?.avgWordsPerDay || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">日均写作时长</span>
                    <span className="font-medium">{formatDuration(stats?.avgMinutesPerDay || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-md">
                    <span className="text-muted-foreground">活跃天数</span>
                    <span className="font-medium">{stats?.activeDays || 0} 天</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4">
              {renderActivityContent()}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-border">
      <div className="h-10 px-4 flex items-center justify-between border-b border-sidebar-border/50 shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">文档</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-sidebar-foreground/70 hover:text-sidebar-primary hover:bg-sidebar-accent">
              <Plus className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenCreateDialog("chapter", null)}>
              新建文档
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenCreateDialog("folder", null)}>
              新建文件夹
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {(documentsByParent.get(null) ?? []).map((doc) => renderDocumentItem(doc, 0))}
        </div>
      </ScrollArea>
    </div>
  );
}
