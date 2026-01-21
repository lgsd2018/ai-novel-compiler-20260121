import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, FileText, Clock, Sparkles, TrendingUp, Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PAGE_DIALOG_CLASSNAME } from "@/const";
import { useLocation } from "wouter";

export default function Statistics() {
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.statistics.get.useQuery();

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setLocation("/dashboard");
    }
  };

  return (
    <DashboardLayout>
      <Dialog open onOpenChange={handleDialogOpenChange}>
        <DialogContent className={PAGE_DIALOG_CLASSNAME}>
          <ScrollArea className="h-full">
            <div className="space-y-8 p-6">
              <div>
                <h1 className="text-3xl font-heading font-bold tracking-tight">写作统计</h1>
                <p className="text-muted-foreground mt-2 text-lg">您的创作数据全景分析</p>
              </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-heading text-muted-foreground">总字数</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats?.totalWords?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">累计创作字数</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-heading text-muted-foreground">写作时长</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Clock className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{formatDuration(stats?.totalMinutes || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">累计写作时长</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-heading text-muted-foreground">AI使用</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Sparkles className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats?.totalAiCalls || 0} <span className="text-sm font-normal text-muted-foreground">次</span></div>
              <p className="text-xs text-muted-foreground mt-1">AI辅助次数</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-heading text-muted-foreground">项目数</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <BarChart3 className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats?.totalProjects || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">创建的项目</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Statistics */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border/40 bg-card hover:shadow-md transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                写作趋势
              </CardTitle>
              <CardDescription>最近30天的写作活动分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-primary/20 transition-colors">
                  <span className="text-sm text-muted-foreground">日均字数</span>
                  <span className="font-bold font-mono text-lg">{stats?.avgWordsPerDay || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-primary/20 transition-colors">
                  <span className="text-sm text-muted-foreground">日均写作时长</span>
                  <span className="font-bold font-mono text-lg">{formatDuration(stats?.avgMinutesPerDay || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-primary/20 transition-colors">
                  <span className="text-sm text-muted-foreground">活跃天数</span>
                  <span className="font-bold font-mono text-lg">{stats?.activeDays || 0} 天</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-md transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI使用分析
              </CardTitle>
              <CardDescription>AI辅助功能的使用详情</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-purple-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">总Token消耗</span>
                  <span className="font-bold font-mono text-lg">{stats?.totalTokens?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-purple-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">生成字数</span>
                  <span className="font-bold font-mono text-lg">{stats?.aiGeneratedWords?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-purple-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">平均响应时间</span>
                  <span className="font-bold font-mono text-lg">{stats?.avgResponseTime || 0}秒</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-md transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
                创作习惯
              </CardTitle>
              <CardDescription>您的写作时间分布与习惯</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-blue-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">最常创作时段</span>
                  <span className="font-bold font-mono text-lg">{stats?.mostActiveHour ? `${stats.mostActiveHour}:00` : "暂无数据"}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-blue-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">最长连续天数</span>
                  <span className="font-bold font-mono text-lg">{stats?.longestStreak || 0} 天</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-blue-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">当前连续天数</span>
                  <span className="font-bold font-mono text-lg">{stats?.currentStreak || 0} 天</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card hover:shadow-md transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <FileText className="w-5 h-5 text-green-500" />
                内容统计
              </CardTitle>
              <CardDescription>作品内容的结构分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-green-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">总章节数</span>
                  <span className="font-bold font-mono text-lg">{stats?.totalChapters || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-green-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">角色数量</span>
                  <span className="font-bold font-mono text-lg">{stats?.totalCharacters || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20 hover:border-green-500/20 transition-colors">
                  <span className="text-sm text-muted-foreground">平均章节字数</span>
                  <span className="font-bold font-mono text-lg">{stats?.avgChapterWords || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
