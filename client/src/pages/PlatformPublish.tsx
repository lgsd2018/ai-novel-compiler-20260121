import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Globe, Key, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function PlatformPublish() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [platformCredentials, setPlatformCredentials] = useState({
    username: "",
    password: "",
    apiKey: "",
  });

  const platforms = [
    {
      id: "qidian",
      name: "起点中文网",
      icon: "📚",
      description: "中国最大的网络文学平台",
      status: "available",
      requiresAuth: true,
    },
    {
      id: "jinjiang",
      name: "晋江文学城",
      icon: "✨",
      description: "知名女性向文学平台",
      status: "available",
      requiresAuth: true,
    },
    {
      id: "zongheng",
      name: "纵横中文网",
      icon: "🌐",
      description: "百度旗下文学平台",
      status: "coming_soon",
      requiresAuth: true,
    },
    {
      id: "17k",
      name: "17K小说网",
      icon: "📖",
      description: "主流原创文学网站",
      status: "coming_soon",
      requiresAuth: true,
    },
  ];

  const handleConfigurePlatform = () => {
    toast.success(`${selectedPlatform} 配置已保存`);
    setIsConfigDialogOpen(false);
    setPlatformCredentials({ username: "", password: "", apiKey: "" });
  };

  const handlePublish = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (platform?.status === "coming_soon") {
      toast.info(`${platform.name} 集成开发中，敬请期待`);
      return;
    }
    toast.info(`正在发布到 ${platform?.name}...`);
    // TODO: Implement actual publishing logic
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/project/${projectId}`)} className="hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold font-heading tracking-tight">平台发布</h2>
              <p className="text-muted-foreground">一键将您的作品发布到各大主流文学平台</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="platforms" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="platforms" className="px-6 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">平台列表</TabsTrigger>
            <TabsTrigger value="history" className="px-6 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">发布历史</TabsTrigger>
          </TabsList>

          <TabsContent value="platforms" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {platforms.map((platform) => (
                <Card key={platform.id} className="relative group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl filter drop-shadow-sm">{platform.icon}</div>
                      <div className="flex-1">
                        <CardTitle className="font-heading text-lg">{platform.name}</CardTitle>
                        <CardDescription className="mt-1">{platform.description}</CardDescription>
                      </div>
                      {platform.status === "coming_soon" && (
                        <span className="text-xs bg-muted/80 px-2 py-1 rounded-full font-medium text-muted-foreground">开发中</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md w-fit">
                      {platform.requiresAuth ? (
                        <>
                          <Key className="w-4 h-4" />
                          <span>需要账号认证</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4" />
                          <span>无需认证</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                        onClick={() => {
                          setSelectedPlatform(platform.name);
                          setIsConfigDialogOpen(true);
                        }}
                        disabled={platform.status === "coming_soon"}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        配置
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 shadow-md shadow-primary/20"
                        onClick={() => handlePublish(platform.id)}
                        disabled={platform.status === "coming_soon"}
                      >
                        发布
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-muted/30 border-dashed border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  使用说明
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. 点击"配置"按钮，输入对应平台的账号信息或API密钥</p>
                <p>2. 配置完成后，点击"发布"按钮即可一键发布作品</p>
                <p>3. 发布过程可能需要几分钟，请耐心等待</p>
                <p>4. 发布完成后可在"发布历史"中查看详情</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/50 rounded-xl bg-muted/5">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-2">暂无发布记录</h3>
              <p className="text-muted-foreground">发布作品后将在此显示</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Platform Configuration Dialog */}
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="font-heading">配置 {selectedPlatform}</DialogTitle>
              <DialogDescription>
                输入您的账号信息以连接平台
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>用户名/邮箱</Label>
                <Input
                  value={platformCredentials.username}
                  onChange={(e) => setPlatformCredentials({ ...platformCredentials, username: e.target.value })}
                  placeholder="输入用户名或邮箱"
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={platformCredentials.password}
                  onChange={(e) => setPlatformCredentials({ ...platformCredentials, password: e.target.value })}
                  placeholder="输入密码"
                />
              </div>
              <div className="space-y-2">
                <Label>API密钥（可选）</Label>
                <Input
                  value={platformCredentials.apiKey}
                  onChange={(e) => setPlatformCredentials({ ...platformCredentials, apiKey: e.target.value })}
                  placeholder="如果平台提供API密钥，请输入"
                />
              </div>
              <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground border border-border/50">
                <p>⚠️ 您的账号信息将被加密存储，仅用于发布作品</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleConfigurePlatform}>
                保存配置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
