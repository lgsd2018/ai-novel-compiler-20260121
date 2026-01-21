# AI 代理框架评估报告：AgentScope vs LangChain

## 1. 概述
用户询问是否可以引入 `AgentScope` 或 `LangChain` 来提升当前 AI 小说平台的智能体能力（特别是多智能体思考与自动写作）。本项目当前后端环境为 **Node.js (TypeScript)**。

## 2. AgentScope 分析
[AgentScope](https://github.com/agentscope-ai/agentscope) 是阿里推出的多智能体框架。
- **优点**：
    - 专为多智能体协作设计，提供了便捷的 Message Hub（消息中心）机制。
    - 内置了丰富的交互模式和容错机制。
    - 提供了可视化的工作站。
- **缺点（针对本项目）**：
    - **语言限制**：AgentScope 目前核心是 **Python** 框架。
    - **集成难度**：由于我们的后端是 Node.js，引入 AgentScope 需要搭建独立的 Python 服务（Microservice），并通过 HTTP/gRPC 通信。这将显著增加架构复杂度和部署成本。
    - **生态差异**：无法直接复用现有的 TypeScript 类型定义和数据库连接逻辑。

## 3. LangChain 分析
[LangChain](https://github.com/langchain-ai/langchain) 是目前最流行的 LLM 应用开发框架，且有成熟的 [LangChain.js](https://github.com/langchain-ai/langchainjs) 版本。
- **现状**：本项目 **已经在使用 LangChain.js** (`@langchain/core`, `@langchain/openai` 等)。
- **优点**：
    - **原生 TypeScript 支持**：与当前项目无缝集成。
    - **LangGraph**：LangChain 推出的新一代多智能体编排工具 (LangGraph.js)，专门解决"循环"、"状态记忆"和"多角色协作"问题。它比简单的 Chain 更适合构建复杂的 Agent 流程。
    - **生态丰富**：拥有海量的文档加载器、工具集和社区支持。

## 4. 解决方案与建议

### 针对"思考模式"和"直接写作"问题：
目前的实现是基于自定义的 `MultiAgentOrchestrator` 类（在 `server/aiAgents.ts` 中）。虽然有效，但扩展性有限。

**推荐方案：升级到 LangGraph.js**
与其引入外部的 AgentScope，不如深化 LangChain 的使用，引入 **LangGraph.js**。

1.  **Stateful Agents (有状态智能体)**：
    LangGraph 允许定义一个全局 State（包含 `messages`, `currentFile`, `plan` 等），不同 Agent (Planner, Writer) 只是在这个 State 上进行转换的节点。
    
2.  **循环与反馈 (Thinking Loop)**：
    可以设计一个图：`Planner -> Writer -> Reviewer -> (如果 Reviewer 不满意) -> Writer`。
    这种循环机制能让 AI 在"思考"不足时自动重试，直到生成满意的结果，从而实现更深度的"思考模式"。

3.  **Human-in-the-loop (人机交互)**：
    LangGraph 原生支持在特定节点（如 Reviewer 之后）暂停，等待用户确认（我们目前的 `AgentConfirmationDialog` 是一种简单的实现，LangGraph 可以将其状态化）。

### 结论
1.  **不建议引入 AgentScope**：除非愿意重构为 Python 后端或微服务架构，否则成本过高。
2.  **深化 LangChain 使用**：
    - 我们已经优化了 `server/aiAgents.ts` 的 Prompt，强制 Writer 执行 `modify_file`。
    - 下一步若需更复杂的协作，应重构 `MultiAgentOrchestrator` 为 **LangGraph** 工作流。

## 5. 当前已实施的改进
为了直接解决您的问题，我们已在现有架构上进行了以下优化（无需引入新框架）：
1.  **强制执行模式**：修改了 Writer Agent 的提示词，一旦接收到 Planner 的计划，必须立即调用 `modify_file` 工具写正文，禁止闲聊。
2.  **主动规划模式**：修改了 Planner Agent，当用户指令模糊（如"写小说"）时，不再反问，而是主动制定第一章大纲。
3.  **会话持久化**：修复了刷新后对话丢失的问题，现在服务端会自动保存所有 Agent 的回复和思考过程。
