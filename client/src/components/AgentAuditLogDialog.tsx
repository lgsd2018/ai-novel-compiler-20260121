import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { trpc } from '@/lib/trpc';
import { Loader2, History, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function AgentAuditLogDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: logs, isLoading, refetch } = trpc.agentLogs.list.useQuery(
    { 
      status: statusFilter === 'all' ? undefined : statusFilter as any,
      limit: 100 
    },
    { enabled: isOpen }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">已通过</Badge>;
      case 'auto_approved':
        return <Badge className="bg-green-600">自动通过</Badge>;
      case 'rejected':
        return <Badge variant="destructive">已拒绝</Badge>;
      case 'reverted':
        return <Badge variant="secondary">已回滚</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">待确认</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOperationLabel = (op: string) => {
    // 简单的映射，如果 operation 是英文
    const map: Record<string, string> = {
      'modify_file': '修改文件',
      'create_file': '创建文件',
      'delete_file': '删除文件',
    };
    return map[op] || op;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <div className="p-6 pb-2">
            <DialogHeader>
            <DialogTitle>Agent 操作历史</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待确认</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="auto_approved">自动通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="reverted">已回滚</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
                刷新
            </Button>
            </div>
        </div>

        <ScrollArea className="flex-1 p-6 pt-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              暂无操作记录
            </div>
          ) : (
            <div className="space-y-4">
              {logs?.map((log) => (
                <LogItem key={log.id} log={log} getStatusBadge={getStatusBadge} getOperationLabel={getOperationLabel} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function LogItem({ log, getStatusBadge, getOperationLabel }: { log: any, getStatusBadge: any, getOperationLabel: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="border rounded-md p-4 bg-card/50">
      <div className="flex items-start justify-between gap-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
            {isExpanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
            <span className="font-medium text-left">{getOperationLabel(log.operation)}</span>
          </Button>
        </CollapsibleTrigger>
        
        <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground truncate">
            <FileText className="h-3 w-3" />
            <span className="truncate" title={log.filePath}>{log.filePath}</span>
        </div>

        <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
                {format(new Date(log.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
            </div>
            {getStatusBadge(log.status)}
        </div>
      </div>
      
      <CollapsibleContent className="mt-4 pt-4 border-t space-y-2 text-sm">
        {log.reason && (
            <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-muted-foreground">修改原因:</span>
                <span>{log.reason}</span>
            </div>
        )}
        <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="text-muted-foreground">消耗:</span>
            <span>{log.tokenUsage || 0} tokens {log.cost ? `(¥${log.cost})` : ''}</span>
        </div>
        
        {/* 这里可以展示更详细的 diff，但考虑到性能和 UI 复杂度，暂时只展示简单的内容摘要或提供 diff 查看入口 */}
        {/* 如果有 before/after，可以显示 */}
        {log.contentBefore && log.contentAfter && (
             <div className="mt-2 p-2 bg-muted rounded text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                <div className="text-red-500">- 原始内容预览</div>
                <div className="mb-2">{log.contentBefore.slice(0, 200)}...</div>
                <div className="text-green-500">+ 修改后预览</div>
                <div>{log.contentAfter.slice(0, 200)}...</div>
             </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
