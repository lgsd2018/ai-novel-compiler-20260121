import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Diff } from "@/lib/diff-utils";
import { useMemo } from "react";

interface AgentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  originalContent: string;
  newContent: string;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

export function AgentConfirmationDialog({
  open,
  onOpenChange,
  filePath,
  originalContent,
  newContent,
  reason,
  onConfirm,
  onCancel,
  isApplying,
}: AgentConfirmationDialogProps) {
  
  // Simple diff computation
  const diff = useMemo(() => {
    return Diff.diffLines(originalContent || "", newContent || "");
  }, [originalContent, newContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            确认文件修改
            <Badge variant="outline" className="font-mono text-xs">{filePath}</Badge>
          </DialogTitle>
          <DialogDescription>
            AI 请求修改此文件。请仔细检查更改内容。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 min-h-0">
          <div className="bg-muted p-3 rounded-md text-sm border-l-4 border-primary">
            <span className="font-semibold block mb-1">修改原因:</span> 
            {reason}
          </div>

          <div className="flex-1 border rounded-md bg-background overflow-hidden flex flex-col">
            <div className="p-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground flex justify-between">
              <span>差异对比</span>
              <span className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500"></span> 删除</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500"></span> 新增</span>
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 font-mono text-xs whitespace-pre-wrap">
                {diff.map((part, index) => {
                  const color = part.added ? 'bg-green-500/20 text-green-900 dark:text-green-100' :
                                part.removed ? 'bg-red-500/20 text-red-900 dark:text-red-100' : 
                                'text-muted-foreground';
                  const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                  
                  return (
                    <span key={index} className={`block ${color} px-1 rounded-sm my-0.5`}>
                      {part.value}
                    </span>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            拒绝修改
          </Button>
          <Button onClick={onConfirm} disabled={isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 应用修改中...
              </>
            ) : (
              "确认并修改"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
