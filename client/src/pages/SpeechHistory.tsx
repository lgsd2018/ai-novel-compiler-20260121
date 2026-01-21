import { useState } from "react";
import { trpc } from "../lib/trpc";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Play, Pause, Edit, Trash2, Clock, FileAudio, Mic, BarChart3, Activity, Globe, Zap, Box } from "lucide-react";
import { PAGE_DIALOG_CLASSNAME } from "@/const";
import { useLocation } from "wouter";

export function SpeechHistoryContent() {
  const [, setLocation] = useLocation();
  const [searchText, setSearchText] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch speech history
  const { data: historyList, isLoading, refetch } = trpc.speechHistory.list.useQuery({
    searchText: searchText || undefined,
    limit: 100,
  });

  // Fetch stats
  const { data: stats } = trpc.speechHistory.stats.useQuery();

  // Update mutation
  const updateMutation = trpc.speechHistory.update.useMutation({
    onSuccess: () => {
      toast.success("转录文本已更新");
      setIsEditDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.speechHistory.delete.useMutation({
    onSuccess: () => {
      toast.success("历史记录已删除");
      refetch();
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const handleEdit = (history: any) => {
    setSelectedHistory(history);
    setEditedTranscript(history.transcript);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedHistory) return;
    updateMutation.mutate({
      id: selectedHistory.id,
      transcript: editedTranscript,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这条历史记录吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handlePlayAudio = (history: any) => {
    if (!history.audioUrl) {
      toast.error("没有可播放的音频");
      return;
    }

    if (isPlaying === history.id) {
      // Pause
      audioElement?.pause();
      setIsPlaying(null);
    } else {
      // Stop previous audio
      audioElement?.pause();
      
      // Play new audio
      const audio = new Audio(history.audioUrl);
      audio.play();
      setAudioElement(audio);
      setIsPlaying(history.id);

      audio.onended = () => {
        setIsPlaying(null);
      };
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "未知";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      zh: "中文",
      en: "英文",
      ja: "日文",
      ko: "韩文",
    };
    return languages[code] || code;
  };

  const getTypeLabel = (type: string) => {
    return type === "file" ? "文件上传" : "实时识别";
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
        {/* Header & Stats */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-tight">语音识别历史</h2>
            <p className="text-muted-foreground">查看和管理所有的语音转文字记录</p>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    总记录数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{stats.totalCount}</div>
                </CardContent>
              </Card>
              
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    总时长
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{formatDuration(stats.totalDuration)}</div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-green-500" />
                    语言分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.byLanguage).map(([lang, count]) => (
                      <Badge key={lang} variant="secondary" className="text-xs bg-background/80">
                        {getLanguageName(lang)}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    类型分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <Badge key={type} variant="secondary" className="text-xs bg-background/80">
                        {getTypeLabel(type)}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Search & Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索转录文本..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 bg-background/50 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* History List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-border/40 bg-card/50">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : historyList && historyList.length > 0 ? (
          <div className="grid gap-4">
            {historyList.map((history: any) => (
              <Card key={history.id} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          variant={history.recognitionType === "file" ? "default" : "secondary"}
                          className={history.recognitionType === "file" ? "bg-primary/90 hover:bg-primary" : "bg-muted hover:bg-muted/80"}
                        >
                          {getTypeLabel(history.recognitionType)}
                        </Badge>
                        <Badge variant="outline" className="bg-background/50">{getLanguageName(history.language)}</Badge>
                        {history.confidence && (
                          <Badge 
                            variant="outline" 
                            className={`bg-background/50 ${
                              parseFloat(history.confidence) > 0.8 ? 'text-green-600 border-green-200 dark:border-green-900/30' : ''
                            }`}
                          >
                            置信度: {(parseFloat(history.confidence) * 100).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(history.createdAt).toLocaleString()}
                        </span>
                        {history.audioDuration && (
                          <span className="flex items-center gap-1">
                            <FileAudio className="w-3.5 h-3.5" />
                            {formatDuration(history.audioDuration)}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {history.audioUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePlayAudio(history)}
                          className={isPlaying === history.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}
                        >
                          {isPlaying === history.id ? (
                            <Pause className="w-4 h-4 mr-1" />
                          ) : (
                            <Play className="w-4 h-4 mr-1" />
                          )}
                          {isPlaying === history.id ? "暂停" : "播放"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(history)}
                        className="text-muted-foreground hover:text-primary"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(history.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/20 text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90">
                    {history.transcript}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Mic className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">暂无语音识别记录</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                使用语音输入或上传音频文件后，这里将显示识别结果和历史记录
              </p>
            </CardContent>
          </Card>
        )}
      </div>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>编辑转录文本</DialogTitle>
                  <DialogDescription>
                    修改语音识别的转录文本内容
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={10}
                    placeholder="输入转录文本..."
                    className="font-mono text-sm leading-relaxed"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "保存中..." : "保存"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function SpeechHistory() {
  return (
    <DashboardLayout>
      <SpeechHistoryContent />
    </DashboardLayout>
  );
}
