import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, Download, FileText, Clock, CheckCircle, XCircle, Loader2, Palette } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Exports() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "epub" | "word" | "html">("html");

  const { data: exports, refetch } = trpc.exports.list.useQuery();

  const createExportMutation = trpc.exports.create.useMutation({
    onSuccess: () => {
      toast.success("导出任务已创建");
      setIsCreateDialogOpen(false);
      refetch();
    },
  });

  const handleCreateExport = () => {
    createExportMutation.mutate({
      projectId: Number(projectId),
      format: selectedFormat,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      case "pending":
        return "处理中";
      default:
        return "未知";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default"; // Use default (usually primary) or a custom green class
      case "failed":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/project/${projectId}`)} className="hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold font-heading tracking-tight">导出管理</h2>
              <p className="text-muted-foreground">导出您的作品为多种格式，支持自定义样式</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation(`/project/${projectId}/export-style`)} className="shadow-sm">
              <Palette className="w-4 h-4 mr-2" />
              样式定制
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm">
                  <Download className="w-4 h-4 mr-2" />
                  新建导出
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl">
                <DialogHeader>
                  <DialogTitle className="font-heading">导出作品</DialogTitle>
                  <DialogDescription>选择导出格式</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">导出格式</label>
                    <Select value={selectedFormat} onValueChange={(v: any) => setSelectedFormat(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="word">Word (TXT)</SelectItem>
                        <SelectItem value="pdf">PDF (开发中)</SelectItem>
                        <SelectItem value="epub">EPUB (开发中)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>取消</Button>
                  <Button onClick={handleCreateExport} disabled={createExportMutation.isPending}>
                    {createExportMutation.isPending ? "创建中..." : "开始导出"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Exports List */}
        {exports && exports.length > 0 ? (
          <div className="grid gap-4">
            {exports.map((exp) => (
              <Card key={exp.id} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-heading flex items-center gap-2">
                          {exp.format.toUpperCase()} 导出
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3" />
                          {new Date(exp.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={getStatusBadgeVariant(exp.status) as any}
                      className={`flex items-center gap-1.5 ${
                        exp.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-900/20 dark:text-green-400' : ''
                      }`}
                    >
                      {getStatusIcon(exp.status)}
                      <span>{getStatusText(exp.status)}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  {exp.status === "completed" && exp.fileUrl && (
                    <div className="mt-4 flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border/20">
                      <div className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                        文件大小: {(exp.fileSize! / 1024).toFixed(2)} KB
                      </div>
                      <Button asChild size="sm" variant="secondary" className="shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors">
                        <a href={exp.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-2" />
                          下载文件
                        </a>
                      </Button>
                    </div>
                  )}
                  {exp.status === "failed" && exp.errorMessage && (
                    <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>错误: {exp.errorMessage}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">还没有导出记录</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                导出您的作品为 HTML、Word 等格式，支持自定义排版样式
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="shadow-sm">
                <Download className="w-4 h-4 mr-2" />
                新建导出任务
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
