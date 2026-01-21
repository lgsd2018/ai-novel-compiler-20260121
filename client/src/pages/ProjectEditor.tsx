import { useAuth } from "@/_core/hooks/useAuth";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { StreamingVoiceRecorder } from "@/components/StreamingVoiceRecorder";
import { RichTextEditor, plainTextToHtml, RichTextEditorRef } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { useParams, useLocation } from "wouter";
import {
  BookOpen, ChevronRight, ChevronDown, File, Folder, Plus, Save,
  Sparkles, Users, GitBranch, Settings, Home, MoreVertical, Trash2, Download, Maximize2, Minimize2, Globe,
  Mic, Volume2, PanelLeft, PanelRight, ArrowLeft, PenTool, Loader2
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAIStream } from "@/hooks/useAIStream";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Diff } from "@/lib/diff-utils";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AgentAuditLogDialog } from '@/components/AgentAuditLogDialog';
import { TopBar } from "@/components/editor/TopBar";
import { ActivityBar, ActivityType } from "@/components/editor/ActivityBar";
import { SideBar, DocumentItem } from "@/components/editor/SideBar";
import { AIPanel } from "@/components/editor/AIPanel";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { useRecentProjects } from "@/hooks/useRecentProjects";

// Removed local DocumentItem definition to use imported one from SideBar

export default function ProjectEditor() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDocDialogOpen, setIsCreateDocDialogOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<"chapter" | "setting" | "outline" | "worldview" | "folder">("chapter");
  const [newDocParentId, setNewDocParentId] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [useStreamingRecognition, setUseStreamingRecognition] = useState(false);
  const [useMultiAgent, setUseMultiAgent] = useState(true);
  const [aiParams, setAiParams] = useState({
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2000,
  });
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // Chat / Agent State
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "system", content: "我是你的AI助手。" }
  ]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMode, setAiChatMode] = useState<'chat' | 'agent'>('chat');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDraft, setSendDraft] = useState("");
  const [sendTarget, setSendTarget] = useState<{
    folderPath: string;
    folderIds: number[];
  } | null>(null);
  const [agentAction, setAgentAction] = useState<any>(null);
  const [isAgentConfirmationOpen, setIsAgentConfirmationOpen] = useState(false);
  const [isAgentApplying, setIsAgentApplying] = useState(false);
  const [autoAcceptAgent, setAutoAcceptAgent] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityType>("files");
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(undefined);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { recentProjects, addRecentProject } = useRecentProjects();

  const { data: aiModels } = trpc.aiModels.list.useQuery();

  useEffect(() => {
    if (aiModels && aiModels.length > 0 && !selectedModelId) {
      const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0];
      if (defaultModel) setSelectedModelId(defaultModel.id);
    }
  }, [aiModels]);

  const [currentAgentRequestId, setCurrentAgentRequestId] = useState<string | null>(null);
  const [processedSteps, setProcessedSteps] = useState(0);
  const [agentProgressMessage, setAgentProgressMessage] = useState<string | null>(null);

  const startAgentInteractMutation = trpc.ai.startAgentInteract.useMutation();
  const { data: agentTraceData } = trpc.ai.pollAgentInteract.useQuery(
    { requestId: currentAgentRequestId! },
    { 
      enabled: !!currentAgentRequestId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === 'completed' || data?.status === 'error') {
          return false;
        }
        return 1000;
      }
    }
  );

  useEffect(() => {
    if (!agentTraceData) return;
    const trace = agentTraceData.trace ?? [];
    const newSteps = trace.slice(processedSteps);
    if (newSteps.length > 0) {
      newSteps.forEach((step: any) => {
        if (step.action?.thought) {
          const roleName = {
            planner: '规划',
            writer: '写作',
            editor: '编辑',
            reviewer: '审阅'
          }[step.role as string] || step.role;
          const thoughtContent = `【${roleName}思考】\n${step.action.thought}`;
          setChatMessages(prev => [...prev, { role: 'assistant', content: thoughtContent }]);
          saveMessageMutation.mutate({
            projectId: Number(projectId),
            role: 'assistant',
            content: thoughtContent
          });
        }
        if (step.role === 'planner' && step.action?.message && step.action.type === 'chat') {
          const planContent = `【写作规划】\n${step.action.message}`;
          setChatMessages(prev => [...prev, { role: 'assistant', content: planContent }]);
        }
      });
      setProcessedSteps(prev => prev + newSteps.length);
    }

    if (agentTraceData.status === 'running') {
      const stages = [
        { key: 'planner', label: '规划' },
        { key: 'writer', label: '写作' },
        { key: 'editor', label: '编辑' },
        { key: 'reviewer', label: '审阅' }
      ];
      const parts = stages.map((stage, index) => {
        if (index < trace.length) return `${stage.label}完成`;
        if (index === trace.length) return `${stage.label}进行中`;
        return `${stage.label}等待中`;
      });
      setAgentProgressMessage(`【代理思考中】${parts.join(" / ")}`);
    }

    if (agentTraceData.status === 'completed') {
      setCurrentAgentRequestId(null);
      setIsAiGenerating(false);
      setAgentProgressMessage(null);
      const finalAction = agentTraceData.final;
      if (finalAction) {
        let contentToSave = "";
        if (finalAction.type === 'modify_file') {
          contentToSave = `我已经提出了修改建议 ${finalAction.filePath || '文件'}。请查看。`;
          if (autoAcceptAgent) {
            applyAgentAction(finalAction, 'auto_approved');
          } else {
            setAgentAction(finalAction);
            setIsAgentConfirmationOpen(true);
            setChatMessages(prev => [...prev, { role: 'assistant', content: contentToSave }]);
          }
        } else {
          contentToSave = finalAction.message || "我不确定如何回答。";
          setChatMessages(prev => [...prev, { role: 'assistant', content: contentToSave }]);
        }
      }
    } else if (agentTraceData.status === 'error') {
      setCurrentAgentRequestId(null);
      setIsAiGenerating(false);
      setAgentProgressMessage(null);
      toast.error(`代理执行失败：${agentTraceData.error}`);
    }
  }, [agentTraceData, processedSteps, projectId, autoAcceptAgent]);

  const { streamedText, isStreaming, streamAI, stopStreaming, reset: resetStream } = useAIStream({
    onComplete: (text) => {
      setAiResponse(text);
      setIsAiGenerating(false);
    },
    onError: (error) => {
      setIsAiGenerating(false);
      toast.error(`生成失败: ${error.message}`);
    },
    typingSpeed: 20,
  });

  const { data: project } = trpc.projects.get.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  useEffect(() => {
    if (project) {
        addRecentProject({ id: project.id, title: project.title });
    }
  }, [project, addRecentProject]);

  const { data: chatHistory } = trpc.ai.getChatHistory.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  useEffect(() => {
    if (chatHistory) {
      setChatMessages(prev => {
        // 合并历史记录，避免重复
        const newMessages = chatHistory.map(msg => ({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content
        }));
        // 如果历史记录为空，保留默认的系统消息
        if (newMessages.length === 0) return prev;
        return newMessages;
      });
    }
  }, [chatHistory]);

  const { data: documents, refetch: refetchDocs } = trpc.documents.list.useQuery(
    { projectId: Number(projectId) },
    { enabled: !!projectId }
  );

  const { data: currentDoc } = trpc.documents.get.useQuery(
    { documentId: selectedDocId! },
    { enabled: !!selectedDocId }
  );

  const editorRef = useRef<RichTextEditorRef>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());

  const documentsByParent = useMemo(() => {
    const map = new Map<number | null, DocumentItem[]>();
    if (!documents) return map;
    const sorted = [...documents].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.title.localeCompare(b.title, "zh");
    });
    for (const doc of sorted) {
      const key = doc.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(doc as DocumentItem);
      map.set(key, list);
    }
    return map;
  }, [documents]);
  const documentsById = useMemo(() => {
    const map = new Map<number, DocumentItem>();
    (documents ?? []).forEach((doc) => map.set(doc.id, doc as DocumentItem));
    return map;
  }, [documents]);

  useEffect(() => {
    if (!documents) return;
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      documents
        .filter(doc => doc.type === "folder")
        .forEach(doc => {
          if (!next.has(doc.id)) next.add(doc.id);
        });
      return next;
    });
  }, [documents]);
  

  const agentDiff = useMemo(() => {
    if (!agentAction || agentAction.type !== 'modify_file') return [];
    return Diff.diffLines(agentAction.originalContent || "", agentAction.newContent || "");
  }, [agentAction]);

  const graphState = useMemo(() => {
    const trace = agentTraceData?.trace ?? [];
    const maxLoops = agentTraceData?.maxLoops ?? 0;
    const loopValues = trace
      .map((step: any) => {
        const match = typeof step?.notes === "string" ? step.notes.match(/loop:(\d+)/) : null;
        return match ? Number(match[1]) : 0;
      })
      .filter((value: number) => Number.isFinite(value));
    const loopCount = loopValues.length > 0 ? Math.max(...loopValues) : 0;
    const lastRole = trace.length > 0 ? trace[trace.length - 1]?.role : null;
    const runningRole = agentTraceData?.status === "running"
      ? lastRole
        ? lastRole === "planner" ? "writer" : "planner"
        : "planner"
      : null;
    const roleCounts = trace.reduce((acc: Record<string, number>, step: any) => {
      acc[step.role] = (acc[step.role] ?? 0) + 1;
      return acc;
    }, {});

    const getStatus = (role: "planner" | "writer") => {
      if (runningRole === role) return "running";
      if ((roleCounts[role] ?? 0) > 0) return "completed";
      return "waiting";
    };

    const statusStyles: Record<string, string> = {
      running: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
      completed: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
      waiting: "bg-muted text-muted-foreground border-border/40",
    };

    const nodes: Node[] = [
      {
        id: "planner",
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div className={`px-3 py-2 rounded-md border text-xs font-medium ${statusStyles[getStatus("planner")]}`}>
              规划
            </div>
          ),
        },
        draggable: false,
      },
      {
        id: "writer",
        position: { x: 220, y: 0 },
        data: {
          label: (
            <div className={`px-3 py-2 rounded-md border text-xs font-medium ${statusStyles[getStatus("writer")]}`}>
              写作
            </div>
          ),
        },
        draggable: false,
      },
    ];

    const edges: Edge[] = [
      { id: "planner-writer", source: "planner", target: "writer", animated: runningRole === "writer" },
      { id: "writer-planner", source: "writer", target: "planner", animated: runningRole === "planner" },
    ];

    return { nodes, edges, loopCount, maxLoops };
  }, [agentTraceData]);

  const saveMessageMutation = trpc.ai.saveChatMessage.useMutation();

  const createDocMutation = trpc.documents.create.useMutation({
    onSuccess: () => {
      toast.success("文档创建成功");
      setIsCreateDocDialogOpen(false);
      setNewDocTitle("");
      setNewDocParentId(null);
      refetchDocs();
    },
  });

  const updateDocMutation = trpc.documents.update.useMutation({
    onSuccess: () => {
      toast.success("保存成功");
      setIsSaving(false);
    },
  });

  const updateDocOrderMutation = trpc.documents.update.useMutation({
    onError: (error) => {
      toast.error(`排序更新失败: ${error.message}`);
    },
  });

  const deleteDocMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("文档已删除");
      setSelectedDocId(null);
      setContent("");
      refetchDocs();
    },
  });

  const updateAgentLogStatusMutation = trpc.agentLogs.updateStatus.useMutation();

  const aiGenerateMutation = trpc.ai.generateChapter.useMutation({
    onSuccess: (data) => {
      setAiResponse(data.content);
      setIsAiGenerating(false);
      toast.success("AI生成完成");
    },
    onError: (error) => {
      setIsAiGenerating(false);
      toast.error(`生成失败: ${error.message}`);
    },
  });

  const aiContinueMutation = trpc.ai.continue.useMutation({
    onSuccess: (data) => {
      setContent(content + "\n\n" + data.content);
      setIsAiGenerating(false);
      toast.success("续写完成");
    },
    onError: (error) => {
      setIsAiGenerating(false);
      toast.error(`续写失败: ${error.message}`);
    },
  });

  const applyAgentAction = async (action: any, status: 'approved' | 'auto_approved') => {
    if (!action || !selectedDocId) return;
    setIsAgentApplying(true);

    try {
      if (action.type === 'modify_file' && action.newContent) {
        let newFullContent = content;
        let applied = false;

        if (action.originalContent) {
          // Try exact replacement
          if (content.includes(action.originalContent)) {
            newFullContent = content.replace(action.originalContent, action.newContent);
            applied = true;
          } else {
            toast.error("无法找到原文的精确匹配。请手动应用。");
            // If we were trying to auto-apply, fall back to dialog
            setAgentAction(action);
            setIsAgentConfirmationOpen(true);
            setIsAgentApplying(false);
            return;
          }
        } else {
          // Fallback: overwrite if no originalContent provided
          newFullContent = action.newContent;
          applied = true;
        }

        if (applied) {
          setContent(newFullContent);

          await updateDocMutation.mutateAsync({
            documentId: selectedDocId,
            content: newFullContent
          });

          if (action.logId) {
            await updateAgentLogStatusMutation.mutateAsync({
              logId: action.logId,
              status
            });
          }

          toast.success("修改应用成功");
          setChatMessages(prev => [...prev, { role: 'assistant', content: `已成功更新文件。` }]);
        }
      }
    } catch (e: any) {
      toast.error(`应用修改失败: ${e.message}`);
    } finally {
      setIsAgentApplying(false);
      // Only close if it was open (handling both auto and manual cases)
      setIsAgentConfirmationOpen(false);
      setAgentAction(null);
    }
  };

  const agentInteractMutation = trpc.ai.agentInteract.useMutation({
    onSuccess: (data) => {
      let contentToSave = "";
      
      // Show Agent thoughts and Planner's plan
      if (data.trace && Array.isArray(data.trace) && data.trace.length > 0) {
          data.trace.forEach((step: any) => {
              // 1. Show Thought
              if (step.action?.thought) {
                  const roleName = {
                      planner: '规划',
                      writer: '写作',
                      editor: '编辑',
                      reviewer: '审阅'
                  }[step.role as string] || step.role;
                  
                  const thoughtContent = `【${roleName}思考】\n${step.action.thought}`;
                  setChatMessages(prev => [...prev, { role: 'assistant', content: thoughtContent }]);
                  saveMessageMutation.mutate({
                      projectId: Number(projectId),
                      role: 'assistant',
                      content: thoughtContent
                  });
              }

              // 2. Show Planner's explicit message (The Plan)
              if (step.role === 'planner' && step.action?.message && step.action.type === 'chat') {
                  const planContent = `【写作规划】\n${step.action.message}`;
                  setChatMessages(prev => [...prev, { role: 'assistant', content: planContent }]);
                  saveMessageMutation.mutate({
                      projectId: Number(projectId),
                      role: 'assistant',
                      content: planContent
                  });
              }
          });
      } else if (data.thought) {
           // Single Agent Thought
           setChatMessages(prev => [...prev, { 
               role: 'assistant', 
               content: '', 
               thought: data.thought 
           }]);
           saveMessageMutation.mutate({
              projectId: Number(projectId),
              role: 'assistant',
              content: `【思考】\n${data.thought}`
           });
      }

      if (data.type === 'modify_file') {
        contentToSave = `我已经提出了修改建议 ${data.filePath || '文件'}。请查看。`;
        if (autoAcceptAgent) {
           applyAgentAction(data, 'auto_approved');
        } else {
           setAgentAction(data);
           // Don't auto open dialog, let user click button in chat
           // setIsAgentConfirmationOpen(true);
           setChatMessages(prev => [...prev, { 
             role: 'assistant', 
             content: contentToSave,
              fileChange: {
                  filePath: data.filePath ?? "",
                  originalContent: data.originalContent ?? "",
                  newContent: data.newContent ?? "",
                  logId: data.logId ? String(data.logId) : undefined
              }
            }]);
        }
      } else {
        contentToSave = data.message || "我不确定如何回答。";
        setChatMessages(prev => [...prev, { role: 'assistant', content: contentToSave }]);
      }

      saveMessageMutation.mutate({
        projectId: Number(projectId),
        role: 'assistant',
        content: contentToSave
      });

      setIsAiGenerating(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsAiGenerating(false);
    }
  });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      saveMessageMutation.mutate({
        projectId: Number(projectId),
        role: 'assistant',
        content: data.content
      });
      setIsAiGenerating(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsAiGenerating(false);
    }
  });

  const handleSendMessage = async (text: string, mode: 'chat' | 'agent') => {
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    saveMessageMutation.mutate({
        projectId: Number(projectId),
        role: 'user',
        content: text
    });
    setIsAiGenerating(true);
    
    const history = chatMessages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
    }));

    const modelConfigId = selectedModelId || aiModels?.find(m => m.isDefault)?.id || aiModels?.[0]?.id || 1;

    try {
      if (mode === 'agent') {
              let targetDocId = selectedDocId;
              let targetTitle = currentDoc?.title || "第一章";
              let targetContent = content;

              if (!targetDocId) {
                const created = await createDocMutation.mutateAsync({
                  projectId: Number(projectId),
                  title: "第一章",
                  type: "chapter",
                  content: "",
                });
                targetDocId = created.documentId;
                targetTitle = "第一章";
                targetContent = "";
                setSelectedDocId(targetDocId);
                setContent("");
                refetchDocs();
              }

              if (useMultiAgent) {
                   setProcessedSteps(0);
                   setAgentProgressMessage("【代理思考中】规划进行中 / 写作等待 / 编辑等待 / 审阅等待");
                  const result = await startAgentInteractMutation.mutateAsync({
                      modelConfigId,
                      projectId: Number(projectId),
                      message: text,
                      currentFile: targetDocId ? {
                          path: targetTitle,
                          content: targetContent 
                      } : undefined,
                      history
                  });
                  setCurrentAgentRequestId(result.requestId);
              } else {
                   setAgentProgressMessage(null);
                  agentInteractMutation.mutate({
                      modelConfigId,
                      projectId: Number(projectId),
                      message: text,
                      useMultiAgent: false,
                      currentFile: targetDocId ? {
                          path: targetTitle,
                          content: targetContent 
                      } : undefined,
                      history
                  });
              }
          } else {
          chatMutation.mutate({
              modelConfigId,
              projectId: Number(projectId),
              message: text,
              history
          });
      }
    } catch (error: any) {
      setIsAiGenerating(false);
      toast.error(error?.message || "发送失败");
    }
  };

  const handleAgentConfirm = async () => {
    if (agentAction) {
      await applyAgentAction(agentAction, 'approved');
    }
  };

  const handleAgentReject = async () => {
    if (agentAction?.logId) {
      try {
        await updateAgentLogStatusMutation.mutateAsync({
          logId: agentAction.logId,
          status: 'rejected'
        });
      } catch (e: any) {
        toast.error(`更新日志失败: ${e.message}`);
      }
    }
    setIsAgentConfirmationOpen(false);
    setAgentAction(null);
  };

  useEffect(() => {
    if (currentDoc) {
      setContent(currentDoc.content || "");
    }
  }, [currentDoc]);

  if (!user) {
    return null;
  }

  const handleSave = () => {
    if (!selectedDocId) return;
    setIsSaving(true);
    updateDocMutation.mutate({
      documentId: selectedDocId,
      content,
    });
  };

  const handleCreateDoc = () => {
    if (!newDocTitle.trim()) {
      toast.error("请输入文档标题");
      return;
    }
    createDocMutation.mutate({
      projectId: Number(projectId),
      title: newDocTitle,
      type: newDocType,
      content: "",
      parentId: newDocParentId ?? undefined,
    });
  };

  const handleOpenCreateDialog = (type?: DocumentItem["type"], parentId?: number | null) => {
    if (type && type !== "character") {
      setNewDocType(type);
    }
    if (parentId !== undefined) {
      setNewDocParentId(parentId);
    } else {
      setNewDocParentId(null);
    }
    setIsCreateDocDialogOpen(true);
  };

  const handleMoveDoc = async (params: { draggedId: number; targetId: number; dropPosition: "before" | "after" | "inside" }) => {
    if (!documents) return;
    const dragged = documents.find((doc) => doc.id === params.draggedId);
    const target = documents.find((doc) => doc.id === params.targetId);
    if (!dragged || !target) return;
    if (dragged.id === target.id) return;

    let newParentId: number | null = target.parentId ?? null;
    if (params.dropPosition === "inside") {
      if (target.type !== "folder") return;
      newParentId = target.id;
    }

    if (dragged.type === "folder") {
      let currentParentId = target.parentId ?? null;
      if (params.dropPosition === "inside") {
        currentParentId = target.id;
      }
      while (currentParentId != null) {
        if (currentParentId === dragged.id) return;
        const parent = documents.find((doc) => doc.id === currentParentId);
        currentParentId = parent?.parentId ?? null;
      }
    }

    const oldParentId = dragged.parentId ?? null;
    const oldSiblings = documents
      .filter((doc) => (doc.parentId ?? null) === oldParentId && doc.id !== dragged.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const newSiblings = documents
      .filter((doc) => (doc.parentId ?? null) === newParentId && doc.id !== dragged.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (params.dropPosition === "inside") {
      newSiblings.push(dragged);
    } else {
      const targetIndex = newSiblings.findIndex((doc) => doc.id === target.id);
      const insertIndex = params.dropPosition === "before" ? targetIndex : targetIndex + 1;
      const safeIndex = insertIndex < 0 ? newSiblings.length : insertIndex;
      newSiblings.splice(safeIndex, 0, dragged);
    }

    const updateOrders = (list: typeof newSiblings, parentId: number | null) => {
      return list.map((doc, index) => {
        return updateDocOrderMutation.mutateAsync({
          documentId: doc.id,
          order: index,
          parentId: doc.id === dragged.id ? parentId : undefined,
        });
      });
    };

    try {
      const tasks = [...updateOrders(newSiblings, newParentId)];
      if (oldParentId !== newParentId) {
        tasks.push(...updateOrders(oldSiblings, oldParentId));
      }
      await Promise.allSettled(tasks);
      refetchDocs();
    } catch (error) {
      toast.error("排序更新失败");
    }
  };

  const handleDeleteDoc = (docId: number) => {
    if (confirm("确定要删除这个文档吗？")) {
      deleteDocMutation.mutate({ documentId: docId });
    }
  };

  const toggleFolderExpanded = (folderId: number) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };



  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }
    if (!aiModels || aiModels.length === 0) {
      toast.error("请先配置AI模型");
      setLocation("/ai-models");
      return;
    }
    const modelId = selectedModelId || aiModels.find(m => m.isDefault)?.id || aiModels[0].id;
    const selectedModel = aiModels.find(m => m.id === modelId);
    
    if (!selectedModel) {
       toast.error("未找到选中的模型配置");
       return;
    }

    setIsAiGenerating(true);
    resetStream();

    if (useStreaming && selectedModel.apiKey) {
      await streamAI(
        selectedModel.apiEndpoint || "https://api.deepseek.com/v1/chat/completions",
        selectedModel.apiKey,
        aiPrompt,
        content
      );
    } else {
      aiGenerateMutation.mutate({
        modelConfigId: modelId,
        projectId: Number(projectId),
        prompt: aiPrompt,
        context: content,
        temperature: aiParams.temperature,
        topP: aiParams.topP,
        maxTokens: aiParams.maxTokens,
      });
    }
  };

  const handleAiContinue = () => {
    if (!content.trim()) {
      toast.error("请先输入一些内容");
      return;
    }
    if (!aiModels || aiModels.length === 0) {
      toast.error("请先配置AI模型");
      setLocation("/ai-models");
      return;
    }
    const modelId = selectedModelId || aiModels.find(m => m.isDefault)?.id || aiModels[0].id;
    setIsAiGenerating(true);
    aiContinueMutation.mutate({
      modelConfigId: modelId,
      projectId: Number(projectId),
      documentId: selectedDocId!,
      existingContent: content,
      length: "medium",
      temperature: aiParams.temperature,
      topP: aiParams.topP,
      maxTokens: aiParams.maxTokens,
    });
  };

  const insertAiResponse = () => {
    const textToInsert = streamedText || aiResponse;
    const htmlContent = plainTextToHtml(textToInsert);
    setContent(content + htmlContent);
    setAiResponse("");
    resetStream();
    toast.success("已插入到编辑器");
  };

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const getLanguageFromFilePath = (filePath?: string) => {
    if (!filePath) return undefined;
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (!ext) return undefined;
    const mapping: Record<string, string> = {
      ts: "ts",
      tsx: "tsx",
      js: "js",
      jsx: "jsx",
      json: "json",
      md: "markdown",
      css: "css",
      scss: "scss",
      html: "html",
      yml: "yaml",
      yaml: "yaml",
      sh: "bash",
      bash: "bash",
      py: "python",
      java: "java",
      go: "go",
      rs: "rust",
      sql: "sql"
    };
    return mapping[ext] ?? ext;
  };

  const buildCodeBlockHtml = (code: string, language?: string) => {
    const escaped = escapeHtml(code);
    const className = language ? ` class="language-${language}"` : "";
    return `<pre><code${className}>${escaped}</code></pre>`;
  };

  const getDocPathParts = (doc: DocumentItem) => {
    const parts = [doc.title];
    let current: DocumentItem | undefined = doc;
    while (current?.parentId != null) {
      const parent = documentsById.get(current.parentId);
      if (!parent) break;
      parts.unshift(parent.title);
      current = parent;
    }
    return parts;
  };

  const getFolderPathInfo = (doc: DocumentItem) => {
    const parts = getDocPathParts(doc);
    if (doc.type !== "folder") {
      parts.pop();
    }
    const folderPath = parts.length > 0 ? parts.join("/") : "/";
    const folderIds: number[] = [];
    let current: DocumentItem | undefined = doc.type === "folder" ? doc : doc.parentId != null ? documentsById.get(doc.parentId) : undefined;
    while (current?.parentId != null) {
      folderIds.unshift(current.id);
      current = documentsById.get(current.parentId);
    }
    if (current) {
      folderIds.unshift(current.id);
    }
    return { folderPath, folderIds };
  };

  const displayChatMessages: Message[] = agentProgressMessage
    ? [...chatMessages, { role: "assistant", content: agentProgressMessage } as Message]
    : chatMessages;
  const handleSendPathToAI = (doc: DocumentItem, instruction: string) => {
    const { folderPath, folderIds } = getFolderPathInfo(doc);
    setSendTarget({ folderPath, folderIds });
    setSendDraft(instruction);
    setSendDialogOpen(true);
  };

  const handleCloseFolder = () => {
    setLocation("/dashboard");
  };

  const handleNewFolder = () => {
    setIsCreateProjectOpen(true);
  };

  const handleOpenRecent = (id: number) => {
    setLocation(`/project/${id}`);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar 
        projectTitle={project?.title} 
        onSave={handleSave} 
        user={user}
        onNewFolder={handleNewFolder}
        onCloseFolder={handleCloseFolder}
        recentProjects={recentProjects}
        onOpenRecent={handleOpenRecent}
      />

      <div className="flex-1 flex overflow-hidden">
        {!focusMode && (
          <ActivityBar 
            activeActivity={activeActivity} 
            onActivityChange={setActiveActivity} 
          />
        )}

        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Sidebar - File Tree */}
            {!focusMode && (
              <>
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="min-w-[200px]">
                  <SideBar 
                    activeActivity={activeActivity}
                    documents={documents ?? []}
                    selectedDocId={selectedDocId}
                    expandedFolderIds={expandedFolderIds}
                    onSelectDoc={setSelectedDocId}
                    onToggleFolder={toggleFolderExpanded}
                    onDeleteDoc={handleDeleteDoc}
                    onOpenCreateDialog={handleOpenCreateDialog}
                    onCopyPath={(path) => {
                      toast.success(`已复制路径：${path}`);
                    }}
                    onSendToAI={(path, doc, instruction) => {
                      handleSendPathToAI(doc, instruction);
                      toast.success("已打开发送对话框");
                    }}
                    onMoveDoc={handleMoveDoc}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Center - Editor */}
            <ResizablePanel defaultSize={focusMode ? 100 : 60} minSize={30}>
              <div className="h-full flex flex-col bg-background relative">
                {selectedDocId ? (
                  <>
                    <div className="h-10 px-6 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-sm z-10 shrink-0">
                      <h2 className="font-semibold text-sm">{currentDoc?.title}</h2>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => setFocusMode(!focusMode)}
                          title={focusMode ? "退出专注模式" : "专注模式"}
                        >
                          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                          {content.replace(/<[^>]*>/g, '').length} 字
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <RichTextEditor
                        ref={editorRef}
                        content={content}
                        onChange={setContent}
                        placeholder="开始写作..."
                        className="h-full"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                      <PenTool className="w-8 h-8 opacity-50" />
                    </div>
                    <h3 className="font-medium text-lg text-foreground mb-2">准备好开始创作了吗？</h3>
                    <p className="text-sm max-w-xs text-center mb-6">从左侧选择一个文档，或者创建一个新章节开始您的故事。</p>
                    <Button onClick={() => handleOpenCreateDialog("chapter")} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      新建文档
                    </Button>
                  </div>
                )}

                {/* Overlays */}
                {showAudioPlayer && (
                  <div className="absolute bottom-6 right-6 w-96 z-50 shadow-2xl rounded-xl overflow-hidden glass-panel animate-in slide-in-from-bottom-5">
                    <div className="p-2 bg-muted/50 border-b border-border/50 flex justify-between items-center">
                      <span className="text-xs font-medium px-2">语音朗读</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAudioPlayer(false)}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <AudioPlayer text={content} onClose={() => setShowAudioPlayer(false)} />
                  </div>
                )}

                {showVoiceRecorder && (
                  <div className="absolute bottom-6 left-6 w-80 z-50 shadow-2xl rounded-xl overflow-hidden glass-panel animate-in slide-in-from-bottom-5">
                    <div className="p-2 bg-muted/50 border-b border-border/50 flex justify-between items-center">
                      <span className="text-xs font-medium px-2">语音输入</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowVoiceRecorder(false)}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-4">
                      {useStreamingRecognition ? (
                        <StreamingVoiceRecorder
                          onTranscribe={(text) => setContent(content + "\n\n" + text)}
                          onClose={() => setShowVoiceRecorder(false)}
                        />
                      ) : (
                        <VoiceRecorder
                          onTranscribe={(text) => {
                            setContent(content + "\n\n" + text);
                            setShowVoiceRecorder(false);
                          }}
                          onClose={() => setShowVoiceRecorder(false)}
                        />
                      )}
                      <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/50">
                        <input
                          type="checkbox"
                          id="use-streaming-recognition"
                          checked={useStreamingRecognition}
                          onChange={(e) => setUseStreamingRecognition(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary/20"
                        />
                        <label htmlFor="use-streaming-recognition" className="text-xs cursor-pointer select-none">
                          使用实时流式识别
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>

            {/* Right Sidebar - AI Assistant */}
            {!focusMode && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="min-w-[240px]">
                  <AIPanel 
                    aiModels={aiModels ?? []}
                    selectedModelId={selectedModelId}
                    onModelChange={(id) => setSelectedModelId(Number(id))}
                    aiParams={aiParams}
                    onParamsChange={(key, value) => setAiParams(prev => ({ ...prev, [key]: value }))}
                    messages={displayChatMessages}
                    onSendMessage={handleSendMessage}
                    isGenerating={isAiGenerating}
                    mode={aiChatMode}
                    onModeChange={setAiChatMode}
                    inputValue={aiChatInput}
                    onInputChange={setAiChatInput}
                    onInsertContent={(payload) => {
                      const language = payload.language ?? getLanguageFromFilePath(payload.filePath);
                      const codeBlockHtml = buildCodeBlockHtml(payload.content, language);
                      if (editorRef.current) {
                        editorRef.current.insertContent(codeBlockHtml);
                        toast.success("已插入编辑器");
                      } else {
                        // Fallback
                        setContent(prev => prev + codeBlockHtml);
                        toast.success("已追加到编辑器");
                      }
                    }}
                    onApplyChange={(fileChange) => {
                      applyAgentAction({
                        type: 'modify_file',
                        ...fileChange
                      }, 'approved');
                    }}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>发送给 AI</DialogTitle>
            <DialogDescription>编辑指令后再写入到对话输入框</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>目标文件夹</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-mono text-xs bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                onClick={() => {
                  if (!sendTarget?.folderIds?.length) return;
                  setActiveActivity("files");
                  setExpandedFolderIds(prev => {
                    const next = new Set(prev);
                    sendTarget.folderIds.forEach((id) => next.add(id));
                    return next;
                  });
                  const lastId = sendTarget.folderIds[sendTarget.folderIds.length - 1];
                  if (lastId) {
                    setSelectedDocId(lastId);
                  }
                }}
              >
                {sendTarget?.folderPath ?? "/"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>指令内容</Label>
              <Textarea
                value={sendDraft}
                onChange={(e) => setSendDraft(e.target.value)}
                placeholder="编辑发送给 AI 的指令"
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="secondary"
              disabled={!sendDraft.trim() || isAiGenerating}
              onClick={() => {
                setAiChatMode("chat");
                setAiChatInput(sendDraft.trim());
                setSendDialogOpen(false);
              }}
            >
              写入 Chat 输入框
            </Button>
            <Button
              disabled={!sendDraft.trim() || isAiGenerating}
              onClick={() => {
                setAiChatMode("agent");
                setAiChatInput(sendDraft.trim());
                setSendDialogOpen(false);
              }}
            >
              写入 Agent 输入框
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑器设置</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="auto-accept" className="flex flex-col space-y-1">
                  <span>Agent 自动应用修改</span>
                  <span className="font-normal text-xs text-muted-foreground">开启后，Agent 提出的文件修改将自动应用，不再提示确认。</span>
                </Label>
                <Switch id="auto-accept" checked={autoAcceptAgent} onCheckedChange={setAutoAcceptAgent} />
             </div>
             <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="multi-agent" className="flex flex-col space-y-1">
                  <span>多智能体协作</span>
                  <span className="font-normal text-xs text-muted-foreground">开启后，Agent 将采用多角色协作流程。</span>
                </Label>
                <Switch id="multi-agent" checked={useMultiAgent} onCheckedChange={setUseMultiAgent} />
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Document Dialog */}
      <Dialog
        open={isCreateDocDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDocDialogOpen(open);
          if (!open) {
            setNewDocParentId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文档</DialogTitle>
            <DialogDescription>创建章节、设定或其他文档</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">文档标题</Label>
              <Input
                id="doc-title"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="输入文档标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-type">文档类型</Label>
              <Select value={newDocType} onValueChange={(v: any) => setNewDocType(v)}>
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chapter">章节</SelectItem>
                  <SelectItem value="setting">设定</SelectItem>
                  <SelectItem value="outline">大纲</SelectItem>
                  <SelectItem value="worldview">世界观</SelectItem>
                  <SelectItem value="folder">文件夹</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateDoc} disabled={createDocMutation.isPending}>
              {createDocMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog (New Folder) */}
      <CreateProjectDialog 
        open={isCreateProjectOpen} 
        onOpenChange={setIsCreateProjectOpen} 
        onSuccess={(id) => setLocation(`/project/${id}`)}
      />
    </div>
  );
}
