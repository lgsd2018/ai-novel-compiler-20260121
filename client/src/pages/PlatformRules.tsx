import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check, Wand2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PAGE_DIALOG_CLASSNAME } from "@/const";
import { useLocation } from "wouter";

type Platform = "qidian" | "jinjiang" | "zongheng" | "17k";

const platformNames: Record<Platform, string> = {
  qidian: "起点中文网",
  jinjiang: "晋江文学城",
  zongheng: "纵横中文网",
  "17k": "17K小说网",
};

const RULE_TYPE_LABELS: Record<string, string> = {
  word_count: "章节字数限制",
  tags: "标签数量",
  category: "分类要求",
  chapter_title: "章节标题规则",
  sensitive_words: "敏感词检测",
  content_rating: "内容分级",
  work_word_count: "作品字数门槛",
  submission_requirements: "投稿/签约材料",
};

export function PlatformRulesContent() {
  const [, setLocation] = useLocation();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("qidian");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Query rules for selected platform
  const { data: rules, refetch: refetchRules } = trpc.platformRules.getRules.useQuery({
    platform: selectedPlatform,
  });

  // Mutations
  const createMutation = trpc.platformRules.create.useMutation({
    onSuccess: () => {
      toast.success("规则创建成功");
      refetchRules();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.platformRules.update.useMutation({
    onSuccess: () => {
      toast.success("规则更新成功");
      refetchRules();
      setIsEditDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.platformRules.delete.useMutation({
    onSuccess: () => {
      toast.success("规则删除成功");
      refetchRules();
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const activateMutation = trpc.platformRules.activate.useMutation({
    onSuccess: () => {
      toast.success("规则已激活");
      refetchRules();
    },
    onError: (error) => {
      toast.error(`激活失败: ${error.message}`);
    },
  });

  const importPresetsMutation = trpc.platformRules.importPresets.useMutation({
    onSuccess: (data) => {
      toast.success(`已导入预设模板：新增${data.createdCount}条，跳过${data.skippedCount}条`);
      refetchRules();
    },
    onError: (error) => {
      toast.error(`导入失败: ${error.message}`);
    },
  });

  const handleCreate = (formData: any) => {
    createMutation.mutate({
      platform: selectedPlatform,
      ...formData,
    });
  };

  const handleUpdate = (formData: any) => {
    if (!editingRule) return;
    updateMutation.mutate({
      id: editingRule.id,
      ...formData,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这条规则吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleActivate = (id: number) => {
    activateMutation.mutate({
      platform: selectedPlatform,
      id,
    });
  };

  const handleImportPresets = () => {
    const ok = confirm(`将为 ${platformNames[selectedPlatform]} 导入预设规则模板，是否继续？`);
    if (!ok) return;
    importPresetsMutation.mutate({
      platform: selectedPlatform,
      activate: true,
    });
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
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-tight">平台发布规则配置</h1>
              <p className="text-muted-foreground mt-2 text-lg">
                管理各个平台的发布规则，包括字数限制、标签要求、分类规则等
              </p>
            </div>

            <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as Platform)} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 p-1 bg-muted/30">
                <TabsTrigger value="qidian" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">{platformNames.qidian}</TabsTrigger>
                <TabsTrigger value="jinjiang" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">{platformNames.jinjiang}</TabsTrigger>
                <TabsTrigger value="zongheng" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">{platformNames.zongheng}</TabsTrigger>
                <TabsTrigger value="17k" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">{platformNames["17k"]}</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedPlatform} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                  <h2 className="text-xl font-semibold font-heading flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                    {platformNames[selectedPlatform]} 规则列表
                  </h2>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleImportPresets}
                      disabled={importPresetsMutation.isPending}
                      className="shadow-sm"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      {importPresetsMutation.isPending ? "导入中..." : "导入预设模板"}
                    </Button>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                          <Plus className="w-4 h-4 mr-2" />
                          新建规则
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl">
                        <RuleForm
                          onSubmit={handleCreate}
                          onCancel={() => setIsCreateDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {rules?.map((rule) => (
                      <Card key={rule.id} className="border-border/40 hover:border-primary/30 hover:shadow-md transition-all group">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-3 text-lg font-heading">
                                {rule.ruleName}
                                {rule.isActive && (
                                  <Badge variant="default" className="bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-200 shadow-sm">
                                    <Check className="w-3 h-3 mr-1" />
                                    已激活
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="line-clamp-2">
                                {rule.description}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!rule.isActive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleActivate(rule.id)}
                                >
                                  激活
                                </Button>
                              )}
                              <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRule(rule);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(rule.id)}
                            className="bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:text-red-700 border-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border border-border/20">
                        <div className="flex items-center justify-between border-b border-border/20 pb-2 col-span-2 sm:col-span-1">
                          <span className="text-muted-foreground">规则类型</span>
                          <Badge variant="secondary" className="font-normal">
                            {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between border-b border-border/20 pb-2 col-span-2 sm:col-span-1">
                          <span className="text-muted-foreground">版本</span>
                          <span className="font-mono">{rule.version}</span>
                        </div>
                        <div className="col-span-2 pt-2">
                          <span className="text-muted-foreground block mb-2 text-xs uppercase tracking-wider">规则配置</span>
                          <pre className="p-3 bg-background rounded-md text-xs font-mono overflow-x-auto border border-border/30 shadow-inner">
                            {JSON.stringify(rule.ruleValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {(!rules || rules.length === 0) && (
                  <Card className="border-dashed border-2 border-border/50 bg-muted/10">
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                        <Wand2 className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="text-lg font-medium mb-2">暂无规则配置</p>
                      <p className="text-sm mb-6">该平台尚未配置任何发布规则</p>
                      <Button variant="outline" onClick={handleImportPresets}>
                        导入预设模板
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
              </TabsContent>
            </Tabs>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl">
                <RuleForm
                  initialData={editingRule}
                  onSubmit={handleUpdate}
                  onCancel={() => {
                    setIsEditDialogOpen(false);
                    setEditingRule(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Rule Form Component
function RuleForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    ruleType: initialData?.ruleType || "",
    ruleName: initialData?.ruleName || "",
    description: initialData?.description || "",
    version: initialData?.version || "1.0",
    isActive: initialData?.isActive || false,
    ruleValue: initialData?.ruleValue ? JSON.stringify(initialData.ruleValue, null, 2) : "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const ruleValue = JSON.parse(formData.ruleValue);
      onSubmit({
        ...formData,
        ruleValue,
      });
    } catch (error) {
      toast.error("规则配置JSON格式错误");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? "编辑规则" : "新建规则"}</DialogTitle>
        <DialogDescription>
          配置平台发布规则，包括字数限制、标签要求等
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="ruleType">规则类型</Label>
          <Select
            value={formData.ruleType}
            onValueChange={(value) => setFormData({ ...formData, ruleType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择规则类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="word_count">字数限制</SelectItem>
              <SelectItem value="tags">标签数量</SelectItem>
              <SelectItem value="category">分类要求</SelectItem>
              <SelectItem value="chapter_title">章节标题规则</SelectItem>
              <SelectItem value="sensitive_words">敏感词检测</SelectItem>
              <SelectItem value="content_rating">内容分级</SelectItem>
              <SelectItem value="work_word_count">作品字数门槛</SelectItem>
              <SelectItem value="submission_requirements">投稿/签约材料</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruleName">规则名称</Label>
          <Input
            id="ruleName"
            value={formData.ruleName}
            onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
            placeholder="例如：章节字数限制"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">规则描述</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="详细描述规则内容"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="version">版本号</Label>
          <Input
            id="version"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            placeholder="1.0"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruleValue">规则配置 (JSON)</Label>
          <Textarea
            id="ruleValue"
            value={formData.ruleValue}
            onChange={(e) => setFormData({ ...formData, ruleValue: e.target.value })}
            placeholder='{"min": 2000, "max": 10000}'
            rows={8}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            示例：字数限制 {`{"min": 2000, "max": 10000}`}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label htmlFor="isActive">立即激活此规则</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          {initialData ? "更新" : "创建"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function PlatformRules() {
  return (
    <DashboardLayout>
      <PlatformRulesContent />
    </DashboardLayout>
  );
}
