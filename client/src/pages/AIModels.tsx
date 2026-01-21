import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import DashboardLayout from "@/components/DashboardLayout";

export default function AIModels() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newModel, setNewModel] = useState({
    name: "",
    provider: "deepseek",
    modelName: "deepseek-chat",
    apiKey: "",
    apiEndpoint: "",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2000,
  });

  const { data: models, refetch } = trpc.aiModels.list.useQuery();

  const createMutation = trpc.aiModels.create.useMutation({
    onSuccess: () => {
      toast.success("模型配置创建成功");
      setIsCreateDialogOpen(false);
      setNewModel({
        name: "",
        provider: "deepseek",
        modelName: "deepseek-chat",
        apiKey: "",
        apiEndpoint: "",
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
      });
      refetch();
    },
  });

  const deleteMutation = trpc.aiModels.delete.useMutation({
    onSuccess: () => {
      toast.success("模型配置已删除");
      refetch();
    },
  });

  const handleCreate = () => {
    if (!newModel.name.trim() || !newModel.apiKey.trim()) {
      toast.error("请填写必填项");
      return;
    }
    createMutation.mutate(newModel);
  };

  const handleDelete = (configId: number) => {
    if (confirm("确定要删除这个模型配置吗？")) {
      deleteMutation.mutate({ configId });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">AI模型配置</h1>
            <p className="text-muted-foreground mt-2 text-lg">配置和管理您的 AI 模型参数</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300">
                <Plus className="w-5 h-5 mr-2" />
                添加模型
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">添加AI模型</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <Label>配置名称</Label>
                  <Input
                    value={newModel.name}
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                    placeholder="例如：DeepSeek主力模型"
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>提供商</Label>
                  <Input
                    value={newModel.provider}
                    onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                    placeholder="例如：deepseek, openai, glm"
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>模型名称</Label>
                  <Input
                    value={newModel.modelName}
                    onChange={(e) => setNewModel({ ...newModel, modelName: e.target.value })}
                    placeholder="例如：deepseek-chat"
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API密钥</Label>
                  <Input
                    type="password"
                    value={newModel.apiKey}
                    onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                    placeholder="输入API密钥"
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API端点（可选）</Label>
                  <Input
                    value={newModel.apiEndpoint}
                    onChange={(e) => setNewModel({ ...newModel, apiEndpoint: e.target.value })}
                    placeholder="留空使用默认端点"
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm text-muted-foreground font-mono">{newModel.temperature}</span>
                    </div>
                    <Slider
                      value={[newModel.temperature]}
                      onValueChange={([v]) => setNewModel({ ...newModel, temperature: v })}
                      min={0}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Top P</Label>
                      <span className="text-sm text-muted-foreground font-mono">{newModel.topP}</span>
                    </div>
                    <Slider
                      value={[newModel.topP]}
                      onValueChange={([v]) => setNewModel({ ...newModel, topP: v })}
                      min={0}
                      max={1}
                      step={0.1}
                      className="py-2"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>最大Token数</Label>
                  <Input
                    type="number"
                    value={newModel.maxTokens}
                    onChange={(e) => setNewModel({ ...newModel, maxTokens: Number(e.target.value) })}
                    className="h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full h-11 text-base shadow-md">
                  {createMutation.isPending ? "创建中..." : "添加模型"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {models && models.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
            {models.map((model) => (
              <Card key={model.id} className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/40 bg-card hover:border-primary/30 hover:-translate-y-1 rounded-xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-500"></div>
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="font-heading text-lg tracking-tight group-hover:text-primary transition-colors">{model.name}</CardTitle>
                        <CardDescription className="text-xs font-medium mt-1 px-2 py-0.5 rounded-full bg-muted inline-block border border-border/50">
                          {model.provider} / {model.modelName}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(model.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/20">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Temperature</span>
                      <span className="font-mono font-medium">{model.temperature}</span>
                    </div>
                    <div className="flex flex-col p-2.5 rounded-lg bg-muted/30 border border-border/20">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top P</span>
                      <span className="font-mono font-medium">{model.topP}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-muted/30 border border-border/20">
                    <span className="text-xs text-muted-foreground">Max Tokens</span>
                    <span className="font-mono font-medium">{model.maxTokens}</span>
                  </div>
                  {model.isDefault && (
                    <div className="pt-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
                        默认模型
                      </span>
                    </div>
                  )}
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
            <h3 className="text-2xl font-heading font-bold mb-3 text-foreground">还没有配置AI模型</h3>
            <p className="text-muted-foreground mb-8 max-w-sm px-4 leading-relaxed text-base">
              添加您的第一个AI模型配置，<br/>为创作助手提供动力。
            </p>
            <Button size="lg" className="shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all h-12 px-8 text-base rounded-full">
              <Plus className="w-5 h-5 mr-2" />
              添加模型
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
