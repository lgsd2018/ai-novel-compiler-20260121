import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Download, Eye, Palette, Layout, Type, BookOpen, Image as ImageIcon, FileText, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";

export default function ExportStyleEditor() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [previewMode, setPreviewMode] = useState<"cover" | "content">("cover");

  const [styleConfig, setStyleConfig] = useState({
    // Cover settings
    coverTitle: "",
    coverAuthor: "",
    coverBackground: "#1a1a2e",
    coverTitleColor: "#ffffff",
    coverImage: "",

    // Typography
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 1.8,
    paragraphSpacing: 1.5,

    // Page layout
    pageSize: "A4",
    marginTop: 25,
    marginBottom: 25,
    marginLeft: 30,
    marginRight: 30,

    // Header & Footer
    showPageNumber: true,
    showHeader: false,
    headerText: "",

    // Chapter styling
    chapterTitleSize: 20,
    chapterTitleAlign: "center",
    chapterStartNewPage: true,
  });

  const { data: project } = trpc.projects.get.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  // Auto-fill title from project if available and not set
  useEffect(() => {
    if (project?.title && !styleConfig.coverTitle) {
      setStyleConfig(prev => ({ ...prev, coverTitle: project.title }));
    }
  }, [project, styleConfig.coverTitle]);

  const exportMutation = trpc.exports.create.useMutation({
    onSuccess: () => {
      toast.success("导出任务已创建，请稍后在导出列表查看");
      setLocation(`/project/${projectId}/exports`);
    },
  });

  const handleExport = (format: "pdf" | "epub" | "word" | "html") => {
    exportMutation.mutate({
      projectId: Number(projectId),
      format,
      // TODO: Pass styleConfig to backend
    });
  };

  const handlePreview = () => {
    toast.info("预览功能开发中");
  };

  // Helper to get page dimensions style
  const getPageDimensions = () => {
    switch (styleConfig.pageSize) {
      case "A5": return { width: "148mm", height: "210mm", aspectRatio: "148/210" };
      case "B5": return { width: "176mm", height: "250mm", aspectRatio: "176/250" };
      case "letter": return { width: "216mm", height: "279mm", aspectRatio: "216/279" };
      case "A4":
      default: return { width: "210mm", height: "297mm", aspectRatio: "210/297" };
    }
  };

  const pageDims = getPageDimensions();

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation(`/project/${projectId}/exports`)} 
              className="hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
                导出样式定制
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  设计模式
                </span>
              </h2>
              <p className="text-muted-foreground text-sm">自定义导出文档的排版、封面和样式</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreview} className="shadow-sm hover:shadow-md transition-all">
              <Eye className="w-4 h-4 mr-2" />
              预览效果
            </Button>
            <Button onClick={() => handleExport("pdf")} className="shadow-sm hover:shadow-md transition-all bg-gradient-to-r from-primary to-primary/90 hover:to-primary">
              <Download className="w-4 h-4 mr-2" />
              导出 PDF
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Settings Panel */}
          <div className="lg:col-span-2 flex flex-col min-h-0 overflow-y-auto pr-2 custom-scrollbar">
            <Tabs defaultValue="cover" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1 rounded-xl border border-border/50">
                <TabsTrigger value="cover" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                  <ImageIcon className="w-4 h-4 mr-2" />封面
                </TabsTrigger>
                <TabsTrigger value="typography" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                  <Type className="w-4 h-4 mr-2" />排版
                </TabsTrigger>
                <TabsTrigger value="layout" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                  <Layout className="w-4 h-4 mr-2" />页面
                </TabsTrigger>
                <TabsTrigger value="chapter" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                  <BookOpen className="w-4 h-4 mr-2" />章节
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <TabsContent value="cover" className="space-y-6 mt-6 focus-visible:outline-none">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          封面设计
                        </CardTitle>
                        <CardDescription>设置导出文档的封面样式</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>书名</Label>
                            <Input
                              value={styleConfig.coverTitle}
                              onChange={(e) => setStyleConfig({ ...styleConfig, coverTitle: e.target.value })}
                              placeholder={project?.title || "输入书名"}
                              className="bg-background/50 focus:bg-background transition-colors"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>作者</Label>
                            <Input
                              value={styleConfig.coverAuthor}
                              onChange={(e) => setStyleConfig({ ...styleConfig, coverAuthor: e.target.value })}
                              placeholder="输入作者名"
                              className="bg-background/50 focus:bg-background transition-colors"
                            />
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>背景颜色</Label>
                            <div className="flex gap-2">
                              <div className="relative w-12 h-10 overflow-hidden rounded-md border border-input shadow-sm hover:ring-2 hover:ring-ring/20 transition-all">
                                <input
                                  type="color"
                                  value={styleConfig.coverBackground}
                                  onChange={(e) => setStyleConfig({ ...styleConfig, coverBackground: e.target.value })}
                                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                                />
                              </div>
                              <Input
                                value={styleConfig.coverBackground}
                                onChange={(e) => setStyleConfig({ ...styleConfig, coverBackground: e.target.value })}
                                placeholder="#1a1a2e"
                                className="bg-background/50 font-mono"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>标题颜色</Label>
                            <div className="flex gap-2">
                              <div className="relative w-12 h-10 overflow-hidden rounded-md border border-input shadow-sm hover:ring-2 hover:ring-ring/20 transition-all">
                                <input
                                  type="color"
                                  value={styleConfig.coverTitleColor}
                                  onChange={(e) => setStyleConfig({ ...styleConfig, coverTitleColor: e.target.value })}
                                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                                />
                              </div>
                              <Input
                                value={styleConfig.coverTitleColor}
                                onChange={(e) => setStyleConfig({ ...styleConfig, coverTitleColor: e.target.value })}
                                placeholder="#ffffff"
                                className="bg-background/50 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>封面图片 URL (可选)</Label>
                          <Input
                            value={styleConfig.coverImage}
                            onChange={(e) => setStyleConfig({ ...styleConfig, coverImage: e.target.value })}
                            placeholder="https://example.com/cover.jpg"
                            className="bg-background/50 focus:bg-background transition-colors"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                <TabsContent value="typography" className="space-y-6 mt-6 focus-visible:outline-none">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <Type className="w-5 h-5" />
                          </div>
                          字体与排版
                        </CardTitle>
                        <CardDescription>设置正文内容的字体和间距</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>字体选择</Label>
                          <Select
                            value={styleConfig.fontFamily}
                            onValueChange={(v) => setStyleConfig({ ...styleConfig, fontFamily: v })}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="serif">宋体 (Serif)</SelectItem>
                              <SelectItem value="sans-serif">黑体 (Sans-serif)</SelectItem>
                              <SelectItem value="monospace">等宽 (Monospace)</SelectItem>
                              <SelectItem value="cursive">楷体 (Cursive)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-6 pt-2">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>字号</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.fontSize}pt</span>
                            </div>
                            <Slider
                              value={[styleConfig.fontSize]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, fontSize: v })}
                              min={10}
                              max={20}
                              step={1}
                              className="py-2"
                            />
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>行距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.lineHeight}</span>
                            </div>
                            <Slider
                              value={[styleConfig.lineHeight]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, lineHeight: v })}
                              min={1.2}
                              max={2.5}
                              step={0.1}
                              className="py-2"
                            />
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>段落间距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.paragraphSpacing}em</span>
                            </div>
                            <Slider
                              value={[styleConfig.paragraphSpacing]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, paragraphSpacing: v })}
                              min={0.5}
                              max={3}
                              step={0.1}
                              className="py-2"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                <TabsContent value="layout" className="space-y-6 mt-6 focus-visible:outline-none">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <Layout className="w-5 h-5" />
                          </div>
                          页面布局
                        </CardTitle>
                        <CardDescription>设置页面尺寸和边距</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>页面尺寸</Label>
                          <Select
                            value={styleConfig.pageSize}
                            onValueChange={(v) => setStyleConfig({ ...styleConfig, pageSize: v })}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                              <SelectItem value="A5">A5 (148×210mm)</SelectItem>
                              <SelectItem value="B5">B5 (176×250mm)</SelectItem>
                              <SelectItem value="letter">Letter (216×279mm)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-2">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>上边距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.marginTop}mm</span>
                            </div>
                            <Slider
                              value={[styleConfig.marginTop]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, marginTop: v })}
                              min={10}
                              max={50}
                              step={5}
                              className="py-2"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>下边距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.marginBottom}mm</span>
                            </div>
                            <Slider
                              value={[styleConfig.marginBottom]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, marginBottom: v })}
                              min={10}
                              max={50}
                              step={5}
                              className="py-2"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>左边距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.marginLeft}mm</span>
                            </div>
                            <Slider
                              value={[styleConfig.marginLeft]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, marginLeft: v })}
                              min={15}
                              max={60}
                              step={5}
                              className="py-2"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>右边距</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.marginRight}mm</span>
                            </div>
                            <Slider
                              value={[styleConfig.marginRight]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, marginRight: v })}
                              min={15}
                              max={60}
                              step={5}
                              className="py-2"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                          <input
                            type="checkbox"
                            id="show-page-number"
                            checked={styleConfig.showPageNumber}
                            onChange={(e) => setStyleConfig({ ...styleConfig, showPageNumber: e.target.checked })}
                            className="rounded border-input bg-background/50 accent-primary w-4 h-4"
                          />
                          <Label htmlFor="show-page-number" className="cursor-pointer font-medium">
                            显示页码
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                <TabsContent value="chapter" className="space-y-6 mt-6 focus-visible:outline-none">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          章节样式
                        </CardTitle>
                        <CardDescription>设置章节标题的样式和行为</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label>章节标题字号</Label>
                              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{styleConfig.chapterTitleSize}pt</span>
                            </div>
                            <Slider
                              value={[styleConfig.chapterTitleSize]}
                              onValueChange={([v]) => setStyleConfig({ ...styleConfig, chapterTitleSize: v })}
                              min={14}
                              max={32}
                              step={2}
                              className="py-2"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>章节标题对齐</Label>
                            <Select
                              value={styleConfig.chapterTitleAlign}
                              onValueChange={(v) => setStyleConfig({ ...styleConfig, chapterTitleAlign: v })}
                            >
                              <SelectTrigger className="bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">左对齐</SelectItem>
                                <SelectItem value="center">居中</SelectItem>
                                <SelectItem value="right">右对齐</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                            <input
                              type="checkbox"
                              id="chapter-new-page"
                              checked={styleConfig.chapterStartNewPage}
                              onChange={(e) => setStyleConfig({ ...styleConfig, chapterStartNewPage: e.target.checked })}
                              className="rounded border-input bg-background/50 accent-primary w-4 h-4"
                            />
                            <Label htmlFor="chapter-new-page" className="cursor-pointer font-medium">
                              每章从新页开始
                            </Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </AnimatePresence>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1 flex flex-col min-h-0">
            <div className="sticky top-6 space-y-4">
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col h-full max-h-[calc(100vh-12rem)]">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Eye className="w-5 h-5 text-primary" />
                      实时预览
                    </CardTitle>
                    <ToggleGroup 
                      type="single" 
                      value={previewMode} 
                      onValueChange={(v) => v && setPreviewMode(v as "cover" | "content")}
                      className="scale-90 origin-right"
                    >
                      <ToggleGroupItem value="cover" aria-label="Cover Preview">
                        <ImageIcon className="h-4 w-4 mr-2" /> 封面
                      </ToggleGroupItem>
                      <ToggleGroupItem value="content" aria-label="Content Preview">
                        <FileText className="h-4 w-4 mr-2" /> 正文
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 bg-muted/20 p-6 flex items-center justify-center overflow-auto custom-scrollbar">
                  <AnimatePresence mode="wait">
                    {previewMode === "cover" ? (
                      <motion.div
                        key="cover-preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="relative bg-white dark:bg-zinc-900 shadow-2xl rounded-sm overflow-hidden transition-all duration-300"
                        style={{
                          aspectRatio: pageDims.aspectRatio,
                          height: "min(60vh, 500px)",
                          fontFamily: styleConfig.fontFamily,
                        }}
                      >
                        <div
                          className="h-full w-full flex flex-col items-center justify-center p-8 transition-colors duration-300 relative"
                          style={{
                            backgroundColor: styleConfig.coverBackground,
                            color: styleConfig.coverTitleColor,
                          }}
                        >
                          {/* Decorative border if no image */}
                          {!styleConfig.coverImage && (
                            <div className="absolute inset-6 border-4 border-current opacity-20" />
                          )}
                          
                          {styleConfig.coverImage && (
                            <img 
                              src={styleConfig.coverImage} 
                              alt="Cover" 
                              className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
                            />
                          )}

                          <div className="z-10 text-center space-y-6 max-w-full">
                            <h1 
                              className="font-bold tracking-wide break-words leading-tight"
                              style={{ fontSize: "2rem" }}
                            >
                              {styleConfig.coverTitle || project?.title || "书名"}
                            </h1>
                            <div className="w-16 h-1 bg-current mx-auto opacity-60" />
                            <p className="text-lg opacity-90 font-medium tracking-widest uppercase">
                              {styleConfig.coverAuthor || "作者"}
                            </p>
                          </div>
                          
                          <div className="absolute bottom-8 text-xs opacity-50 uppercase tracking-[0.2em]">
                            AI Novel Compiler Edition
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="content-preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="relative bg-white text-black shadow-2xl rounded-sm overflow-hidden transition-all duration-300"
                        style={{
                          aspectRatio: pageDims.aspectRatio,
                          height: "min(60vh, 500px)",
                          fontFamily: styleConfig.fontFamily === "serif" ? '"Songti SC", "SimSun", serif' : 
                                      styleConfig.fontFamily === "sans-serif" ? '"PingFang SC", "Microsoft YaHei", sans-serif' : 
                                      styleConfig.fontFamily === "monospace" ? '"Courier New", monospace' : "cursive",
                        }}
                      >
                        <div 
                          className="h-full w-full relative overflow-hidden flex flex-col"
                          style={{
                            paddingTop: `${styleConfig.marginTop / 3}mm`, // Scale down for preview
                            paddingBottom: `${styleConfig.marginBottom / 3}mm`,
                            paddingLeft: `${styleConfig.marginLeft / 3}mm`,
                            paddingRight: `${styleConfig.marginRight / 3}mm`,
                          }}
                        >
                          {/* Header Placeholder */}
                          {styleConfig.showHeader && (
                            <div className="absolute top-2 left-0 right-0 text-[8px] text-gray-400 text-center border-b border-gray-100 mx-8 pb-1">
                              {styleConfig.headerText || styleConfig.coverTitle || "页眉内容"}
                            </div>
                          )}

                          <div className="flex-1 overflow-hidden">
                            <h2 
                              className="font-bold mb-4"
                              style={{
                                fontSize: `${styleConfig.chapterTitleSize * 0.8}px`, // Scale down
                                textAlign: styleConfig.chapterTitleAlign as any,
                              }}
                            >
                              第一章 开始
                            </h2>
                            
                            <div 
                              className="text-justify text-gray-800"
                              style={{
                                fontSize: `${styleConfig.fontSize * 0.8}px`, // Scale down
                                lineHeight: styleConfig.lineHeight,
                              }}
                            >
                              <p style={{ marginBottom: `${styleConfig.paragraphSpacing}em`, textIndent: "2em" }}>
                                这是一个示例文本，用于展示导出文档的排版效果。您可以在左侧面板中调整字体、字号、行距和页边距等设置，实时查看变化。
                              </p>
                              <p style={{ marginBottom: `${styleConfig.paragraphSpacing}em`, textIndent: "2em" }}>
                                此时此刻，阳光正好，微风不噪。故事的主角正站在命运的十字路口，准备开启一段全新的旅程。
                              </p>
                              <p style={{ marginBottom: `${styleConfig.paragraphSpacing}em`, textIndent: "2em" }}>
                                无论前路如何崎岖，心中的信念始终如灯塔般指引着方向。在这个充满无限可能的世界里，每一个选择都将谱写出不同的篇章。
                              </p>
                              <p style={{ marginBottom: `${styleConfig.paragraphSpacing}em`, textIndent: "2em" }}>
                                (此处省略一万字...)
                              </p>
                            </div>
                          </div>

                          {/* Footer / Page Number */}
                          {styleConfig.showPageNumber && (
                            <div className="absolute bottom-2 left-0 right-0 text-[8px] text-gray-400 text-center">
                              - 1 -
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      * 预览缩放比例: ~33%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
