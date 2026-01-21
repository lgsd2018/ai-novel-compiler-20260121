import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, Info, CheckCircle, Wrench } from "lucide-react";

interface PrecheckIssue {
  level: 'error' | 'warning' | 'info';
  category: 'completeness' | 'wordcount' | 'sensitive' | 'format';
  message: string;
  details?: string;
  chapterId?: number;
  chapterTitle?: string;
  suggestion?: string;
  autoFixable?: boolean;
}

interface PrecheckResult {
  passed: boolean;
  issues: PrecheckIssue[];
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

interface PrecheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: PrecheckResult | null;
  onAutoFix?: () => void;
  onPublish?: () => void;
  isAutoFixing?: boolean;
}

export function PrecheckDialog({
  open,
  onOpenChange,
  result,
  onAutoFix,
  onPublish,
  isAutoFixing = false,
}: PrecheckDialogProps) {
  if (!result) return null;

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">警告</Badge>;
      case 'info':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">提示</Badge>;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'completeness':
        return '完整性';
      case 'wordcount':
        return '字数';
      case 'sensitive':
        return '敏感词';
      case 'format':
        return '格式';
      default:
        return category;
    }
  };

  const hasAutoFixableIssues = result.issues.some(issue => issue.autoFixable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.passed ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                预检查通过
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-destructive" />
                预检查发现问题
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.passed
              ? '所有检查项均通过，可以安全发布'
              : `发现 ${result.summary.errors} 个错误，${result.summary.warnings} 个警告，${result.summary.infos} 个提示`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {result.issues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p>所有检查项均通过！</p>
              </div>
            ) : (
              result.issues.map((issue, index) => (
                <div
                  key={index}
                  className="border border-border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getLevelIcon(issue.level)}
                      <span className="font-medium">{issue.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getLevelBadge(issue.level)}
                      <Badge variant="secondary">{getCategoryLabel(issue.category)}</Badge>
                      {issue.autoFixable && (
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          <Wrench className="w-3 h-3 mr-1" />
                          可修复
                        </Badge>
                      )}
                    </div>
                  </div>

                  {issue.chapterTitle && (
                    <div className="text-sm text-muted-foreground">
                      章节: {issue.chapterTitle}
                    </div>
                  )}

                  {issue.details && (
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      {issue.details}
                    </div>
                  )}

                  {issue.suggestion && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{issue.suggestion}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!result.passed && hasAutoFixableIssues && onAutoFix && (
            <Button
              variant="outline"
              onClick={onAutoFix}
              disabled={isAutoFixing}
            >
              {isAutoFixing ? '修复中...' : '自动修复'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {result.passed && onPublish && (
            <Button onClick={onPublish}>
              继续发布
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
