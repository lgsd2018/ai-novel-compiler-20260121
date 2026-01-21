import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function TaskPlannerPage() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [taskPlannerRepoUrl, setTaskPlannerRepoUrl] = useState("https://github.com/eyaltoledano/claude-task-master");
  const [taskPlannerSearch, setTaskPlannerSearch] = useState("");
  const [taskPlannerStatusFilter, setTaskPlannerStatusFilter] = useState("all");
  const [taskPlannerPriorityFilter, setTaskPlannerPriorityFilter] = useState("all");
  const [taskPlannerRequestId, setTaskPlannerRequestId] = useState<string | null>(null);

  const { data: aiModels } = trpc.aiModels.list.useQuery();
  const startTaskPlannerMutation = trpc.ai.startTaskPlanner.useMutation();
  const updateTaskPlannerItemMutation = trpc.ai.updateTaskPlannerItem.useMutation({
    onError: (error) => {
      toast.error(`任务更新失败: ${error.message}`);
    },
  });
  const pauseTaskPlannerMutation = trpc.ai.pauseTaskPlanner.useMutation({
    onError: (error) => {
      toast.error(`任务暂停失败: ${error.message}`);
    },
  });

  const { data: taskPlannerTrace } = trpc.ai.pollTaskPlanner.useQuery(
    { requestId: taskPlannerRequestId! },
    {
      enabled: !!taskPlannerRequestId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "error") return false;
        return 1000;
      },
    }
  );

  const taskPlannerStatusLabel = (status?: string) => {
    if (status === "completed") return "已完成";
    if (status === "error") return "异常";
    if (status === "paused") return "暂停";
    if (status === "in_progress") return "进行中";
    if (status === "pending") return "待处理";
    if (status === "running") return "运行中";
    return "未启动";
  };

  const taskPlannerProgress = useMemo(() => {
    if (typeof taskPlannerTrace?.progress === "number") return taskPlannerTrace.progress;
    const todo = taskPlannerTrace?.todo ?? [];
    if (todo.length === 0) return 0;
    const done = todo.filter(item => item.status === "completed").length;
    return Math.round((done / todo.length) * 100);
  }, [taskPlannerTrace]);

  const filteredTaskPlannerTodo = useMemo(() => {
    const todo = taskPlannerTrace?.todo ?? [];
    const search = taskPlannerSearch.trim().toLowerCase();
    return todo.filter(item => {
      if (taskPlannerStatusFilter !== "all" && item.status !== taskPlannerStatusFilter) return false;
      if (taskPlannerPriorityFilter !== "all" && item.priority !== taskPlannerPriorityFilter) return false;
      if (!search) return true;
      const haystack = `${item.id} ${item.title} ${item.accepts?.join(" ") ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [taskPlannerTrace, taskPlannerSearch, taskPlannerStatusFilter, taskPlannerPriorityFilter]);

  const handleStartTaskPlanner = async () => {
    if (!projectId) {
      toast.error("缺少项目编号");
      return;
    }
    if (!aiModels || aiModels.length === 0) {
      toast.error("请先配置AI模型");
      setLocation("/ai-models");
      return;
    }
    const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0];
    try {
      const result = await startTaskPlannerMutation.mutateAsync({
        modelConfigId: defaultModel.id,
        projectId: Number(projectId),
        repoUrl: taskPlannerRepoUrl,
      });
      setTaskPlannerRequestId(result.requestId);
      toast.success("任务规划已启动");
    } catch (error: any) {
      toast.error(error?.message || "任务规划启动失败");
    }
  };

  const handleToggleTaskPlanner = async () => {
    if (!taskPlannerRequestId) return;
    const nextPaused = taskPlannerTrace?.status !== "paused";
    try {
      await pauseTaskPlannerMutation.mutateAsync({
        requestId: taskPlannerRequestId,
        paused: nextPaused,
      });
      toast.success(nextPaused ? "已暂停任务规划" : "已恢复任务规划");
    } catch (error: any) {
      toast.error(error?.message || "任务规划状态更新失败");
    }
  };

  return (
    <DashboardLayout mainClassName="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/project/${projectId}`)} className="hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold font-heading tracking-tight">任务规划</h2>
              <p className="text-muted-foreground">集中管理项目任务与进度</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {taskPlannerStatusLabel(taskPlannerTrace?.status)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 flex-1 min-h-0">
          <div className="flex flex-col gap-6 min-h-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">规划设置</CardTitle>
                <CardDescription>配置仓库地址并启动规划</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">仓库地址</Label>
                  <Input
                    value={taskPlannerRepoUrl}
                    onChange={(e) => setTaskPlannerRepoUrl(e.target.value)}
                    placeholder="https://github.com/eyaltoledano/claude-task-master"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleStartTaskPlanner} disabled={startTaskPlannerMutation.isPending}>
                    {startTaskPlannerMutation.isPending ? "启动中..." : "启动规划"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleToggleTaskPlanner}
                    disabled={!taskPlannerRequestId || pauseTaskPlannerMutation.isPending || taskPlannerTrace?.status === "completed"}
                  >
                    {taskPlannerTrace?.status === "paused" ? "恢复" : "暂停"}
                  </Button>
                </div>

                {taskPlannerTrace && (
                  <div className="space-y-4 border-t border-border/40 pt-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>进度</span>
                        <span className="font-mono">{taskPlannerProgress}%</span>
                      </div>
                      <Progress value={taskPlannerProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>任务数 {filteredTaskPlannerTodo.length}/{taskPlannerTrace.todo?.length ?? 0}</span>
                        <span>{taskPlannerTrace.updatedAt ? new Date(taskPlannerTrace.updatedAt).toLocaleString() : "-"}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Input
                        value={taskPlannerSearch}
                        onChange={(e) => setTaskPlannerSearch(e.target.value)}
                        placeholder="搜索任务标题、编号、验收标准"
                        className="h-9 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={taskPlannerStatusFilter} onValueChange={setTaskPlannerStatusFilter}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部状态</SelectItem>
                            <SelectItem value="pending">待处理</SelectItem>
                            <SelectItem value="in_progress">进行中</SelectItem>
                            <SelectItem value="completed">已完成</SelectItem>
                            <SelectItem value="paused">已暂停</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={taskPlannerPriorityFilter} onValueChange={setTaskPlannerPriorityFilter}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部优先级</SelectItem>
                            <SelectItem value="high">高优先级</SelectItem>
                            <SelectItem value="medium">中优先级</SelectItem>
                            <SelectItem value="low">低优先级</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/50 backdrop-blur-sm flex flex-col min-h-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">执行日志</CardTitle>
                <CardDescription>规划过程的实时记录</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-[260px]">
                  <div className="p-4 space-y-2 text-sm text-muted-foreground">
                    {taskPlannerTrace?.history && taskPlannerTrace.history.length > 0 ? (
                      taskPlannerTrace.history.slice().reverse().map((entry, index) => (
                        <div key={`${entry.timestamp}-${index}`} className="flex items-start justify-between gap-4">
                          <span className="flex-1">{entry.message}</span>
                          <span className="font-mono text-xs">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-6">暂无记录</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="font-heading text-lg">任务列表</CardTitle>
              <CardDescription>任务状态、优先级与验收标准</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-[620px]">
                <div className="space-y-3 p-4">
                  {taskPlannerTrace?.todo && taskPlannerTrace.todo.length > 0 ? (
                    filteredTaskPlannerTodo.length > 0 ? (
                      filteredTaskPlannerTodo.map((item) => {
                        const statusClass = item.status === "completed"
                          ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30"
                          : item.status === "in_progress"
                            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30"
                            : item.status === "paused"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border/40";
                        const estimateText = typeof item.estimateMinutes === "number" ? `${item.estimateMinutes}分钟` : "未估算";
                        return (
                          <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-background/60">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-foreground line-clamp-1">{item.title}</div>
                              <Badge variant="outline" className={`text-[11px] ${statusClass}`}>
                                {taskPlannerStatusLabel(item.status)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{item.id}</span> · 预估 {estimateText}
                              {item.dependsOn && item.dependsOn.length > 0 ? ` · 依赖 ${item.dependsOn.join(", ")}` : ""}
                            </div>
                            {item.accepts && item.accepts.length > 0 && (
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>验收标准</div>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {item.accepts.map((text, index) => (
                                    <li key={`${item.id}-accept-${index}`}>{text}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={item.status}
                                onValueChange={(value) => {
                                  if (!taskPlannerRequestId) return;
                                  updateTaskPlannerItemMutation.mutate({
                                    requestId: taskPlannerRequestId,
                                    id: item.id,
                                    status: value as any,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">待处理</SelectItem>
                                  <SelectItem value="in_progress">进行中</SelectItem>
                                  <SelectItem value="completed">已完成</SelectItem>
                                  <SelectItem value="paused">已暂停</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={item.priority}
                                onValueChange={(value) => {
                                  if (!taskPlannerRequestId) return;
                                  updateTaskPlannerItemMutation.mutate({
                                    requestId: taskPlannerRequestId,
                                    id: item.id,
                                    priority: value as any,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">高优先级</SelectItem>
                                  <SelectItem value="medium">中优先级</SelectItem>
                                  <SelectItem value="low">低优先级</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-10">未找到匹配任务</div>
                    )
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-10">暂无任务</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
