import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, FileText, Clock } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      toast.success("项目创建成功");
      setIsCreateDialogOpen(false);
      setNewProjectTitle("");
      setNewProjectDescription("");
      refetch();
      setLocation(`/project/${data.projectId}`);
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const handleCreateProject = () => {
    if (!newProjectTitle.trim()) {
      toast.error("请输入项目标题");
      return;
    }
    createProjectMutation.mutate({
      title: newProjectTitle,
      description: newProjectDescription,
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">我的项目</h1>
            <p className="text-muted-foreground mt-2 text-lg">管理您的创作项目，开始新的故事</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300">
                <Plus className="w-5 h-5 mr-2" />
                新建项目
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">创建新项目</DialogTitle>
                <DialogDescription>
                  给您的新故事起个名字
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">项目标题</Label>
                  <Input
                    id="title"
                    placeholder="例如：星际穿越"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-base">项目简介</Label>
                  <Textarea
                    id="description"
                    placeholder="这个故事关于..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    rows={4}
                    className="resize-none bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateProject}
                  disabled={createProjectMutation.isPending}
                  className="w-full h-11 text-base shadow-md"
                >
                  {createProjectMutation.isPending ? "创建中..." : "开始创作"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse bg-card border-border/40 shadow-sm h-[200px] rounded-xl">
                <CardHeader className="space-y-3">
                  <div className="h-6 bg-muted rounded-md w-3/4"></div>
                  <div className="h-4 bg-muted rounded-md w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded-md w-full mt-8"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer group border border-border/40 bg-card hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 ease-out h-[200px] flex flex-col justify-between overflow-hidden relative rounded-xl"
                onClick={() => setLocation(`/project/${project.id}`)}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-500"></div>
                <CardHeader className="pb-2 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <CardTitle className="text-xl font-bold tracking-tight truncate group-hover:text-primary transition-colors font-heading">
                        {project.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed h-[2.5em] text-muted-foreground/80">
                        {project.description || "暂无简介"}
                      </CardDescription>
                    </div>
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full shrink-0 mt-2 ring-2 ring-background transition-colors", 
                      project.status === "completed" ? "bg-green-500" : 
                      project.status === "archived" ? "bg-gray-400" : "bg-blue-500"
                    )} title={project.status === "completed" ? "已完结" : project.status === "archived" ? "已归档" : "连载中"}></div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground/70 border-t border-border/40 pt-4 mt-2">
                    <div className="flex items-center gap-1.5 group-hover:text-primary/70 transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{project.wordCount.toLocaleString()} 字</span>
                    </div>
                    <div className="flex items-center gap-1.5 group-hover:text-primary/70 transition-colors">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border/40 rounded-3xl bg-muted/5 hover:bg-muted/10 transition-colors group cursor-pointer animate-in fade-in zoom-in-95 duration-500" onClick={() => setIsCreateDialogOpen(true)}>
            <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <Sparkles className="w-10 h-10 text-primary/40 group-hover:text-primary transition-colors duration-500" />
            </div>
            <h3 className="text-2xl font-heading font-bold mb-3 text-foreground">还没有项目</h3>
            <p className="text-muted-foreground mb-8 max-w-sm px-4 leading-relaxed text-base">
              每一个伟大的故事都始于一个空白页。<br/>创建一个新项目，开始您的 AI 辅助创作之旅。
            </p>
            <Button size="lg" className="shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all h-12 px-8 text-base rounded-full">
              <Plus className="w-5 h-5 mr-2" />
              立即创建
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
