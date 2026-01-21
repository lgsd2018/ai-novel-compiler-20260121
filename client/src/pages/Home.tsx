import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, LAST_PROJECT_ID_KEY } from "@/const";
import { FolderOpen, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";

export default function Home() {
  const { isAuthenticated, loading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);

  const { data: projects = [], isLoading: isProjectsLoading, error: projectsError } = trpc.projects.list.useQuery(undefined, {
    enabled: !!isAuthenticated,
    retry: false
  });

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 font-medium">无法自动登录</p>
          <p className="text-muted-foreground text-sm max-w-md text-center">
            系统检测到登录重定向循环。这可能是因为后端登录服务未启动或配置错误。
          </p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            onClick={() => {
              sessionStorage.removeItem('login_attempt');
              window.location.href = getLoginUrl();
            }}
          >
            重试登录
          </button>
        </div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 font-medium">加载项目列表失败</p>
          <p className="text-muted-foreground text-sm max-w-md text-center">
            {projectsError.message}
          </p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            onClick={() => window.location.reload()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">正在进入工作台...</p>
        </div>
      </div>
    );
  }

  const handleOpenProject = (id: number) => {
    localStorage.setItem(LAST_PROJECT_ID_KEY, String(id));
    setLocation(`/project/${id}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl border-border/50 bg-card/60 backdrop-blur-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-heading">开始一个新项目</CardTitle>
          <CardDescription className="text-base">
            选择新建项目或打开已有文件夹继续写作
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button size="lg" className="h-12 text-base" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              新建项目
            </Button>
            <Button size="lg" variant="outline" className="h-12 text-base" onClick={() => setIsOpenDialogOpen(true)}>
              <FolderOpen className="w-5 h-5 mr-2" />
              打开文件夹
            </Button>
          </div>

          <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>选择要打开的项目</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {isProjectsLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    正在加载项目...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center text-muted-foreground py-10">
                    暂无项目，请先新建项目
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleOpenProject(project.id)}
                      className="w-full text-left border border-border/40 rounded-lg p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    >
                      <div className="font-medium text-base">{project.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {project.description || "暂无简介"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <CreateProjectDialog
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onSuccess={(projectId) => handleOpenProject(projectId)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
