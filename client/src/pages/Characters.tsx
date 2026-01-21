import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CharacterRelationshipGraph from "@/components/CharacterRelationshipGraph";
import { ArrowLeft, Plus, User, Home, Users, Search, Filter, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";

export default function Characters() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    appearance: "",
    personality: "",
    background: "",
    role: "",
  });

  const { data: characters, refetch } = trpc.characters.list.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  const createMutation = trpc.characters.create.useMutation({
    onSuccess: () => {
      toast.success("角色创建成功");
      setIsCreateDialogOpen(false);
      setNewCharacter({ name: "", appearance: "", personality: "", background: "", role: "" });
      refetch();
    },
  });

  const handleCreate = () => {
    if (!newCharacter.name.trim()) {
      toast.error("请输入角色名称");
      return;
    }
    createMutation.mutate({
      projectId: Number(projectId),
      ...newCharacter,
    });
  };

  return (
    <DashboardLayout mainClassName="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex flex-col h-full gap-6">
        {/* Header Section */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/project/${projectId}`)} className="hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold font-heading tracking-tight">角色管理</h2>
              <p className="text-muted-foreground">创建和管理故事中的角色及其关系</p>
            </div>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                新建角色
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建新角色</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="char-name">角色名称</Label>
                      <Input
                        id="char-name"
                        value={newCharacter.name}
                        onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                        placeholder="例如：林凡"
                        className="bg-muted/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="char-role">角色定位</Label>
                      <Input
                        id="char-role"
                        value={newCharacter.role}
                        onChange={(e) => setNewCharacter({ ...newCharacter, role: e.target.value })}
                        placeholder="例如：主角 / 反派"
                        className="bg-muted/30"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="char-appearance">外貌特征</Label>
                  <Textarea
                    id="char-appearance"
                    value={newCharacter.appearance}
                    onChange={(e) => setNewCharacter({ ...newCharacter, appearance: e.target.value })}
                    placeholder="身材、五官、衣着..."
                    rows={4}
                    className="bg-muted/30 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="char-personality">性格特点</Label>
                  <Textarea
                    id="char-personality"
                    value={newCharacter.personality}
                    onChange={(e) => setNewCharacter({ ...newCharacter, personality: e.target.value })}
                    placeholder="优点、缺点、口头禅..."
                    rows={4}
                    className="bg-muted/30 resize-none"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="char-background">背景故事</Label>
                  <Textarea
                    id="char-background"
                    value={newCharacter.background}
                    onChange={(e) => setNewCharacter({ ...newCharacter, background: e.target.value })}
                    placeholder="角色的身世、经历、目标..."
                    rows={4}
                    className="bg-muted/30 resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full sm:w-auto">
                  {createMutation.isPending ? "创建中..." : "创建角色"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="list" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="list" className="px-6">列表视图</TabsTrigger>
              <TabsTrigger value="graph" className="px-6">关系图谱</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索角色..." className="pl-9 h-9 bg-muted/30 border-border/50" />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <TabsContent value="graph" className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden shadow-sm mt-0 relative">
             {/* Add a container for the graph to ensure it takes full height */}
             <div className="absolute inset-0">
                <CharacterRelationshipGraph projectId={Number(projectId)} />
             </div>
          </TabsContent>

          <TabsContent value="list" className="flex-1 min-h-0 overflow-auto pr-2 mt-0 custom-scrollbar">
            {characters && characters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                {characters.map((character) => (
                  <Card key={character.id} className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/50 bg-card hover:border-primary/20 hover:-translate-y-1 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-primary/20 to-primary/5 group-hover:from-primary group-hover:to-primary/60 transition-all duration-500" />
                    <CardHeader className="pb-3 pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-heading tracking-tight">{character.name}</CardTitle>
                            {character.role && (
                              <span className="text-[10px] font-medium text-primary/80 uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-full mt-1 inline-block border border-primary/10">
                                {character.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      {character.appearance && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-primary/40" /> 外貌
                          </p>
                          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed pl-2 border-l-2 border-border/50">
                            {character.appearance}
                          </p>
                        </div>
                      )}
                      {character.personality && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-primary/40" /> 性格
                          </p>
                          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed pl-2 border-l-2 border-border/50">
                            {character.personality}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {/* Add Card Button */}
                <button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all duration-300 min-h-[200px] group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-border/50">
                    <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">创建新角色</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping opacity-20" />
                  <Users className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <div className="space-y-2 max-w-sm mx-auto">
                  <h3 className="text-xl font-heading font-semibold text-foreground">还没有角色</h3>
                  <p className="text-sm text-muted-foreground">
                    角色是故事的灵魂。创建您的第一个角色，开始构建故事的人物关系网。
                  </p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)} size="lg" className="shadow-xl shadow-primary/20">
                  <Plus className="w-5 h-5 mr-2" />
                  新建角色
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
