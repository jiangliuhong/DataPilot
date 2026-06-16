## Context

DataPilot 是一个 Next.js 16 App Router 应用，严格遵循 `UI → api-client → Route → Service → Repository → Drizzle` 的分层架构（见 `AGENTS.md`）。已有 dbt 项目/文件/版本/连接/环境管理能力，全部通过 `src/app/api/dbt/` 下的 REST 接口暴露，前端通过 `src/web/api-client/` 调用。数据库支持 MySQL 与 SQLite 双驱动（由 `DB_DRIVER` 切换），schema 以 MySQL 为规范类型，通过 `src/app/db/schema/index.ts` 做 dialect facade。

主站导航是 `activeKey` 状态驱动的单页模式（`AppLayout` + `ContentPanel` + `menu-config.ts`），但已有独立 Next.js 路由的先例（`/editor/projects/[id]` 文件编辑器）。HeroUI 是唯一 UI 框架，Drizzle 是唯一 ORM。

本变更引入 AI Agent 对话能力。核心技术约束：
1. 流式输出（SSE）+ 工具调用可视化，体验要求高
2. LangChain 工具必须作为"单独的包/模块"维护，方便后续按域扩展（用户已确认采用 `src` 内模块化目录方案，即逻辑上独立的工具包目录）
3. LLM 需可配置（工厂模式，首版 OpenAI 兼容）
4. 对话历史持久化到数据库（会话 + 消息）

## Goals / Non-Goals

**Goals:**
- 提供流式对话接口，前端逐 token 渲染 AI 回复，并可视化展示工具调用步骤
- 建立 `src/app/server/agent/tools/` 工具包模块，通过基类 + registry 模式让新增工具只需"新建文件 + 注册一行"
- 提供 `createLLM()` 工厂，按 `LLM_PROVIDER` 分发，首版支持 OpenAI 兼容协议
- 持久化会话与消息（多会话、历史、软删除），严格走 repository 层
- 完全遵循现有分层与命名约定，不破坏既有架构

**Non-Goals:**
- 不做多租户/多用户隔离（当前无用户体系，会话全局可见）
- 不做 RAG / 向量检索 / 知识库（首版工具是直查 DB）
- 不做工具的写操作（首版工具仅查询，避免 Agent 误删数据；写操作作为后续迭代）
- 不做流式中断 / 重试 / 分支编辑（首版为顺序单轮流式）
- 不做 Anthropic / Gemini 的首版实现（工厂预留扩展点，首版仅接 OpenAI 兼容）

## Decisions

### Decision 1: 工具包采用 `src` 内模块化目录 + 基类 + registry 模式

**选择**: 在 `src/app/server/agent/tools/` 下建立工具包模块。

**理由**:
- 用户明确选择 `src` 内模块化目录方案（避免引入 workspaces 的构建复杂度，tsconfig paths 已足够）
- 通过 `BaseAgentTool` 抽象基类统一工具契约（name、description、zod schema、execute），新增工具只需继承基类并实现 `execute()`
- 通过 `tool-registry.ts` 聚合所有工具实例并导出 `getAgentTools()`，agent.service 只依赖 registry，不直接 import 具体工具 → 工具新增/移除对 agent 编排零侵入
- 目录内按域分子目录（如 `tools/project/`、`tools/file/`），既满足"单独包"的高内聚要求，又保持单一仓库的简单性

**目录结构**:
```
src/app/server/agent/
├── agent.service.ts          # 编排：组装 LLM + tools + history，驱动 Agent 循环
├── llm/
│   ├── index.ts              # createLLM() 工厂
│   └── providers/
│       └── openai.ts         # ChatOpenAI 封装
├── tools/
│   ├── base-tool.ts          # BaseAgentTool 抽象基类
│   ├── tool-registry.ts      # 注册中心：getAgentTools()
│   ├── index.ts              # 对外出口
│   └── project/
│       ├── list-projects.tool.ts
│       ├── get-project.tool.ts
│       └── ...
├── schemas/
│   └── chat.schema.ts        # Zod: 发送消息、创建会话等
└── types.ts                  # ChatStreamEvent 等类型
```

**备选方案**: npm workspaces 真正独立包 — 扩展性最强但需改 pnpm-workspace、根 package.json、构建流程，落地成本远超收益；tsconfig paths 别名方案 — 介于两者之间，但用户已选 `src` 内目录方案，更贴合现有约定。

### Decision 2: 流式协议采用 SSE，自定义事件类型

**选择**: `POST /api/agent/chat` 返回 `text/event-stream`，自定义事件类型。

**理由**: SSE 是服务端推送的标准方案，浏览器原生 `EventSource` 不支持 POST，因此用 `fetch` + `ReadableStream` 手动解析（前端已有 fetch 封装）。自定义事件比纯文本流更能表达 Agent 的多阶段状态。

**事件类型**（`ChatStreamEvent`）:
```ts
type ChatStreamEvent =
  | { type: "token"; value: string }                          // AI 文本 token
  | { type: "tool_start"; tool: string; input: unknown }      // 工具调用开始
  | { type: "tool_end"; tool: string; output: unknown }       // 工具调用结束
  | { type: "message_end"; messageId: number }                // 消息完成
  | { type: "error"; message: string };                       // 错误
```

每个事件以 `data: ${JSON.stringify(event)}\n\n` 格式下发，前端按 `type` 分发渲染。

### Decision 3: Agent 编排使用 LangChain 的 tool-calling 能力

**选择**: 使用 LangChain 的 `ChatModel.bindTools()` + 手动 Agent 循环（或 `langchain` 主包的 `createReactAgent`，取决于兼容性）。

**理由**:
- 现代 LLM（GPT-4o 等）原生支持 tool calling，比 ReAct prompt 方案更稳定
- `bindTools()` 接受结构化工具定义（name + description + zod schema），与 `BaseAgentTool` 基类天然契合
- 手动 Agent 循环：LLM 决策 → 调用 tool → 把 tool 结果作为 message 喂回 → LLM 继续决策，直到产出最终文本。循环内每一步都 emit SSE 事件，实现工具调用可视化

**备选方案**: LangGraph 的 `createReactAgent` — 更声明式但对事件流的细粒度控制较弱（难精确 emit tool_start/tool_end）。首版用手动循环保证事件协议可控，LangGraph 作为后续可选优化。

### Decision 4: LLM 接入用工厂模式，首版 OpenAI 兼容

**选择**: `createLLM()` 工厂按 `LLM_PROVIDER`（默认 `openai`）分发。

**理由**:
- `ChatOpenAI` 兼容任何 OpenAI 协议服务（OpenAI 官方、DeepSeek、Moonshot、本地 Ollama / vLLM 等），通过 `OPENAI_BASE_URL` 即可切换，覆盖绝大多数场景
- 工厂模式让后续加 Anthropic / Gemini 只是新增一个 provider 文件 + 一个 case 分支，agent.service 完全无感
- 密钥和模型名走环境变量，不进代码

**环境变量**:
```
LLM_PROVIDER=openai              # 默认
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # 可选，指向兼容服务
OPENAI_MODEL=gpt-4o-mini         # 默认模型
```

### Decision 5: 对话持久化 — 两张表，软删除，消息存原始 tool_calls

**选择**: `agent_conversations` + `agent_messages` 两张表。

**schema 设计**（以 MySQL 为规范类型）:
```ts
// agent_conversations
id, title(varchar 255, 首条消息截断生成), created_at, updated_at, deleted_at

// agent_messages
id, conversation_id(bigint FK),
role(enum: 'user' | 'assistant' | 'tool'),
content(text, 可空 —— tool 消息可能只有 tool_calls),
tool_calls(json, 可空 —— assistant 消息的工具调用数组),
tool_call_id(varchar, 可空 —— tool 消息关联的调用 id),
created_at
```

**理由**:
- 消息表存原始 `tool_calls` 和 `tool_call_id`，重建对话时能完整还原 LangChain 的 `HumanMessage / AIMessage / ToolMessage` 结构，支持多轮工具调用上下文
- 软删除遵循项目约定（`deletedAt`），会话级软删即可（消息随会话不可见）
- 会话标题用首条 user 消息截断 30 字生成，避免额外 LLM 调用开销
- 严格走 repository：`conversation.repository.ts`、`message.repository.ts`，service 编排

**Migration**: 通过 `drizzle-kit generate` 生成 MySQL + SQLite 两套 migration（项目已有双驱动约定）。

### Decision 6: 前端对话页采用主站 activeKey 视图，复用 AppLayout

**选择**: 在 `menu-config.ts` 新增 `agent-chat` 菜单项，`ContentPanel` 注册 `agent-chat` 视图。

**理由**:
- 对话页是主站常用功能，放在侧边栏一级入口符合用户预期（不像文件编辑器需要独立全屏页）
- 复用 AppLayout 的侧边栏导航，体验一致
- 对话页内部自己管理"会话列表 + 对话区"的二级布局

**备选方案**: 独立路由 `/agent/chat` — 可分享 URL，但首版无此需求，独立路由还需重复 layout/Providers 包裹，优先复用现有导航。

### Decision 7: 流式渲染用自定义 hook，消息状态用 React state

**选择**: `useAgentChat` hook 管理消息流和流式状态，`useConversations` hook 管理会话列表。

**理由**:
- 流式消息是临时状态（正在生成的 token 持续追加），用 `useState` + `useRef`（AbortController、reader）管理最直接
- 消息持久化由后端负责（message_end 事件带回 messageId），前端不需要在流式过程中写库
- 会话列表用独立的 `useConversations` hook（类似现有 `useProjects` 模式），CRUD 走 api-client

## Risks / Trade-offs

- **LangChain 与 Next.js 16 / React 19 的兼容性** → 首版需先验证 `@langchain/core` 在 App Router 服务端的运行（部分包依赖 Node 内置模块，需确认 webpack/turbopack 打包）。缓解：先在最小 service 里跑通，再扩展工具
- **LLM 延迟与超时** → 流式接口需设置合理超时；Vercel/Node 默认 SSE 超时可能截断长响应。缓解：首版面向自托管/本地开发（`next dev`），文档标注生产环境需调整超时
- **工具调用安全** → 首版工具仅查询，无写操作，规避 Agent 误删数据风险。后续引入写工具时需加确认机制
- **消息表 JSON 字段跨驱动** → SQLite 的 JSON 存储为 TEXT，MySQL 用 `json` 列；Drizzle 已抽象，但需在 repository 层用 `JSON.parse/stringify` 显式处理以保证两端一致
- **会话标题生成** → 用首条消息截断而非 LLM 生成，节省一次调用但标题质量一般。可接受，后续可优化为异步 LLM 重命名
- **流式中断未实现** → 首版不支持中途取消（无 AbortController 暴露到 UI）。缓解：错误场景下后端 emit `error` 事件并关闭流，前端清理临时状态

## Migration Plan

1. 安装 LangChain 依赖（`@langchain/core`、`@langchain/openai`、`langchain`）
2. 新增 schema 文件 → `drizzle-kit generate` 生成双驱动 migration → `drizzle-kit migrate`
3. 实现 repository → service → agent.service → tools 包 → API 路由（自下而上，逐层可测）
4. 实现 api-client → hooks → 组件 → 注册菜单与视图
5. 更新 `.env.example`，文档标注所需环境变量
6. 回滚：删除菜单项与视图注册即隐藏入口；数据库表为新增不破坏既有数据，可保留或 drop

## Open Questions

- LangChain 的具体 Agent 编排 API（`createReactAgent` vs 手动循环）需在实现阶段根据包版本与事件协议需求最终确定；倾向手动循环以保证 SSE 事件细粒度
- 是否需要给工具调用结果做脱敏（如数据库连接密码不应出现在工具返回里）→ 首版工具不涉及敏感字段，后续扩展写/连接工具时需评估
