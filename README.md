# AI 小说平台

## 项目简介
面向长篇小说创作与管理的写作平台，提供章节编辑、AI 辅助创作、多智能体协作、发布预检查、语音输入与发布任务队列等能力。

## 核心功能
- 多文档写作与富文本编辑
- AI 生成、续写、优化与多智能体协作
- 发布前预检查与敏感词检测
- 语音识别与语音合成
- 发布任务队列与任务状态监控
- 平台账号管理与发布模拟流程

## 技术栈
- 前端：React、Vite、Tailwind CSS
- 后端：Node.js、Express、tRPC
- 数据库：MySQL（Drizzle ORM）
- 队列：BullMQ（Redis）
- 测试：Vitest

## 快速开始
```bash
pnpm install
pnpm dev
```

## 测试与检查
```bash
pnpm test
pnpm check
```

## 常用环境变量
- DATABASE_URL：数据库连接字符串
- REDIS_HOST / REDIS_PORT：队列与缓存
- JWT_SECRET：会话密钥
- VITE_APP_ID：应用标识
- BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY：内置代理服务
- MULTI_AGENT_ENABLED：是否开启多智能体

## 目录结构
- client：前端代码
- server：后端服务与业务逻辑
- drizzle：数据库迁移与元数据
