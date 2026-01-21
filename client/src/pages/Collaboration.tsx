import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, Plus, Users, Trash2, Shield, Eye, Edit, UserPlus, Mail, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Collaboration() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "owner">("editor");

  const { data: members, refetch } = trpc.collaboration.listCollaborators.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  const inviteMutation = trpc.collaboration.addCollaborator.useMutation({
    onSuccess: () => {
      toast.success("邀请已发送");
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      refetch();
    },
  });

  const removeMutation = trpc.collaboration.removeCollaborator.useMutation({
    onSuccess: () => {
      toast.success("成员已移除");
      refetch();
    },
  });

  // Role update functionality (not implemented in backend yet)
  const updateRoleMutation = { mutate: () => {} } as any;

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("请输入邮箱地址");
      return;
    }
    // For demo purposes, using userId 1
    // In production, you'd look up the user by email first
    inviteMutation.mutate({
      projectId: Number(projectId),
      userId: 1, // TODO: lookup user by email
      role: inviteRole,
    });
  };

  const handleRemove = (memberId: number) => {
    if (confirm("确定要移除这个成员吗？")) {
      removeMutation.mutate({ collaboratorId: memberId });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
      case "owner":
        return <Shield className="w-4 h-4 text-red-500" />;
      case "editor":
        return <Edit className="w-4 h-4 text-blue-500" />;
      case "viewer":
        return <Eye className="w-4 h-4 text-green-500" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin":
      case "owner":
        return "管理员";
      case "editor":
        return "编辑者";
      case "viewer":
        return "查看者";
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
      case "owner":
        return "destructive";
      case "editor":
        return "default";
      case "viewer":
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
              <h2 className="text-2xl font-bold font-heading tracking-tight">协作管理</h2>
              <p className="text-muted-foreground">管理项目成员及其权限</p>
            </div>
          </div>
          
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <UserPlus className="w-4 h-4 mr-2" />
                邀请成员
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl">
              <DialogHeader>
                <DialogTitle className="font-heading">邀请协作成员</DialogTitle>
                <DialogDescription>输入成员邮箱并设置权限，受邀者将收到通知</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@example.com"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>权限角色</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-green-500" />
                          <span>查看者 - 只能查看</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="editor">
                        <div className="flex items-center gap-2">
                          <Edit className="w-4 h-4 text-blue-500" />
                          <span>编辑者 - 可以编辑</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-500" />
                          <span>管理员 - 完全控制</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>取消</Button>
                <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "发送中..." : "发送邀请"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Members List */}
        {members && members.length > 0 ? (
          <div className="grid gap-4">
            {members.map((member: any) => (
              <Card key={member.id} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarImage src={`https://avatar.vercel.sh/${member.userEmail}`} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.userName?.[0] || member.userEmail?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {member.userName || "未知用户"}
                          {member.role === "owner" && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/20">所有者</Badge>}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.userEmail || "无邮箱"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground hidden md:flex">
                        <Calendar className="w-3.5 h-3.5" />
                        加入于 {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                      <Badge variant="secondary" className="px-3 py-1 flex items-center gap-1.5 bg-background/50 border border-border/50">
                        {getRoleIcon(member.role)}
                        <span>{getRoleText(member.role)}</span>
                      </Badge>
                      
                      {member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(member.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="移除成员"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">还没有协作成员</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                邀请团队成员加入项目，共同完成创作
              </p>
              <Button onClick={() => setIsInviteDialogOpen(true)} variant="outline" className="shadow-sm">
                <UserPlus className="w-4 h-4 mr-2" />
                邀请第一位成员
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
