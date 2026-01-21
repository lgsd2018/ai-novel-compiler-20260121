import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pause, Play, X, RefreshCw, Activity } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PAGE_DIALOG_CLASSNAME } from "@/const";
import { useLocation } from "wouter";

export function TaskMonitorContent() {
  const [, setLocation] = useLocation();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 获取任务列表
  const { data: tasks, refetch: refetchTasks } = trpc.queue.list.useQuery(undefined, {
    refetchInterval: autoRefresh ? 3000 : false,
  });

  // 获取队列统计
  const { data: stats } = trpc.queue.stats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // 获取选中任务的详细状态
  const { data: taskDetail } = trpc.queue.getStatus.useQuery(
    { jobId: selectedJobId! },
    { enabled: !!selectedJobId, refetchInterval: autoRefresh ? 2000 : false }
  );

  // 任务操作mutations
  const pauseMutation = trpc.queue.pause.useMutation({
    onSuccess: () => {
      toast.success("任务已暂停");
      refetchTasks();
    },
    onError: (error) => {
      toast.error(`暂停失败: ${error.message}`);
    },
  });

  const resumeMutation = trpc.queue.resume.useMutation({
    onSuccess: () => {
      toast.success("任务已恢复");
      refetchTasks();
    },
    onError: (error) => {
      toast.error(`恢复失败: ${error.message}`);
    },
  });

  const cancelMutation = trpc.queue.cancel.useMutation({
    onSuccess: () => {
      toast.success("任务已取消");
      setSelectedJobId(null);
      refetchTasks();
    },
    onError: (error) => {
      toast.error(`取消失败: ${error.message}`);
    },
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "active":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "waiting":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-200";
      case "paused":
        return "bg-gray-500/10 text-gray-600 border-gray-200";
      default:
        return "bg-gray-400/10 text-gray-600 border-gray-200";
    }
  };

  const getStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      completed: "已完成",
      active: "进行中",
      waiting: "等待中",
      failed: "失败",
      paused: "已暂停",
    };
    return labels[state] || state;
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setLocation("/dashboard");
    }
  };

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <DialogContent className={PAGE_DIALOG_CLASSNAME}>
      <ScrollArea className="h-full">
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">任务监控中心</h1>
            <p className="text-muted-foreground mt-2 text-lg">实时监控发布任务状态和进度</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="shadow-sm transition-all"
            >
              <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-pulse" : ""}`} />
              {autoRefresh ? "自动刷新开启" : "自动刷新关闭"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchTasks()} className="shadow-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">等待中</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading">{stats.waiting}</div>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-500">进行中</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading text-blue-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-500">已完成</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading text-green-600">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-500">失败</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading text-red-600">{stats.failed}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Task List and Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Task List */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm h-full flex flex-col overflow-hidden hover:border-primary/20 transition-colors">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="font-heading text-lg">任务列表</CardTitle>
              <CardDescription>所有发布任务的状态追踪</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-[600px]">
                {!tasks || tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Activity className="w-8 h-8 opacity-50" />
                    </div>
                    <p>暂无任务</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {tasks.map((task: any) => (
                      <div
                        key={task.id}
                        className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 group relative overflow-hidden ${
                          selectedJobId === task.id
                            ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border/40 hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm hover:-translate-y-0.5"
                        }`}
                        onClick={() => setSelectedJobId(task.id)}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                           task.state === 'completed' ? 'bg-green-500' :
                           task.state === 'failed' ? 'bg-red-500' :
                           task.state === 'active' ? 'bg-blue-500' :
                           'bg-transparent'
                        }`} />
                        <div className="flex items-center justify-between mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getStateColor(task.state)} border-0 ring-1 ring-inset`}>
                              {getStateLabel(task.state)}
                            </Badge>
                            <span className="text-xs font-medium text-muted-foreground font-mono">#{task.id}</span>
                          </div>
                          <Badge variant="secondary" className="font-normal text-xs bg-muted/50">
                            {task.data.platform}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium mb-2 line-clamp-1 pl-2 font-heading group-hover:text-primary transition-colors">
                          {task.data.config.bookTitle}
                        </div>
                        {typeof task.progress === "number" && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                              <span>进度</span>
                              <span className="font-mono">{Number(task.progress)}%</span>
                            </div>
                            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Task Detail */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm h-full shadow-sm hover:border-primary/20 transition-colors">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="font-heading text-lg">任务详情</CardTitle>
              <CardDescription>
                {selectedJobId ? `正在查看任务 #${selectedJobId}` : "选择一个任务查看详细信息"}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px] overflow-hidden p-0">
              <ScrollArea className="h-full p-6">
                {!selectedJobId ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground h-full animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Activity className="w-8 h-8 opacity-50" />
                    </div>
                    <p>请从左侧列表选择一个任务</p>
                  </div>
                ) : !taskDetail ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Task Info */}
                    <div className="bg-muted/30 rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                      <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                        基本信息
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 hover:bg-muted/50 px-2 rounded-md transition-colors">
                          <span className="text-muted-foreground">当前状态</span>
                          <Badge variant="outline" className={`${getStateColor(taskDetail.state)} border-0 ring-1 ring-inset`}>
                            {getStateLabel(taskDetail.state)}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 hover:bg-muted/50 px-2 rounded-md transition-colors">
                          <span className="text-muted-foreground">完成进度</span>
                          <span className="font-mono font-medium">{typeof taskDetail.progress === 'number' ? taskDetail.progress : 0}%</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 hover:bg-muted/50 px-2 rounded-md transition-colors">
                          <span className="text-muted-foreground">发布平台</span>
                          <span className="font-medium">{taskDetail.data.platform}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 hover:bg-muted/50 px-2 rounded-md transition-colors">
                          <span className="text-muted-foreground">作品名称</span>
                          <span className="font-medium">{taskDetail.data.config.bookTitle}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {typeof taskDetail.progress === "number" && (
                      <div className="bg-card rounded-xl p-4 border border-border/30 shadow-sm">
                        <div className="flex justify-between text-sm mb-3">
                          <span className="font-semibold flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                            总体进度
                          </span>
                          <span className="text-muted-foreground font-mono">{taskDetail.progress}%</span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden border border-border/20 shadow-inner">
                          <div
                            className="bg-gradient-to-r from-primary/80 to-primary h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                            style={{ width: `${taskDetail.progress}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] -skew-x-12"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Task Actions */}
                    <div className="flex gap-3 pt-2">
                      {String(taskDetail.state) === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate({ jobId: selectedJobId })}
                          disabled={pauseMutation.isPending}
                          className="flex-1 hover:bg-muted/80 shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          暂停任务
                        </Button>
                      )}
                      {String(taskDetail.state) === "paused" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resumeMutation.mutate({ jobId: selectedJobId })}
                          disabled={resumeMutation.isPending}
                          className="flex-1 hover:bg-muted/80 shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          恢复任务
                        </Button>
                      )}
                      {(String(taskDetail.state) === "waiting" ||
                        String(taskDetail.state) === "active" ||
                        String(taskDetail.state) === "paused") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate({ jobId: selectedJobId })}
                          disabled={cancelMutation.isPending}
                          className="flex-1 shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          <X className="w-4 h-4 mr-2" />
                          取消任务
                        </Button>
                      )}
                    </div>

                    {/* Task Logs */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-base">
                        <RefreshCw className="w-4 h-4 text-primary" />
                        执行日志
                      </h3>
                      <ScrollArea className="h-[250px] border border-border/40 rounded-xl bg-muted/10 p-4 shadow-inner">
                        {!taskDetail.logs || taskDetail.logs.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center gap-2">
                             <Activity className="w-8 h-8 opacity-20" />
                             暂无日志记录
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs font-mono">
                            {taskDetail.logs.map((log: string, index: number) => (
                              <div key={index} className="text-muted-foreground border-b border-border/10 pb-2 last:border-0 last:pb-0 hover:bg-muted/30 p-1.5 rounded transition-colors break-all">
                                <span className="text-primary/70 mr-2 inline-block w-8">[{index + 1}]</span>
                                {log}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>

                    {/* Error Info */}
                    {taskDetail.failedReason && (
                      <div className="animate-in slide-in-from-bottom-2 duration-500">
                        <h3 className="font-semibold mb-2 text-red-600 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          错误信息
                        </h3>
                        <div className="p-4 border border-red-200/50 rounded-xl bg-red-50/50 text-sm text-red-700 dark:bg-red-900/10 dark:text-red-300 dark:border-red-900/30 shadow-sm">
                          {taskDetail.failedReason}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskMonitor() {
  return (
    <DashboardLayout>
      <TaskMonitorContent />
    </DashboardLayout>
  );
}
