## Context

DataPilot 的运行环境（`dbt_runtime_environments`）目前是一条**纯逻辑记录**：把一个 dbt Core 版本和一个数据库连接组合在一起，仅用于声明"我要在哪个版本 + 哪个数据源上跑 dbt"。环境表上没有任何"是否已在磁盘上落地为可用 Python venv"的信息，宿主机上也没有对应的虚拟环境。这意味着用户即使配好了运行环境，也无法真正执行 `dbt compile`/`dbt run`——因为没有装好 `dbt-core` + 适配器的 Python 解释器。

现有架构约束（来自 `AGENTS.md`，本次严格遵守）：
- 前后端严格分离，三层 Route → Service → Repository，Drizzle 是唯一 ORM
- 所有 DB 访问只能在 repository，业务逻辑只能在 service，route 保持 thin
- Schema 按 domain 一个文件，mysql / sqlite 两套 dialect 各有一份，由 `src/app/db/schema/index.ts` 按 `DB_DRIVER` 选择
- 当前为单实例部署（`next dev` / `next start`，SQLite 本地文件库）

本次新增两件事：
1. **venv 初始化**：用户在某个运行环境上点"初始化"，系统在磁盘上 `python -m venv` + pip 安装该版本声明的依赖，完成后状态置为 `initialized`，页面提示"初始化完成"。
2. **WebSocket 实时通道**：因为初始化是长任务，需要把进度/pip 日志实时推给前端；同时 WebSocket 是面向未来的基础设施（后续 dbt 任务执行、agent 长任务都需要双向通信），本次一次性引入。

WebSocket 在 Next.js 16 App Router 下无法用 Route Handler 实现（Route Handler 基于 Web Request/Response API，不支持协议升级），因此必须改用 **custom server**。

## Goals / Non-Goals

**Goals:**
- 运行环境支持手动触发 Python venv 创建 + 依赖安装（`python -m venv` + venv 内 pip install）
- 运行环境具备初始化状态生命周期：`pending` → `running` → `initialized` / `failed`，状态持久化到 DB
- venv 集中存放、按环境名分目录，根目录可配置
- 初始化异步执行，触发立即返回；进度与 pip 日志通过 WebSocket 实时推送
- 引入通用 WebSocket 基础设施（custom server + `ws` + 按主题订阅），本次被初始化使用，未来可复用
- 删除运行环境时同步清理对应 venv 目录
- 所有新代码遵循现有三层分离与命名规范，两套 dialect schema 同步修改

**Non-Goals:**
- 不做 dbt 连通性校验（`dbt debug`）——属于后续 dbt 任务执行功能
- 不做多实例/多进程分布式任务调度——当前单实例内存锁足够
- 不做 venv 的自动定时清理/回收——删除环境时顺带清理即可
- 不引入独立任务队列（Redis/BullMQ 等）——进程内异步 + EventEmitter 已满足
- 不在本次实现其他 WebSocket 业务（agent 长任务、dbt 任务执行流）——仅落基础设施 + 初始化这一条业务流
- 不支持 `uv` / `poetry` 等其他虚拟环境方案——统一用标准库 `venv`

## Decisions

### D1: Custom Server 启动模型 — `server.ts` 包装 `next()`

改用 custom server：新建项目根目录 `server.ts`，内部 `next({ dev, conf })` 后取 `getRequestHandler()`，用 Node `http.createServer` 接收所有 HTTP 请求转给 Next；**同一个 HTTP server 实例**传给 `WebSocketServer({ server })` 挂载 WS。

依据官方 `01-app/02-guides/custom-server.md`：`next()` 接受 `{ dev, conf, dir, hostname, port, httpServer, turbopack }`，返回的 app 有 `getRequestHandler()`/`prepare()`。关键点：
- 仍调用 `next()`，**保留 Turbopack dev、所有 App Router 能力**，不退回到手写路由
- `package.json` scripts：`dev: node --watch server.ts`（或 `tsx watch server.ts`）、`start: NODE_ENV=production node server.ts`；`build` 保持 `next build`
- `server.ts` 不经过 Next 编译器，需直接用当前 Node 版本能跑的语法；为支持 TS 直接运行，使用 `tsx`（已在 Node 生态标准做法）。若不愿加 `tsx`，可写成 `server.mjs`（纯 JS，从 `process.env` 读配置）

WebSocket 仅拦截 upgrade 到 `/ws` 的请求，其余 upgrade / 所有普通 HTTP 请求全部 fallthrough 给 Next handler，**零侵入现有路由**。

**备选方案**：
- SSE（Route Handler 原生 ReadableStream）：单向，无需 custom server。**拒绝**——用户明确要求 WebSocket 以支撑未来双向场景；且 SSE 在某些代理下连接保持不如 WS 稳定。
- `socket.io`：自带重连/房间/降级，但体积大、协议非裸 WS、对 Next 集成更重。**拒绝**——当前需求用裸 `ws` + 自定义极简协议即可。
- 独立 WS 端口：部署与跨域更复杂。**拒绝**——同端口同源更简单。

### D2: WebSocket 协议 — 极简 JSON 订阅模型

客户端 → 服务端消息（JSON）：
```json
{ "type": "subscribe", "topic": "environment:<id>:init" }
{ "type": "unsubscribe", "topic": "environment:<id>:init" }
```
服务端 → 客户端消息（JSON）：
```json
{ "type": "event", "topic": "environment:5:init", "event": "status", "data": { "status": "running" } }
{ "type": "event", "topic": "environment:5:init", "event": "log", "data": { "stream": "stdout", "line": "Collecting dbt-core..." } }
{ "type": "event", "topic": "environment:5:init", "event": "done", "data": { "status": "initialized" } }
```

**理由**：topic 字符串命名空间化（`<domain>:<id>:<action>`），未来 agent/dbt 任务直接复用同一连接与协议。订阅/取消订阅由客户端主动发起，服务端维护 `Map<topic, Set<WebSocket>>`。

**鉴权**：本次 MVP 不做 WS 鉴权（与现有 `/api` route 一致，项目当前无端点级鉴权 —— 仅 `/api/auth/*` 自带 JWT）。后续统一接入鉴权时在 `server.ts` 的 upgrade 回调里校验 token。在 design 中标注为已知缺口。

### D3: 实时通道抽象 — `realtime` 模块

新增 `src/app/server/realtime/` 目录：
```
src/app/server/realtime/
├── ws-server.ts       # WebSocketServer 初始化 + 连接/消息处理（订阅表）
├── event-bus.ts       # 进程内事件总线：publish(topic, event, data) / 内部用 EventEmitter
└── index.ts           # 对外出口：getEventBus()、可选 attachWebSocket(server)
```
- `event-bus.ts` 是**纯 Node EventEmitter 封装**，不依赖 `ws`，service 层只 import `publish`，**保持业务与传输解耦**
- `ws-server.ts` 订阅 `eventBus` 的事件，转发给 topic 对应的 WS 客户端
- 这样 service/异步任务调用 `publish("environment:5:init", "log", {...})` 即可，完全不知道有没有人订阅

**理由**：解耦让初始化任务的代码可单测（不需要起 WS），也让未来 SSE/其他传输可并存。

### D4: venv 目录策略 — 集中根目录 + 环境名分目录

- 根目录：环境变量 `DBT_VENV_ROOT`，未设置时默认 `path.resolve(process.cwd(), "venvs")`
- 单个环境的 venv 路径：`<root>/<sanitized-env-name>/`，例如 `<root>/dev-env/`
- 环境名做文件系统安全化：保留 `[a-zA-Z0-9._-]`，其余字符替换为 `_`；冲突时回退为 `<root>/env-<id>/`
- 路径解析放在 `src/app/server/configs/dbt/constants.ts` 的 `getVenvRoot()` + service 内的 `resolveVenvPath(env)`，**单一来源**

**备选方案**：
- 按 `env-<id>` 命名：稳定但不可读、改环境名不影响目录。**保留为冲突回退方案**
- 把 venv 路径交给用户每次指定：增加心智负担。**拒绝**

### D5: Python 解释器与 pip — 配置驱动

- 解释器：环境变量 `DBT_PYTHON_BIN`，未设置时依次探测 `python3` → `python`（`which` 等价）
- venv 创建：`<python> -m venv <venvPath>`（标准库，跨平台）
- 依赖安装：用 venv 内的解释器执行模块 `"<venvPath>/<bin>/python" -m pip install <pkgs...>`，**不依赖 venv 被 activate**（更可靠、跨平台）
  - `bin` 目录：Linux/macOS 为 `bin`，Windows 为 `Scripts`（用 `process.platform` 判断）
- 依赖列表来源：环境的版本记录上的 `dependencies` JSON（`[{name, version}]`），拼成 `name==version` 或 `name`（`version === "latest"` 时不加约束）
- pip 超时：`DBT_INIT_TIMEOUT_MS`（默认 10 分钟），超时杀进程并标 `failed`
- 镜像源：**默认使用清华 TUNA 镜像**（`https://pypi.tuna.tsinghua.edu.cn/simple`）加速国内安装；环境变量 `DBT_PIP_INDEX_URL` 可覆盖（如需官方源设为 `https://pypi.org/simple`）。最终值通过子进程的 `PIP_INDEX_URL` 环境变量传递给 pip

**理由**：`-m pip` 比 `pip` 可执行文件更稳；不 activate 避免跨 shell 语法差异。

### D6: 异步任务执行 + 状态机 — 进程内 + 内存锁

初始化 service 流程（`environment-init.service.ts`）：
1. 校验环境存在；查当前 `initializationStatus`
2. 若已 `running` → 抛错（route 返回 **409**），保证同一环境并发唯一
3. 置 `initializationStatus = running`、清空 `lastErrorMessage`、`publish("status", {status:"running"})`
4. **`setImmediate`/不 await** 地启动异步工作函数，service 立即返回 `{ status: "running" }`
5. 异步工作函数：
   - `publish("status", {status:"running", step:"creating-venv"})`
   - spawn `python -m venv`，逐行收集 stdout/stderr → `publish("log", {stream, line})`
   - 成功后 `publish("status", {step:"installing"})`，spawn `python -m pip install`，同样流式推送日志
   - 全部成功：更新 DB `initializationStatus=initialized`、`venvPath`、`initializedAt=now`；`publish("done",{status:"initialized"})`
   - 任一步失败：更新 `initializationStatus=failed`、`lastErrorMessage`；`publish("done",{status:"failed", error})`
6. **并发锁**：模块级 `Set<number> runningEnvIds`，进入前 `add`，`finally` 中 `delete`。DB 的 `running` 状态 + 内存 Set 双保险（应对进程崩溃残留 running 状态的情况：进程重启后可由"重新初始化"覆盖）。

**理由**：单实例下进程内异步最简单；内存 Set 是即时的强约束，DB 字段是持久化的真相来源。不引入 BullMQ/Redis 避免过度设计。

### D7: 数据库 Schema 变更 — 4 个新字段（向后兼容）

`dbt_runtime_environments` 追加：
```
initialization_status  text(20)  enum("pending","running","initialized","failed")  NOT NULL DEFAULT "pending"
venv_path              text(512)                                                                      NULL
initialized_at         timestamp                                                                      NULL
last_error_message     text                                                                           NULL
```
- 两套 dialect（`schema/sqlite/dbt-runtime-environment.ts` + `schema/mysql/dbt-runtime-environment.ts`）同步修改，导出类型自动更新
- `findById` / `findList` 的 select 列表追加这 4 个字段
- 新增 repository 方法 `updateInitializationState(id, { status, venvPath?, initializedAt?, lastErrorMessage? })`

**默认 `pending`**：老数据迁移后即为"待初始化"，语义正确。

### D8: 删除环境时清理 venv — service 层编排

`environment.service.ts` 的 `deleteEnvironment` 在现有引用检查通过、软删除之前/之后，调用 `fs.rm(venvPath, { recursive: true, force: true })`（venvPath 为空则跳过）。清理失败**不阻塞删除**，仅记录日志（`console.error`）——DB 层面环境已删，venv 残留可后续手动清理，避免"删不掉"卡住用户。

**理由**：文件系统操作不放入 repository（违反分层），放在 service 编排层最合适。

### D9: 文件组织

```
项目根/
└── server.ts                          # 新增：custom server 入口

src/app/server/realtime/               # 新增：实时通道能力
├── ws-server.ts
├── event-bus.ts
└── index.ts

src/app/server/lib/
└── process.ts                         # 新增：spawn 封装（流式输出、超时、退出码）

src/app/server/services/dbt/
└── environment-init.service.ts        # 新增：初始化编排（状态机 + 锁 + publish）

src/app/server/configs/dbt/constants.ts # 追加：getVenvRoot、python/pip 配置常量
src/app/server/repositories/dbt/environment.repository.ts # 追加方法 + select 列
src/app/server/schemas/dbt/environment.schema.ts          # 追加 initialize 校验

src/app/db/schema/{sqlite,mysql}/dbt-runtime-environment.ts # 追加 4 字段

src/app/api/dbt/environments/[id]/
└── initialize/route.ts                # 新增：POST 触发初始化

src/web/lib/
└── ws-client.ts                       # 新增：通用 WS 客户端（连接、重连、subscribe）

src/web/features/dbt-environment/
├── components/
│   ├── environment-list.tsx           # 改：加初始化状态列 + 初始化按钮
│   └── init-log-panel.tsx             # 新增：实时日志面板
└── hooks/
    └── use-env-init.ts                # 新增：初始化触发 + WS 订阅封装

src/web/api-client/environment.ts      # 追加 initialize()
src/web/types/dbt.ts                   # 扩展 Environment 类型
```

## Risks / Trade-offs

**[Custom Server 丢失 Automatic Static Optimization]** → 属于已知 trade-off。本项目所有页面均为动态（含 DB、auth），静态优化本就不关键；Turbopack dev 等能力在 custom server 下仍可用。→ 文档化此变更。

**[WebSocket 无鉴权]** → 当前所有 `/api` route 也无端点级鉴权，风险面一致。→ 在 server.ts upgrade 处预留 token 校验钩子，注释标明 TODO；接入用户体系鉴权时统一补齐。

**[进程崩溃残留 `running` 状态]** → 内存 Set 随进程消失，但 DB 里可能停在 `running`。→ 缓解：允许在 `running` 状态再次点"初始化"（覆盖式重试，先强制置 running 再跑），而非死锁 409；同时进程启动时不自动清理（避免误判正在跑的任务）。

**[pip 安装失败（网络/包不存在）]** → 子进程非 0 退出 → 状态置 `failed` + `lastErrorMessage` + 完整日志已推前端。→ 用户可修正版本依赖后重新初始化。

**[并发同名环境目录冲突]** → 环境名安全化后仍可能撞名。→ 回退到 `env-<id>` 命名；`venvPath` 以实际落地的为准写入 DB。

**[`tsx` 作为运行时依赖]** → 增加 ~一个 devDependency，换取 server.ts 的类型检查与直接运行。→ 已确认采用 `tsx`；备选 `server.mjs`（纯 JS，零依赖）作为回退方案保留在文档中。

**[删除环境时 fs.rm 失败]** → 不阻塞删除，仅记日志。→ 用户可手动删目录；DB 已一致。

## Migration Plan

1. **安装依赖**：`pnpm add ws`、`pnpm add -D @types/ws tsx`
2. **Schema 迁移**：修改两套 dialect 的 `dbt-runtime-environment.ts`，`pnpm db:generate` 生成 migration，`pnpm db:migrate`（或 sqlite 的 `pnpm db:sqlite:migrate`）执行
3. **启动方式切换**：改 `package.json` scripts（`dev`/`start` 指向 `server.ts`），验证 `next dev` 所有原有功能（页面、API、HMR）正常
4. **环境变量**：`.env.example` 追加 `DBT_VENV_ROOT`、`DBT_PYTHON_BIN`、`DBT_INIT_TIMEOUT_MS`、`DBT_PIP_INDEX_URL`
5. **部署**：custom server 下部署命令变为 `node server.ts`（生产 `NODE_ENV=production`），CI/容器需确保宿主机有 `python3`
6. **回滚**：还原 `package.json` scripts 即可回到 `next dev/start`；新 DB 字段有默认值，回滚后老代码忽略这些列不受影响；`server.ts`、`realtime/`、init 相关文件删除即可

## Open Questions

（已全部解决）
- ✅ 启动器新增 `tsx` 依赖 —— 已确认采用，server.ts 直接以 TypeScript 运行并保留类型检查。
- ✅ pip 镜像源 —— 默认中国镜像（清华 TUNA `https://pypi.tuna.tsinghua.edu.cn/simple`），可通过 `DBT_PIP_INDEX_URL` 覆盖，无需前端配置。
