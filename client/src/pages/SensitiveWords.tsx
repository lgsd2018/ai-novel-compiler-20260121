import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Plus, Search, Settings, Shield, Trash2, Upload } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PAGE_DIALOG_CLASSNAME } from "@/const";
import { useLocation } from "wouter";
export function SensitiveWordsContent() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    word: "",
    category: "",
    isRegex: false,
    severity: "medium" as "low" | "medium" | "high",
    replacement: "",
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: words = [], isLoading } = trpc.sensitiveWords.list.useQuery({
    category: selectedCategory,
    search: searchTerm || undefined,
  });

  const { data: categories = [] } = trpc.sensitiveWords.getCategories.useQuery();

  // Mutations
  const createMutation = trpc.sensitiveWords.create.useMutation({
    onSuccess: () => {
      utils.sensitiveWords.list.invalidate();
      utils.sensitiveWords.getCategories.invalidate();
      toast.success("敏感词添加成功");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`添加失败：${error.message}`);
    },
  });

  const updateMutation = trpc.sensitiveWords.update.useMutation({
    onSuccess: () => {
      utils.sensitiveWords.list.invalidate();
      toast.success("敏感词更新成功");
      setEditingWord(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const deleteMutation = trpc.sensitiveWords.delete.useMutation({
    onSuccess: () => {
      utils.sensitiveWords.list.invalidate();
      utils.sensitiveWords.getCategories.invalidate();
      toast.success("敏感词删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败：${error.message}`);
    },
  });

  const bulkDeleteMutation = trpc.sensitiveWords.bulkDelete.useMutation({
    onSuccess: () => {
      utils.sensitiveWords.list.invalidate();
      utils.sensitiveWords.getCategories.invalidate();
      toast.success("批量删除成功");
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(`批量删除失败：${error.message}`);
    },
  });

  const bulkImportMutation = trpc.sensitiveWords.bulkImport.useMutation({
    onSuccess: (data) => {
      utils.sensitiveWords.list.invalidate();
      utils.sensitiveWords.getCategories.invalidate();
      toast.success(`成功导入 ${data.count} 个敏感词`);
      setIsImportDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`导入失败：${error.message}`);
    },
  });

  const importStandardMutation = trpc.sensitiveWords.importStandard.useMutation({
    onSuccess: (data) => {
      utils.sensitiveWords.list.invalidate();
      utils.sensitiveWords.getCategories.invalidate();
      toast.success(`标配词库导入完成：新增 ${data.inserted} 个，跳过 ${data.skipped} 个`);
    },
    onError: (error) => {
      toast.error(`标配词库导入失败：${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      word: "",
      category: "",
      isRegex: false,
      severity: "medium",
      replacement: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.word || !formData.category) {
      toast.error("请填写必填字段");
      return;
    }

    if (editingWord) {
      updateMutation.mutate({
        id: editingWord.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (word: any) => {
    setEditingWord(word);
    setFormData({
      word: word.word,
      category: word.category,
      isRegex: word.isRegex || false,
      severity: word.severity || "medium",
      replacement: word.replacement || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个敏感词吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.error("请先选择要删除的敏感词");
      return;
    }
    if (confirm(`确定要删除选中的 ${selectedIds.length} 个敏感词吗？`)) {
      bulkDeleteMutation.mutate({ ids: selectedIds });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(words, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sensitive-words-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (!Array.isArray(data)) {
          toast.error("文件格式错误：应为数组");
          return;
        }

        const words = data.map((item: any) => ({
          word: item.word,
          category: item.category,
          isRegex: item.isRegex || false,
          severity: item.severity || "medium",
          replacement: item.replacement || undefined,
        }));

        bulkImportMutation.mutate({ words });
      } catch (error) {
        toast.error("文件解析失败");
      }
    };
    reader.readAsText(file);
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === words.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(words.map(w => w.id));
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
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
          <div className="space-y-6 p-6">
        {/* 页面标题与概览 */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">敏感词库</h1>
            <p className="text-muted-foreground mt-2 text-lg">统一管理敏感词、分类与替换规则</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="h-8 px-3 text-sm">总词条：{words.length}</Badge>
            <Badge variant="outline" className="h-8 px-3 text-sm">分类数：{categories.length}</Badge>
          </div>
        </div>
        {/* 工具栏 */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto] items-start">
          {/* 搜索与筛选区域 */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
            <div className="relative flex-1 min-w-0 md:min-w-[360px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索敏感词..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 bg-background/80 backdrop-blur-sm h-12 text-lg border-2 border-border/60 focus-visible:border-primary"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[220px] bg-background/80 backdrop-blur-sm h-12 border-2 border-border/60 focus-visible:border-primary">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 操作按钮区域 */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="shadow-sm">
                <Trash2 className="w-4 h-4 mr-2" />
                删除选中 ({selectedIds.length})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!confirm("确定导入标配敏感词库吗？将自动跳过已存在的词条。")) return;
                importStandardMutation.mutate();
              }}
              disabled={importStandardMutation.isPending}
              className="shadow-sm hover:bg-muted/50"
            >
              <Shield className="w-4 h-4 mr-2" />
              标配词库
            </Button>

            <div className="flex gap-1 bg-muted/20 p-1 rounded-lg border border-border/20">
              <Button variant="ghost" size="icon" onClick={() => setIsImportDialogOpen(true)} title="导入">
                <Upload className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleExport} title="导出">
                <Download className="w-4 h-4" />
              </Button>
            </div>

            <Button 
              onClick={() => {
                setEditingWord(null);
                resetForm();
                setIsAddDialogOpen(true);
              }}
              className="shadow-sm"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加敏感词
            </Button>
          </div>
        </div>

        {/* 表格 */}
        <div className="border rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm shadow-sm hover:border-primary/20 transition-all duration-300">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-muted/30 border-b border-border/40">
                <TableHead className="w-12 pl-4">
                  <Checkbox
                    checked={words.length > 0 && selectedIds.length === words.length}
                    onCheckedChange={toggleSelectAll}
                    className="translate-y-[2px]"
                  />
                </TableHead>
                <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">敏感词</TableHead>
                <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">分类</TableHead>
                <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">严重程度</TableHead>
                <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">正则</TableHead>
                <TableHead className="font-heading text-xs uppercase tracking-wider text-muted-foreground/70">替换词</TableHead>
                <TableHead className="text-right pr-4 font-heading text-xs uppercase tracking-wider text-muted-foreground/70">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p>加载中...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : words.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Settings className="w-10 h-10 opacity-20" />
                      <p>暂无敏感词数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                words.map((word) => (
                  <TableRow key={word.id} className="group hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.includes(word.id)}
                        onCheckedChange={() => toggleSelection(word.id)}
                        className="translate-y-[2px]"
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium text-base group-hover:text-primary transition-colors">{word.word}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background/50 backdrop-blur-sm">{word.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(word.severity)} className="border-0 ring-1 ring-inset ring-white/20 shadow-sm">
                        {word.severity === "high" ? "高" : word.severity === "medium" ? "中" : "低"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {word.isRegex ? <Badge variant="secondary" className="font-mono text-xs">REGEX</Badge> : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {word.replacement || <span className="opacity-30">-</span>}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(word)}
                          className="h-8 px-2 text-muted-foreground hover:text-primary"
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(word.id)}
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingWord ? "编辑敏感词" : "添加敏感词"}</DialogTitle>
              <DialogDescription>
                {editingWord ? "修改敏感词信息" : "添加新的敏感词到词库"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="word">敏感词 *</Label>
                <Input
                  id="word"
                  value={formData.word}
                  onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                  placeholder="输入敏感词"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">分类 *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="如：政治、色情、暴力等"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">严重程度</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: "low" | "medium" | "high") =>
                    setFormData({ ...formData, severity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRegex"
                  checked={formData.isRegex}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isRegex: checked as boolean })
                  }
                />
                <Label htmlFor="isRegex" className="cursor-pointer">
                  使用正则表达式匹配
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replacement">替换词（可选）</Label>
                <Input
                  id="replacement"
                  value={formData.replacement}
                  onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                  placeholder="用于替换敏感词的文本"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingWord ? "更新" : "添加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导入敏感词</DialogTitle>
              <DialogDescription>
                从JSON文件导入敏感词库
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">选择文件</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>文件格式示例：</p>
                <pre className="bg-muted p-2 rounded mt-2 text-xs overflow-auto">
{`[
  {
    "word": "示例词",
    "category": "分类",
    "isRegex": false,
    "severity": "medium",
    "replacement": "替换词"
  }
]`}
                </pre>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function SensitiveWords() {
  return (
    <DashboardLayout>
      <SensitiveWordsContent />
    </DashboardLayout>
  );
}
