import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateWithAI, AIMessage, AgentAction } from "./ai";

// 多智能体角色
export type AgentRole = "planner" | "writer" | "editor" | "reviewer";

type OrchestratorStrategy = "linear" | "graph";

// 单个智能体输入
type AgentInput = {
  userMessage: string;
  currentFile?: { path: string; content: string } | undefined;
  history: AIMessage[];
};

// 单个智能体输出
type AgentOutput = {
  role: AgentRole;
  action: AgentAction;
  notes?: string;
};

// 单个智能体执行器
class Agent {
  constructor(
    public role: AgentRole,
    private modelConfigId: number,
    private userId: number,
    private projectId: number
  ) {}

  async run(input: AgentInput): Promise<AgentOutput> {
    // 根据角色构造提示词模板
    let systemPrompt = "";
    if (this.role === "planner") {
      systemPrompt = "你是负责规划的代理。请分析用户的请求。如果用户要求写作或修改小说内容（例如'写一个玄幻小说'），你必须直接制定详细的写作计划（包括核心情节、人物行动、情感基调等）并返回。**严禁反问用户**。即使信息不全，也要根据常规套路自动补全设定。你的输出将直接作为写作指南。如果是普通问答，直接回答。请全程使用中文。";
    } else if (this.role === "writer") {
      systemPrompt = "你是负责提出具体修改方案的写作代理。根据用户的请求和规划代理的计划（如果有），立即撰写或修改文件内容。请务必生成实际的小说正文，并使用 modify_file 动作返回。不要只在聊天中回复'好的'。";
    } else if (this.role === "editor") {
      systemPrompt = "你是负责优化并保障一致性的编辑代理。";
    } else {
      systemPrompt = "你是负责最终质量检查与给出通过/调整意见的审阅代理。";
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      [
        "system",
        "当前文件: {filePath}\n内容:\n{fileContent}",
      ],
      [
        "system",
        [
          "请严格以JSON对象输出，且不要输出任何额外文本。",
          "必须包含 'thought' 字段进行思考（Chain of Thought）。",
          "允许的结构之一：",
          '{{"type":"modify_file","thought":"你的思考过程...","filePath":"文件名","originalContent":"原始全文或片段","newContent":"新的全文或片段","reason":"中文说明"}}',
          "或：",
          '{{"type":"chat","thought":"你的思考过程...","message":"中文回复"}}',
          "规则：",
          "1. 当用户提出写作/修改并且提供了当前文件时，应优先返回 modify_file。",
          "2. 当用户请求创作新内容（如'写第一章'）且当前没有打开文件时，必须返回 modify_file：",
          "   - filePath: 设为用户指定的文件名，或自动生成如 '第一章.txt'",
          "   - originalContent: 空字符串 \"\"",
          "   - newContent: 生成的完整内容",
          "   - reason: '创建新文件'",
          "3. modify_file 字段要求：",
          "   - originalContent 必须精确等于当前文件内容（如果是修改）或空字符串（如果是新建）",
          "   - newContent 为完整内容",
          this.role === "planner" ? "注意：规划代理(planner)通常返回 chat 类型的消息作为写作指导，除非你需要直接创建大纲文件。" : ""
        ].join("\\n"),
      ],
      ["system", "历史对话将作为上下文提供，请保持一致性。以中文输出。"],
      ["human", "{userMessage}"],
    ]);

    // 将模板渲染成消息列表
    const formatted = await prompt.formatMessages({
      userMessage: input.userMessage,
      filePath: input.currentFile?.path ?? "未提供",
      fileContent: input.currentFile?.content ?? "",
    });
    const mapped = formatted.map(message => {
      const role: AIMessage["role"] =
        message._getType() === "human"
          ? "user"
          : message._getType() === "ai"
          ? "assistant"
          : "system";
      return { role, content: message.content as string };
    });
    // 系统消息优先，再追加历史与用户输入
    const systemMessages = mapped.filter(message => message.role === "system");
    const userMessages = mapped.filter(message => message.role === "user");
    const messages: AIMessage[] = [
      ...systemMessages,
      ...input.history,
      ...userMessages,
    ];
    let content = "";
    try {
      content = (
        await generateWithAI(
          this.modelConfigId,
          { messages, temperature: 0.2, maxTokens: 4000 },
          this.userId,
          this.projectId
        )
      ).content;
    } catch (error: any) {
      console.error(`[Agent ${this.role}] Generation failed:`, error);
      return {
        role: this.role,
        action: {
          type: "chat",
          message: `(系统错误: 代理 ${this.role} 生成失败 - ${error.message})`,
          thought: `Error during generation: ${error.message}`
        }
      };
    }

    // 解析模型输出为结构化动作
    let action: AgentAction;
    try {
      let clean = content.trim();
      if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(clean);
      if (parsed.type === "modify_file" || parsed.type === "chat") {
        action = parsed;
      } else {
        action = { type: "chat", message: content };
      }
    } catch {
      action = { type: "chat", message: content };
    }

    return { role: this.role, action };
  }
}

// 多智能体调度器
export class MultiAgentOrchestrator {
  private agents: Agent[];
  private state: {
    steps: AgentOutput[];
  } = { steps: [] };

  constructor(
    private modelConfigId: number,
    private userId: number,
    private projectId: number
  ) {
    this.agents = [
      new Agent("planner", modelConfigId, userId, projectId),
      new Agent("writer", modelConfigId, userId, projectId),
      new Agent("editor", modelConfigId, userId, projectId),
      new Agent("reviewer", modelConfigId, userId, projectId),
    ];
  }

  // 获取执行轨迹
  getState() {
    return this.state;
  }

  // 顺序执行规划、写作、编辑、审阅四阶段
  async run(input: AgentInput, onStep?: (step: AgentOutput) => void): Promise<{ final: AgentAction; trace: AgentOutput[] }> {
    const trace: AgentOutput[] = [];

    // 1. Planner
    const plannerOut = await this.agents[0].run(input);
    trace.push(plannerOut);
    onStep?.(plannerOut);

    // 2. Writer (takes Planner's output as context)
    const writerMessage = `用户请求: ${input.userMessage}\n\n规划/指导意见:\n${plannerOut.action.message || "（无）"}`;
    
    const writerOut = await this.agents[1].run({
      ...input,
      userMessage: writerMessage,
      history: [
        ...input.history,
        { role: "assistant", content: `规划: ${plannerOut.action.message}` }
      ]
    });
    trace.push(writerOut);
    onStep?.(writerOut);

    // 3. Editor
    const editorMessage =
      writerOut.action.type === "modify_file"
        ? `请在保持一致性的前提下优化此修改方案并指明必要调整。\n文件: ${writerOut.action.filePath ?? input.currentFile?.path ?? "untitled"}`
        : `用户意图分析并优化回复：\n${writerOut.action.message ?? ""}`;
    const editorOut = await this.agents[2].run({
      ...input,
      userMessage: editorMessage,
      currentFile:
        writerOut.action.type === "modify_file"
          ? {
              path: writerOut.action.filePath ?? input.currentFile?.path ?? "untitled",
              content: writerOut.action.originalContent ?? input.currentFile?.content ?? "",
            }
          : input.currentFile,
      history: [
        ...input.history,
        { role: "assistant", content: JSON.stringify(writerOut.action) },
      ],
    });
    trace.push(editorOut);
    onStep?.(editorOut);

    // 4. Reviewer
    const reviewerMessage =
      editorOut.action.type === "modify_file"
        ? `对下面的方案进行最终审核，若通过请返回有效的修改JSON；若不通过请以中文说明原因并返回聊天消息JSON。\n${JSON.stringify(
            editorOut.action
          )}`
        : `请对编辑后的回复进行最终审核并返回中文聊天消息JSON。`;
    const reviewerOut = await this.agents[3].run({
      ...input,
      userMessage: reviewerMessage,
      currentFile:
        editorOut.action.type === "modify_file"
          ? {
              path: editorOut.action.filePath ?? input.currentFile?.path ?? "untitled",
              content:
                editorOut.action.originalContent ?? input.currentFile?.content ?? "",
            }
          : input.currentFile,
      history: [
        ...input.history,
        { role: "assistant", content: JSON.stringify(editorOut.action) },
      ],
    });
    trace.push(reviewerOut);
    onStep?.(reviewerOut);

    this.state.steps = trace;
    const final =
      reviewerOut.action.type === "modify_file"
        ? reviewerOut.action
        : editorOut.action.type === "modify_file"
          ? editorOut.action
          : writerOut.action;

    return { final, trace };
  }
}

class GraphAgentOrchestrator {
  private planner: Agent;
  private writer: Agent;

  constructor(
    private modelConfigId: number,
    private userId: number,
    private projectId: number
  ) {
    this.planner = new Agent("planner", modelConfigId, userId, projectId);
    this.writer = new Agent("writer", modelConfigId, userId, projectId);
  }

  async run(input: AgentInput, onStep?: (step: AgentOutput) => void): Promise<{ final: AgentAction; trace: AgentOutput[] }> {
    const GraphState = Annotation.Root({
      userMessage: Annotation<string>,
      currentFile: Annotation<{ path: string; content: string } | undefined>,
      history: Annotation<AIMessage[]>({
        reducer: (state, update) => state.concat(update),
        default: () => [],
      }),
      plan: Annotation<string | null>,
      lastAction: Annotation<AgentAction | null>,
      trace: Annotation<AgentOutput[]>({
        reducer: (state, update) => state.concat(update),
        default: () => [],
      }),
      loopCount: Annotation<number>,
      maxLoops: Annotation<number>,
    });

    const buildPlannerPrompt = (state: typeof GraphState.State) => {
      if (state.lastAction?.type === "modify_file") {
        return [
          "基于最新写作内容，给出“下一步写什么”的创作建议。",
          "请输出清晰的计划要点，避免反问用户。",
        ].join("\n");
      }
      return state.userMessage;
    };

    const plannerNode = async (state: typeof GraphState.State) => {
      const plannerOut = await this.planner.run({
        userMessage: buildPlannerPrompt(state),
        currentFile: state.currentFile,
        history: state.history ?? [],
      });
      const loopIndex = state.loopCount ?? 0;
      const plannerStep: AgentOutput = { ...plannerOut, notes: `loop:${loopIndex};node:planner` };
      onStep?.(plannerStep);
      const planMessage =
        plannerOut.action.type === "chat"
          ? plannerOut.action.message ?? ""
          : plannerOut.action.type === "modify_file"
            ? plannerOut.action.reason ?? ""
            : "";
      return {
        plan: planMessage,
        history: planMessage ? [{ role: "assistant", content: `规划: ${planMessage}` }] : [],
        trace: [plannerStep],
      };
    };

    const writerNode = async (state: typeof GraphState.State) => {
      const writerMessage = [
        `用户请求: ${state.userMessage}`,
        `规划/建议:\n${state.plan || "（无）"}`,
        "请继续写作并给出本轮修改方案。",
      ].join("\n\n");
      const writerOut = await this.writer.run({
        userMessage: writerMessage,
        currentFile: state.currentFile,
        history: state.history ?? [],
      });
      const nextLoopCount = (state.loopCount ?? 0) + 1;
      const writerStep: AgentOutput = { ...writerOut, notes: `loop:${nextLoopCount};node:writer` };
      onStep?.(writerStep);
      const nextFile =
        writerOut.action.type === "modify_file"
          ? {
              path: writerOut.action.filePath ?? state.currentFile?.path ?? "untitled",
              content: writerOut.action.newContent ?? "",
            }
          : state.currentFile;
      const historyUpdate =
        writerOut.action.type === "modify_file" || writerOut.action.type === "chat"
          ? [{ role: "assistant", content: JSON.stringify(writerOut.action) }]
          : [];
      return {
        lastAction: writerOut.action,
        currentFile: nextFile,
        history: historyUpdate,
        trace: [writerStep],
        loopCount: nextLoopCount,
      };
    };

    const shouldContinue = (state: typeof GraphState.State) => {
      if ((state.loopCount ?? 0) >= (state.maxLoops ?? 1)) {
        return END;
      }
      return "writer";
    };

    const graph = new StateGraph(GraphState)
      .addNode("planner", plannerNode)
      .addNode("writer", writerNode)
      .addEdge(START, "planner")
      .addConditionalEdges("planner", shouldContinue)
      .addEdge("writer", "planner");

    const app = graph.compile();
    const initialState = {
      userMessage: input.userMessage,
      currentFile: input.currentFile,
      history: input.history ?? [],
      plan: null,
      lastAction: null,
      trace: [],
      loopCount: 0,
      maxLoops: Number(process.env.MULTI_AGENT_MAX_LOOPS ?? 3),
    };
    try {
      const finalState = await app.invoke(initialState);
      const finalAction =
        finalState.lastAction ??
        finalState.trace.slice(-1)[0]?.action ?? {
          type: "chat",
          message: "未能生成有效结果",
        };
      return { final: finalAction, trace: finalState.trace ?? [] };
    } catch (error: any) {
      const fallback: AgentAction = {
        type: "chat",
        message: `图式编排执行失败：${error?.message ?? "未知错误"}`,
      };
      return { final: fallback, trace: [] };
    }
  }
}

function resolveOrchestratorStrategy(): OrchestratorStrategy {
  const strategy = process.env.MULTI_AGENT_STRATEGY;
  return strategy === "graph" ? "graph" : "linear";
}

function createOrchestrator(modelConfigId: number, userId: number, projectId: number) {
  const strategy = resolveOrchestratorStrategy();
  if (strategy === "graph") {
    return new GraphAgentOrchestrator(modelConfigId, userId, projectId);
  }
  return new MultiAgentOrchestrator(modelConfigId, userId, projectId);
}

// 运行轨迹缓存
type TraceEntry = {
  status: 'running' | 'completed' | 'error';
  trace: AgentOutput[];
  final?: AgentAction;
  error?: string;
  createdAt: number;
  strategy?: OrchestratorStrategy;
  maxLoops?: number;
};
const traceStore = new Map<string, TraceEntry>();

// 获取指定请求的轨迹
export function getMultiAgentTrace(requestId: string) {
  return traceStore.get(requestId) ?? null;
}

export type TaskItem = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "paused";
  priority: "high" | "medium" | "low";
  estimateMinutes?: number;
  accepts?: string[];
  dependsOn?: string[];
  startedAt?: number;
  completedAt?: number;
};

type TaskPlannerState = {
  requestId: string;
  repoUrl: string;
  status: "running" | "completed" | "error" | "paused";
  message?: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
  todo: TaskItem[];
  history: { timestamp: number; message: string }[];
  snapshotPath?: string;
  todoPath?: string;
};

const taskPlannerStore = new Map<string, TaskPlannerState>();

function getS3Client() {
  try {
    const client = new S3Client({});
    return client;
  } catch {
    return null;
  }
}

async function writeLocalSnapshot(requestId: string, state: TaskPlannerState) {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.resolve(process.cwd(), ".data", "task-planner");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${requestId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
    state.snapshotPath = filePath;
  } catch (err) {
    console.error("[TaskPlanner] 写入本地快照失败:", err);
  }
}

async function writeTodoMarkdown(requestId: string, state: TaskPlannerState) {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.resolve(process.cwd(), ".data", "task-planner", requestId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, "todo.md");
    const statusLabel = state.status === "completed"
      ? "已完成"
      : state.status === "error"
        ? "异常"
        : state.status === "paused"
          ? "暂停"
          : "运行中";
    const progress = Number.isFinite(state.progress) ? state.progress : 0;
    const header = [
      "# 任务清单",
      "",
      `- 仓库: ${state.repoUrl}`,
      `- 状态: ${statusLabel}`,
      `- 进度: ${progress}%`,
      `- 更新时间: ${new Date(state.updatedAt).toLocaleString()}`,
      "",
      "## 任务列表",
    ];
    const tasks = (state.todo ?? []).flatMap(item => {
      const checked = item.status === "completed" ? "x" : " ";
      const estimate = typeof item.estimateMinutes === "number" ? `${item.estimateMinutes}分钟` : "未估算";
      const depends = item.dependsOn?.length ? `依赖: ${item.dependsOn.join(", ")}` : null;
      const accepts = item.accepts?.length ? item.accepts.map(text => `  - ${text}`) : [];
      const lines = [
        `- [${checked}] [${item.id}] ${item.title}（状态: ${item.status}｜优先级: ${item.priority}｜预估: ${estimate}）`,
      ];
      if (depends) {
        lines.push(`  - ${depends}`);
      }
      if (accepts.length > 0) {
        lines.push("  - 验收标准:");
        lines.push(...accepts);
      }
      return lines;
    });
    const content = [...header, ...tasks, ""].join("\n");
    fs.writeFileSync(filePath, content, "utf-8");
    state.todoPath = filePath;
  } catch (err) {
    console.error("[TaskPlanner] 写入todo失败:", err);
  }
}

async function loadLatestSnapshotByRepo(repoUrl: string) {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.resolve(process.cwd(), ".data", "task-planner");
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const jsonFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith(".json"));
    const candidates = await Promise.all(
      jsonFiles.map(async entry => {
        const filePath = path.join(dir, entry.name);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const parsed = JSON.parse(raw) as TaskPlannerState;
          if (!parsed || parsed.repoUrl !== repoUrl) return null;
          return parsed;
        } catch {
          return null;
        }
      })
    );
    const valid = candidates.filter(Boolean) as TaskPlannerState[];
    if (valid.length === 0) return null;
    valid.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
    const resumable = valid.find(state => state.status !== "completed") ?? null;
    return resumable;
  } catch {
    return null;
  }
}

async function uploadCloudBackup(requestId: string, state: TaskPlannerState) {
  const bucket = process.env.TASK_PLANNER_S3_BUCKET;
  if (!bucket) return;
  const s3 = getS3Client();
  if (!s3) return;
  try {
    const body = JSON.stringify(state, null, 2);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `task-planner/${requestId}.json`,
        Body: body,
        ContentType: "application/json",
      })
    );
  } catch (err) {
    console.error("[TaskPlanner] 云备份失败:", err);
  }
}

async function analyzeRepoAndGeneratePlan(modelConfigId: number, userId: number, projectId: number, repoUrl: string): Promise<TaskItem[]> {
  let readme = "";
  try {
    const res = await axios.get(repoUrl, { timeout: 8000 });
    readme = (res.data && typeof res.data === "string") ? res.data.slice(0, 4000) : "";
  } catch (err) {
    readme = "";
  }
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一名软件项目任务规划智能体。请基于给定仓库信息自动拆解任务，生成结构化JSON。必须包含id、title、accepts、dependsOn、estimateMinutes、priority。输出使用中文。"],
    ["system", `仓库URL: ${repoUrl}\nREADME/页面片段:\n${readme}`],
    ["human", "请生成一组可执行的任务清单，适合替代环境变量和循环次数设置的现代化智能体任务规划系统，实现智能规划、执行监控、断点恢复、状态持久化、交互面板。"]
  ]);
  const messages: AIMessage[] = (await prompt.formatMessages({})).map(m => {
    const role = m._getType() === "human"
      ? "user"
      : m._getType() === "ai"
        ? "assistant"
        : "system";
    return {
      role,
      content: m.content as string,
    };
  });
  let content = "";
  try {
    content = (
      await generateWithAI(modelConfigId, { messages, temperature: 0.2, maxTokens: 2500 }, userId, projectId)
    ).content;
  } catch (err: any) {
    console.error("[TaskPlanner] 生成任务清单失败:", err);
    return [
      {
        id: "plan-1",
        title: "构建智能任务规划引擎（解析仓库并生成todo）",
        status: "pending",
        priority: "high",
        estimateMinutes: 120,
        accepts: ["自动生成todo.md包含任务分解、验收标准、依赖图、预估时长"],
        dependsOn: [],
      },
      {
        id: "monitor-1",
        title: "实现实时执行监控（每秒检查、日志与轨迹）",
        status: "pending",
        priority: "high",
        estimateMinutes: 90,
        accepts: ["子任务完成后自动更新todo状态与时间戳", "生成执行日志", "保留完整轨迹"],
        dependsOn: ["plan-1"],
      },
      {
        id: "resume-1",
        title: "实现断点续传与去重执行",
        status: "pending",
        priority: "medium",
        estimateMinutes: 60,
        accepts: ["加载已完成列表并高亮待完成项", "从断点继续且不重复执行"],
        dependsOn: ["monitor-1"],
      },
      {
        id: "persist-1",
        title: "状态持久化（本地+云备份，每30秒自动保存）",
        status: "pending",
        priority: "medium",
        estimateMinutes: 45,
        accepts: ["定时保存", "恢复时完整校验"],
        dependsOn: ["resume-1"],
      },
      {
        id: "ui-1",
        title: "交互式控制面板（实时进度、树导航、优先级调整、手动干预）",
        status: "pending",
        priority: "medium",
        estimateMinutes: 90,
        accepts: ["进度条与百分比", "任务树", "优先级调整与状态查询", "手动干预控制", "UI与后台状态一致"],
        dependsOn: ["persist-1"],
      },
    ];
  }
  try {
    let clean = content.trim();
    if (clean.startsWith("```json")) clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    if (clean.startsWith("```")) clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(clean);
    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.tasks) ? parsed.tasks : []);
    const normalized: TaskItem[] = items.map((t: any, idx: number) => ({
      id: String(t.id ?? `t-${idx + 1}`),
      title: String(t.title ?? `未命名任务-${idx + 1}`),
      status: "pending",
      priority: (t.priority === "high" || t.priority === "low" || t.priority === "medium") ? t.priority : "medium",
      estimateMinutes: typeof t.estimateMinutes === "number" ? t.estimateMinutes : undefined,
      accepts: Array.isArray(t.accepts) ? t.accepts.map(String) : [],
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : [],
    }));
    return normalized.length > 0 ? normalized : await analyzeRepoAndGeneratePlan(modelConfigId, userId, projectId, repoUrl);
  } catch {
    return await analyzeRepoAndGeneratePlan(modelConfigId, userId, projectId, repoUrl);
  }
}

export async function startTaskPlannerAsync(
  modelConfigId: number,
  userId: number,
  projectId: number,
  repoUrl: string
): Promise<string> {
  const resumable = await loadLatestSnapshotByRepo(repoUrl);
  if (resumable) {
    resumable.status = "running";
    resumable.updatedAt = Date.now();
    resumable.history.push({ timestamp: Date.now(), message: "已从快照恢复任务规划" });
    taskPlannerStore.set(resumable.requestId, resumable);
  }
  const requestId = resumable?.requestId ?? `task-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initial: TaskPlannerState = resumable ?? {
    requestId,
    repoUrl,
    status: "running",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    todo: [],
    history: [{ timestamp: Date.now(), message: "任务规划启动" }],
  };
  taskPlannerStore.set(requestId, initial);

  (async () => {
    try {
      const st = taskPlannerStore.get(requestId);
      if (!st) return;
      if (!st.todo || st.todo.length === 0) {
        const plan = await analyzeRepoAndGeneratePlan(modelConfigId, userId, projectId, repoUrl);
        st.todo = plan;
        st.updatedAt = Date.now();
        st.history.push({ timestamp: Date.now(), message: "已生成任务清单与验收标准" });
      } else {
        st.updatedAt = Date.now();
        st.history.push({ timestamp: Date.now(), message: "沿用快照任务清单" });
      }
      await writeLocalSnapshot(requestId, st);
      await writeTodoMarkdown(requestId, st);
      await uploadCloudBackup(requestId, st);
      taskPlannerStore.set(requestId, st);
    } catch (err: any) {
      const st = taskPlannerStore.get(requestId);
      if (!st) return;
      st.status = "error";
      st.message = err?.message ?? "生成任务失败";
      st.updatedAt = Date.now();
      taskPlannerStore.set(requestId, st);
      return;
    }

    let seconds = 0;
    const interval = setInterval(async () => {
      const st = taskPlannerStore.get(requestId);
      if (!st || st.status !== "running") {
        clearInterval(interval);
        return;
      }
      seconds += 1;

      const total = st.todo.length || 1;
      const done = st.todo.filter(t => t.status === "completed").length;
      st.progress = Math.round((done / total) * 100);
      st.updatedAt = Date.now();

      if (seconds % 30 === 0) {
        await writeLocalSnapshot(requestId, st);
        await writeTodoMarkdown(requestId, st);
        await uploadCloudBackup(requestId, st);
        st.history.push({ timestamp: Date.now(), message: "自动保存快照" });
      }

      if (done === total && total > 0) {
        st.status = "completed";
        st.history.push({ timestamp: Date.now(), message: "全部任务已完成" });
        await writeLocalSnapshot(requestId, st);
        await writeTodoMarkdown(requestId, st);
        await uploadCloudBackup(requestId, st);
        clearInterval(interval);
      }
      taskPlannerStore.set(requestId, st);
    }, 1000);
  })();

  return requestId;
}

export function getTaskPlannerTrace(requestId: string) {
  return taskPlannerStore.get(requestId) ?? null;
}

export async function updateTaskPlannerItem(requestId: string, updates: { id: string; status?: TaskItem["status"]; priority?: TaskItem["priority"] }) {
  const st = taskPlannerStore.get(requestId);
  if (!st) return null;
  const idx = st.todo.findIndex(t => t.id === updates.id);
  if (idx === -1) return null;
  const item = st.todo[idx];
  if (updates.priority) item.priority = updates.priority;
  if (updates.status) {
    if (updates.status === "in_progress" && !item.startedAt) item.startedAt = Date.now();
    if (updates.status === "completed" && !item.completedAt) item.completedAt = Date.now();
    item.status = updates.status;
    st.history.push({ timestamp: Date.now(), message: `任务 ${item.id} 状态更新为 ${updates.status}` });
  }
  st.updatedAt = Date.now();
  await writeLocalSnapshot(requestId, st);
  await writeTodoMarkdown(requestId, st);
  await uploadCloudBackup(requestId, st);
  taskPlannerStore.set(requestId, st);
  return item;
}

export async function setTaskPlannerPaused(requestId: string, paused: boolean) {
  const st = taskPlannerStore.get(requestId);
  if (!st) return null;
  st.status = paused ? "paused" : "running";
  st.history.push({ timestamp: Date.now(), message: paused ? "已暂停任务规划" : "已恢复任务规划" });
  st.updatedAt = Date.now();
  await writeLocalSnapshot(requestId, st);
  await writeTodoMarkdown(requestId, st);
  await uploadCloudBackup(requestId, st);
  taskPlannerStore.set(requestId, st);
  return st.status;
}

// 异步启动多智能体任务
export function runMultiAgentAsync(
  modelConfigId: number,
  userId: number,
  projectId: number,
  userMessage: string,
  currentFile?: { path: string; content: string },
  history: AIMessage[] = [],
  onComplete?: (result: { final: AgentAction; trace: AgentOutput[] }) => Promise<void>
): string {
  const requestId = `${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const strategy = resolveOrchestratorStrategy();
  const maxLoops = Number(process.env.MULTI_AGENT_MAX_LOOPS ?? 3);
  traceStore.set(requestId, { status: 'running', trace: [], createdAt: Date.now(), strategy, maxLoops });

  const orchestrator = createOrchestrator(modelConfigId, userId, projectId);

  // Start async process without awaiting
  orchestrator.run({
    userMessage,
    currentFile,
    history,
  }, (step) => {
    const entry = traceStore.get(requestId);
    if (entry) {
      entry.trace.push(step);
      traceStore.set(requestId, entry);
    }
  }).then(async ({ final, trace }) => {
    const entry = traceStore.get(requestId);
    if (entry) {
      entry.status = 'completed';
      entry.trace = trace;
      entry.final = final;
      entry.strategy = entry.strategy ?? strategy;
      entry.maxLoops = entry.maxLoops ?? maxLoops;
      traceStore.set(requestId, entry);
    }
    if (onComplete) {
      try {
        await onComplete({ final, trace });
      } catch (err) {
        console.error(`[MultiAgent] onComplete callback failed:`, err);
      }
    }
  }).catch((err) => {
    console.error(`[MultiAgent] Async Error:`, err);
    const entry = traceStore.get(requestId);
    if (entry) {
      entry.status = 'error';
      entry.error = err.message || "Unknown error";
      entry.strategy = entry.strategy ?? strategy;
      entry.maxLoops = entry.maxLoops ?? maxLoops;
      traceStore.set(requestId, entry);
    }
  });

  return requestId;
}

// 多智能体入口，返回动作、轨迹与请求号
export async function multiAgentInteract(
  modelConfigId: number,
  userId: number,
  projectId: number,
  userMessage: string,
  currentFile?: { path: string; content: string },
  history: AIMessage[] = []
): Promise<{ action: AgentAction; trace: AgentOutput[]; requestId: string }> {
  const orchestrator = createOrchestrator(modelConfigId, userId, projectId);
  const { final, trace } = await orchestrator.run({
    userMessage,
    currentFile,
    history,
  });
  const requestId = `${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const strategy = resolveOrchestratorStrategy();
  const maxLoops = Number(process.env.MULTI_AGENT_MAX_LOOPS ?? 3);
  traceStore.set(requestId, { status: 'completed', trace, createdAt: Date.now(), strategy, maxLoops });
  return { action: final, trace, requestId };
}

export type AuthorDocKey = "mainStory" | "characterProfiles" | "outline" | "worldview" | "memo";

export type AuthorDocument = {
  title: string;
  content: string;
  format?: "markdown" | "word" | "text";
};

export type AuthorRelationship = {
  from: string;
  to: string;
  type: string;
  description?: string;
};

export type AuthorTimelineItem = {
  title: string;
  description?: string;
  timePosition?: number;
  importance?: "high" | "medium" | "low";
};

export type AuthorAgentResult = {
  reply: string;
  intent?: string;
  contextSummary?: string;
  documents: Record<AuthorDocKey, AuthorDocument>;
  suggestions: string[];
  relationships: AuthorRelationship[];
  timeline: AuthorTimelineItem[];
  consistency: { issues: string[]; score?: number };
  creativity: { score?: number; notes?: string };
  durationMs: number;
  requestId: string;
};

type AuthorAgentInput = {
  history?: AIMessage[];
  documents?: Partial<Record<AuthorDocKey, { title?: string; content?: string }>>;
};

const authorDocDefaults: Record<AuthorDocKey, AuthorDocument> = {
  mainStory: { title: "主故事文档", content: "", format: "markdown" },
  characterProfiles: { title: "人物设定档案", content: "", format: "markdown" },
  outline: { title: "章节大纲", content: "", format: "markdown" },
  worldview: { title: "世界观设定", content: "", format: "markdown" },
  memo: { title: "写作备忘录", content: "", format: "markdown" },
};

function normalizeAuthorDoc(
  key: AuthorDocKey,
  doc?: Partial<AuthorDocument>
): AuthorDocument {
  const base = authorDocDefaults[key];
  return {
    title: doc?.title ?? base.title,
    content: doc?.content ?? base.content,
    format: doc?.format ?? base.format,
  };
}

function sanitizeJsonPayload(raw: string) {
  let clean = raw.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return clean;
}

function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return undefined;
}

function trimContent(content: string, maxLength: number) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}...`;
}

function buildAuthorContext(
  docs: Record<AuthorDocKey, AuthorDocument>,
  history: AIMessage[]
) {
  const docText = (Object.keys(docs) as AuthorDocKey[])
    .map(key => {
      const doc = docs[key];
      const content = trimContent(doc.content ?? "", 2000);
      return `【${doc.title}】\n${content || "（空）"}`;
    })
    .join("\n\n");
  const recentHistory = history.slice(-10).map(item => `${item.role}: ${item.content}`).join("\n");
  return { docText, recentHistory };
}

function normalizeAuthorAgentResult(
  raw: any,
  fallbackReply: string,
  durationMs: number,
  requestId: string
): AuthorAgentResult {
  const docs = raw?.documents ?? {};
  const result: AuthorAgentResult = {
    reply: coerceString(raw?.reply) ?? fallbackReply,
    intent: coerceString(raw?.intent),
    contextSummary: coerceString(raw?.contextSummary),
    documents: {
      mainStory: normalizeAuthorDoc("mainStory", docs.mainStory),
      characterProfiles: normalizeAuthorDoc("characterProfiles", docs.characterProfiles),
      outline: normalizeAuthorDoc("outline", docs.outline),
      worldview: normalizeAuthorDoc("worldview", docs.worldview),
      memo: normalizeAuthorDoc("memo", docs.memo),
    },
    suggestions: coerceArray<string>(raw?.suggestions),
    relationships: coerceArray<AuthorRelationship>(raw?.relationships),
    timeline: coerceArray<AuthorTimelineItem>(raw?.timeline),
    consistency: {
      issues: coerceArray<string>(raw?.consistency?.issues ?? raw?.consistencyIssues),
      score: typeof raw?.consistency?.score === "number" ? raw.consistency.score : undefined,
    },
    creativity: {
      score: typeof raw?.creativity?.score === "number" ? raw.creativity.score : undefined,
      notes: coerceString(raw?.creativity?.notes),
    },
    durationMs,
    requestId,
  };
  return result;
}

export async function authorAgentInteract(
  modelConfigId: number,
  userId: number,
  projectId: number,
  userMessage: string,
  input: AuthorAgentInput = {}
): Promise<AuthorAgentResult> {
  const start = Date.now();
  const requestId = `${projectId}-author-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const history = input.history ?? [];
  const documents: Record<AuthorDocKey, AuthorDocument> = {
    mainStory: normalizeAuthorDoc("mainStory", input.documents?.mainStory),
    characterProfiles: normalizeAuthorDoc("characterProfiles", input.documents?.characterProfiles),
    outline: normalizeAuthorDoc("outline", input.documents?.outline),
    worldview: normalizeAuthorDoc("worldview", input.documents?.worldview),
    memo: normalizeAuthorDoc("memo", input.documents?.memo),
  };
  const { docText, recentHistory } = buildAuthorContext(documents, history);
  const system = [
    "你是小说作者智能体，负责理解用户意图并持续维护小说相关文档。",
    "请严格输出JSON对象，不要输出额外文本。",
    "字段必须包含：reply、documents、suggestions、relationships、timeline、consistency、creativity。",
    "documents包含：mainStory、characterProfiles、outline、worldview、memo，每个包含title、content、format。",
    "relationships元素包含from、to、type、description。",
    "timeline元素包含title、description、timePosition、importance。",
    "consistency包含issues数组与score。",
    "creativity包含score与notes。",
    "reply为你对用户的中文回复。",
  ].join("\n");
  const messages: AIMessage[] = [
    { role: "system", content: system },
    {
      role: "system",
      content: `当前文档：\n${docText}`,
    },
    {
      role: "system",
      content: `最近对话：\n${recentHistory || "（无）"}`,
    },
    { role: "user", content: userMessage },
  ];

  const response = await generateWithAI(
    modelConfigId,
    { messages, temperature: 0.4, maxTokens: 2000 },
    userId,
    projectId
  );
  const durationMs = Date.now() - start;
  const raw = response.content;
  try {
    const parsed = JSON.parse(sanitizeJsonPayload(raw));
    return normalizeAuthorAgentResult(parsed, raw, durationMs, requestId);
  } catch {
    return normalizeAuthorAgentResult(null, raw, durationMs, requestId);
  }
}
