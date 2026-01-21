import { trpc } from '../lib/trpc';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Plus, Edit, Trash2, Play, Download, Upload, Settings2, Sparkles, Box } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { ScrollArea } from '../components/ui/scroll-area';
import { Checkbox } from '../components/ui/checkbox';

interface ExtractionRule {
  id: number;
  userId?: number;
  projectId?: number;
  name: string;
  description: string;
  ruleType: string;
  fields: any;
  prompt: string;
  isActive: boolean;
  priority: number;
}

interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  example?: any;
}

export function ExtractionRulesContent() {
  const [rules, setRules] = useState<ExtractionRule[]>([]);
  const [templates, setTemplates] = useState<ExtractionRule[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ExtractionRule | null>(null);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    ruleType: 'custom' | 'character' | 'setting' | 'event';
    fields: FieldDefinition[];
    prompt: string;
    priority: number;
  }>({
    name: '',
    description: '',
    ruleType: 'event',
    fields: [],
    prompt: '',
    priority: 5,
  });

  const getRules = trpc.extractionRules.list.useQuery({});
  const getTemplates = trpc.extractionRules.getPresets.useQuery();
  const createRule = trpc.extractionRules.create.useMutation();
  const updateRule = trpc.extractionRules.update.useMutation();
  const deleteRule = trpc.extractionRules.delete.useMutation();
  const toggleRule = trpc.extractionRules.toggleActive.useMutation();
  // TODO: 待实现测试API
  // const testRule = trpc.aiContentAnalyzer.analyze.useMutation();
  const testRule = { mutateAsync: async () => ({}) } as any;

  useEffect(() => {
    if (getRules.data) {
      setRules(getRules.data as any);
    }
  }, [getRules.data]);

  useEffect(() => {
    if (getTemplates.data) {
      setTemplates(getTemplates.data as any);
    }
  }, [getTemplates.data]);

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      ruleType: 'event',
      fields: [],
      prompt: '',
      priority: 5,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: ExtractionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      ruleType: rule.ruleType as 'custom' | 'character' | 'setting' | 'event',
      fields: rule.fields,
      prompt: rule.prompt,
      priority: rule.priority,
    });
    setIsDialogOpen(true);
  };

  const handleApplyTemplate = async (template: ExtractionRule) => {
    setFormData({
      name: template.name,
      description: template.description,
      ruleType: template.ruleType as 'custom' | 'character' | 'setting' | 'event',
      fields: template.fields,
      prompt: template.prompt,
      priority: template.priority,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        name: formData.name,
        description: formData.description,
        ruleType: formData.ruleType,
        fields: formData.fields,
        prompt: formData.prompt,
        priority: formData.priority,
      });
        toast.success('规则已更新');
      } else {
        await createRule.mutateAsync({
        name: formData.name,
        description: formData.description,
        ruleType: formData.ruleType,
        fields: formData.fields as any,
        prompt: formData.prompt,
        priority: formData.priority,
      });
        toast.success('规则已创建');
      }
      setIsDialogOpen(false);
      getRules.refetch();
    } catch (error: any) {
      toast.error(`操作失败: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个规则吗？')) return;
    try {
      await deleteRule.mutateAsync({ id });
      toast.success('规则已删除');
      getRules.refetch();
    } catch (error: any) {
      toast.error(`删除失败: ${error.message}`);
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await toggleRule.mutateAsync({ id, isActive: !isActive });
      toast.success(isActive ? '规则已停用' : '规则已启用');
      getRules.refetch();
    } catch (error: any) {
      toast.error(`操作失败: ${error.message}`);
    }
  };

  const handleTest = async (rule: ExtractionRule) => {
    setEditingRule(rule);
    setTestContent('');
    setTestResult(null);
    setIsTestDialogOpen(true);
  };

  const handleRunTest = async () => {
    if (!testContent) return;
    // TODO: 实现测试功能，需要在后端添加测试API
    toast.info('测试功能待实现');
  };

  const addField = () => {
    setFormData({
      ...formData,
      fields: [...formData.fields, { name: '', type: 'string', description: '' }],
    });
  };

  const updateField = (index: number, field: Partial<FieldDefinition>) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], ...field };
    setFormData({ ...formData, fields: newFields });
  };

  const removeField = (index: number) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index),
    });
  };

  const exportRules = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'extraction-rules.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        for (const rule of imported) {
          await createRule.mutateAsync({
            name: rule.name,
            description: rule.description,
            ruleType: rule.ruleType,
            fields: rule.fields,
            prompt: rule.prompt,
            priority: rule.priority,
          });
        }
        toast.success(`成功导入 ${imported.length} 条规则`);
        getRules.refetch();
      } catch (error: any) {
        toast.error(`导入失败: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-tight">自定义提取规则</h2>
            <p className="text-muted-foreground">配置AI内容分析器的提取规则，支持自定义字段和提示词</p>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
             <div className="flex gap-1 bg-muted/20 p-1 rounded-lg border border-border/20">
              <Button variant="ghost" size="icon" onClick={exportRules} title="导出规则">
                <Download className="w-4 h-4" />
              </Button>
              <label className="cursor-pointer">
                <Button variant="ghost" size="icon" asChild title="导入规则">
                  <span>
                    <Upload className="w-4 h-4" />
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={importRules}
                />
              </label>
            </div>
            <Button onClick={handleCreate} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              创建规则
            </Button>
          </div>
        </div>

        {/* 规则模板库 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">规则模板库</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-border/40 bg-card/50 backdrop-blur-sm group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base group-hover:text-primary transition-colors">{template.name}</CardTitle>
                    <Badge variant="outline" className="bg-background/50">{template.ruleType}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[2.5em]">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    使用此模板
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 规则列表 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">我的规则</h3>
          </div>
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">规则名称</TableHead>
                    <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">类型</TableHead>
                    <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">描述</TableHead>
                    <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">优先级</TableHead>
                    <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">状态</TableHead>
                    <TableHead className="text-right pr-4 font-heading text-xs uppercase tracking-wider text-muted-foreground/70">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Box className="w-10 h-10 opacity-20" />
                          <p>暂无自定义规则</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id} className="group hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                        <TableCell className="font-medium group-hover:text-primary transition-colors">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-background/50 backdrop-blur-sm">{rule.ruleType}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">{rule.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">{rule.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={rule.isActive ? 'default' : 'secondary'}
                            className={rule.isActive ? 'bg-green-500 hover:bg-green-600' : ''}
                          >
                            {rule.isActive ? '启用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTest(rule)}
                              title="测试规则"
                            >
                              <Play className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(rule)}
                              title="编辑规则"
                            >
                              <Edit className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggle(rule.id, rule.isActive)}
                              title={rule.isActive ? '停用规则' : '启用规则'}
                            >
                              {rule.isActive ? (
                                <span className="text-xs font-bold text-muted-foreground hover:text-yellow-600">停</span>
                              ) : (
                                <span className="text-xs font-bold text-muted-foreground hover:text-green-600">启</span>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(rule.id)}
                              title="删除规则"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 编辑对话框 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b border-border/40">
              <DialogTitle>{editingRule ? '编辑规则' : '创建规则'}</DialogTitle>
              <DialogDescription>
                配置规则的基本信息、字段定义和提示词
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">规则名称</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如：人物外貌提取"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleType">规则类型</Label>
                    <Select
                      value={formData.ruleType}
                      onValueChange={(value) => setFormData({ ...formData, ruleType: value as 'custom' | 'character' | 'setting' | 'event' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">故事线事件</SelectItem>
                        <SelectItem value="character">角色信息</SelectItem>
                        <SelectItem value="setting">世界观设定</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="描述这个规则的用途..."
                    className="h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">优先级 (1-10)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">数值越高优先级越高，处理时会优先执行</span>
                  </div>
                </div>

                <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">字段定义</Label>
                    <Button size="sm" variant="outline" onClick={addField}>
                      <Plus className="w-4 h-4 mr-1" />
                      添加字段
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.fields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                        暂无字段定义，请添加字段
                      </div>
                    ) : (
                      formData.fields.map((field, index) => (
                        <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-card/50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex-1 grid grid-cols-12 gap-2">
                            <div className="col-span-4">
                              <Input
                                placeholder="字段名称 (key)"
                                value={field.name}
                                onChange={(e) => updateField(index, { name: e.target.value })}
                                className="h-8"
                              />
                            </div>
                            <div className="col-span-3">
                              <Select
                                value={field.type}
                                onValueChange={(value) => updateField(index, { type: value as any })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">文本 (String)</SelectItem>
                                  <SelectItem value="number">数字 (Number)</SelectItem>
                                  <SelectItem value="boolean">布尔 (Boolean)</SelectItem>
                                  <SelectItem value="array">数组 (Array)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-5">
                              <Input
                                placeholder="字段描述"
                                value={field.description}
                                onChange={(e) => updateField(index, { description: e.target.value })}
                                className="h-8"
                              />
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeField(index)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">提示词 (Prompt)</Label>
                  <Textarea
                    id="prompt"
                    rows={8}
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="请输入AI分析时使用的提示词，可以使用 {{content}} 作为输入内容的占位符..."
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>保存规则</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 测试对话框 */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b border-border/40">
              <DialogTitle>测试规则: {editingRule?.name}</DialogTitle>
              <DialogDescription>
                输入测试文本，查看规则提取结果
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 p-6 grid grid-cols-2 gap-6 min-h-[400px]">
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="testContent">测试文本</Label>
                <Textarea
                  id="testContent"
                  className="flex-1 resize-none"
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  placeholder="请输入要测试的文本内容..."
                />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>提取结果</Label>
                <div className="flex-1 border rounded-md bg-muted/50 p-4 font-mono text-xs overflow-auto">
                  {testResult ? (
                    <pre>{JSON.stringify(testResult, null, 2)}</pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      等待测试...
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
              <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                关闭
              </Button>
              <Button onClick={handleRunTest} disabled={!testContent}>
                <Play className="w-4 h-4 mr-2" />
                运行测试
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export default function ExtractionRules() {
  return (
    <DashboardLayout>
      <ExtractionRulesContent />
    </DashboardLayout>
  );
}
