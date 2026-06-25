## 1. 依赖与环境配置

- [x] 1.1 安装运行时依赖 `ws` 与开发依赖 `@types/ws`、`tsx`（`pnpm add ws && pnpm add -D @types/ws tsx`）
- [x] 1.2 在 `.env.example` 中追加说明：`DBT_VENV_ROOT`（venv 根目录，默认 `./venvs`）、`DBT_PYTHON_BIN`（Python 解释器路径，默认探测 python3/python）、`DBT_INIT_TIMEOUT_MS`（pip 安装超时，默认 600000）、`DBT_PIP_INDEX_URL`（pip 镜像源，默认 `https://pypi.tuna.tsinghua.edu.cn/simple` 清华 TUNA，可改为 `https://pypi.org/simple` 等官方源）
- [x] 1.3 在 `src/app/server/configs/dbt/constants.ts` 中追加：`getVenvRoot()`（解析根目录，默认 `path.resolve(process.cwd(), "venvs")`）、`DEFAULT_INIT_TIMEOUT_MS = 600_000`、`DEFAULT_PIP_INDEX_URL = "https://pypi.tuna.tsinghua.edu.cn/simple"`、`getPipIndexUrl()`（读 `DBT_PIP_INDEX_URL`，未设则用默认清华镜像）、Python 解释器探测函数 `resolvePythonBin()`（按 `DBT_PYTHON_BIN` → `python3` → `python` 顺序）

## 2. 数据库 Schema 变更

- [x] 2.1 修改 `src/app/db/schema/sqlite/dbt-runtime-environment.ts`，追加 4 个字段：`initializationStatus`（text enum `pending/running/initialized/failed`，默认 `pending`，NOT NULL）、`venvPath`（text，nullable）、`initializedAt`（integer timestamp，nullable）、`lastErrorMessage`（text，nullable）
- [x] 2.2 修改 `src/app/db/schema/mysql/dbt-runtime-environment.ts`，同步追加相同的 4 个字段（mysql 对应类型）
- [x] 2.3 执行 `pnpm db:generate` 生成 migration，检查生成的 SQL 正确性（新字段默认值/可空性）
- [x] 2.4 执行 `pnpm db:sqlite:migrate`（或对应 dialect 的迁移）应用 migration，确认老数据 `initializationStatus` 为 `pending`

## 3. Repository 层扩展

- [x] 3.1 在 `src/app/server/repositories/dbt/environment.repository.ts` 的 `findById` 与 `findList` 的 select 列表中追加 4 个新字段（`initializationStatus`、`venvPath`、`initializedAt`、`lastErrorMessage`）
- [x] 3.2 在 environment.repository.ts 中新增 `updateInitializationState(id, { status, venvPath?, initializedAt?, lastErrorMessage? })` 方法，仅更新这些字段并刷新 `updatedAt`
- [x] 3.3 （可选）新增 `findInitializationStatus(id)` 轻量查询，供并发检查使用

## 4. 进程执行封装

- [x] 4.1 创建 `src/app/server/lib/process.ts`，封装 `spawnStreaming(command, args, { cwd, env, timeoutMs, onLine })`：使用 `child_process.spawn`，逐行解析 stdout/stderr 回调 `onLine(stream, line)`，支持 `timeoutMs` 超时杀进程，返回 `{ code }` 的 Promise；超时或非 0 退出时 reject 并带最后一段输出

## 5. 实时通道基础设施

- [x] 5.1 创建 `src/app/server/realtime/event-bus.ts`：基于 `EventEmitter` 的进程内事件总线，导出 `publish(topic, event, data)` 与 `subscribe(topic, listener)`/`unsubscribe(topic, listener)`；无订阅者时安全发布
- [x] 5.2 创建 `src/app/server/realtime/ws-server.ts`：导出 `attachWebSocket(httpServer)`，创建 `WebSocketServer({ noServer: true })`，在 httpServer 的 `upgrade` 事件中仅对 `/ws` 路径接管（`wss.handleUpgrade`），其余交回；维护 `Map<topic, Set<WebSocket>>` 订阅表；处理 JSON 消息 `subscribe`/`unsubscribe`，非法消息忽略；连接断开时清理其所有订阅；订阅 `eventBus` 的事件并转发为 `{ type:"event", topic, event, data }`
- [x] 5.3 创建 `src/app/server/realtime/index.ts`：统一导出 `publish`、`attachWebSocket`；事件总线单例化（模块级实例）

## 6. Custom Server 入口

- [x] 6.1 创建项目根 `server.ts`：`next({ dev: NODE_ENV!=='production' })` → `app.prepare()` → `http.createServer((req,res)=>app.getRequestHandler()(req,res))` → `attachWebSocket(server)` → `server.listen(PORT)`；保留 Turbopack（dev 默认开启）
- [x] 6.2 修改 `package.json` scripts：`dev` 改为 `tsx watch server.ts`、`start` 改为 `NODE_ENV=production node --import tsx server.ts`（或等价）；`build` 保持 `next build` 不变
- [x] 6.3 启动验证：原有页面（`/`、`/dbt/*`）与 `/api/*` 路由全部正常；浏览器连 `ws://localhost:3000/ws` 能建立连接并发送 subscribe 消息（用 devtools 或 wscat 验证）

## 7. 初始化 Service 与编排

- [x] 7.1 创建 `src/app/server/services/dbt/environment-init.service.ts`：
  - 模块级 `runningEnvIds: Set<number>` 内存锁
  - `initializeEnvironment(id)`：校验环境存在 → 若内存锁中或 DB 状态为 running 且锁中存在则抛"正在初始化中"（供 route 返回 409）→ 加锁、置 DB `running`、`publish("environment:<id>:init","status",{status:"running",step:"creating-venv"})` → `setImmediate` 启动异步工作函数 → 立即返回 `{ initializationStatus:"running" }`
  - 异步工作函数：解析 venv 路径（环境名安全化，冲突回退 `env-<id>`）→ `spawnStreaming(python, ["-m","venv",venvPath], { onLine }` 推日志 → 成功后 `publish(status,{step:"installing"})` → 拼依赖列表（`name==version` 或 `name`）→ `spawnStreaming(venvPython, ["-m","pip","install",...pkgs], { env:{ PIP_INDEX_URL: getPipIndexUrl() }, timeoutMs, onLine })` → 成功更新 `initialized`+`venvPath`+`initializedAt`，失败更新 `failed`+`lastErrorMessage` → `publish("done",{status,error?})` → `finally` 释放内存锁
- [x] 7.2 在 `src/app/server/services/dbt/environment.service.ts` 的 `deleteEnvironment` 中，软删除前/后增加 `fs.rm(env.venvPath, { recursive:true, force:true })`（venvPath 为空跳过），失败 `console.error` 不抛错；保持原有项目绑定引用检查（409）
- [x] 7.3 在 environment.service.ts 中 re-export `initializeEnvironment`

## 8. Validation 与 API Route

- [x] 8.1 在 `src/app/server/schemas/dbt/environment.schema.ts` 追加 `initializeEnvironmentSchema`（无需 body，仅复用 `environmentIdSchema` 校验 path id）
- [x] 8.2 创建 `src/app/api/dbt/environments/[id]/initialize/route.ts`：`POST` 解析 id → 调 `environmentService.initializeEnvironment` → 成功返回 200 `{ initializationStatus:"running" }`；环境不存在 404；正在初始化 409；其余 500。route 保持 thin，无业务逻辑

## 9. 前端类型与 API Client

- [x] 9.1 在 `src/web/types/dbt.ts` 扩展 `Environment` 接口：追加 `initializationStatus: "pending"|"running"|"initialized"|"failed"`、`venvPath: string|null`、`initializedAt: string|null`、`lastErrorMessage: string|null`
- [x] 9.2 在 `src/web/api-client/environment.ts` 追加 `initialize(id)` 方法，`POST /environments/:id/initialize`
- [x] 9.3 创建 `src/web/lib/ws-client.ts`：通用 WebSocket 客户端封装——单例连接 `ws://<host>/ws`、自动重连（指数退避）、`subscribe(topic, handler)`/`unsubscribe`、消息 JSON 解析与事件分发

## 10. 前端 UI

- [x] 10.1 创建 `src/web/features/dbt-environment/hooks/use-env-init.ts`：封装初始化触发（调 `environmentApi.initialize`）+ 通过 `ws-client` 订阅 `environment:<id>:init`，返回 `{ status, logs, start, isRunning }`；组件卸载时取消订阅
- [x] 10.2 创建 `src/web/features/dbt-environment/components/init-log-panel.tsx`：实时日志面板组件，展示订阅到的状态变化与日志行（stdout/stderr 区分颜色），自动滚动到底部
- [x] 10.3 修改 `src/web/features/dbt-environment/components/environment-list.tsx`：表格新增"初始化状态"列，按 `initializationStatus` 展示（待初始化/初始化中/初始化完成/初始化失败 + 失败原因 tooltip）；操作列按状态显示"初始化"/"重新初始化"/"重试"按钮；点击后打开 `InitLogPanel` 浮层并触发初始化
- [x] 10.4 `initialized` 状态明确展示文案"初始化完成"（带成功图标/绿色 Chip），符合需求验收点

## 11. 验证

- [x] 11.1 启动应用（`pnpm dev`），确认无编译错误，原有功能（项目/版本/连接/环境 CRUD、agent、auth）全部正常
- [x] 11.2 验证 WebSocket 连接：浏览器或 wscat 连 `ws://localhost:3000/ws`，发送 subscribe 消息能被接受，非 /ws 路径不受影响
- [x] 11.3 验证初始化完整流程：创建版本（含 dependencies）→ 创建连接 → 创建环境 → 点初始化 → 观察状态变为 running → 日志面板实时收到 venv/pip 输出 → 完成后状态变 initialized、页面显示"初始化完成"、DB 中 `venvPath`/`initializedAt` 正确
- [x] 11.4 验证初始化失败：配置一个不存在的依赖包，确认状态变 failed、`lastErrorMessage` 有值、页面显示"初始化失败"并可重试
- [x] 11.5 验证并发控制：对 running 状态环境再次点初始化，确认返回 409
- [x] 11.6 验证重新初始化：对 initialized/failed 环境再次初始化，确认可触发并覆盖
- [x] 11.7 验证 venv 目录策略：检查 `./venvs/<安全化环境名>/` 存在且包含 bin/Scripts；修改 `DBT_VENV_ROOT` 后新环境 venv 落到新目录；同名冲突回退 `env-<id>`
- [x] 11.8 验证 Python 配置：未设 `DBT_PYTHON_BIN` 时探测 python3；设置后用指定解释器
- [x] 11.9 验证删除环境清理 venv：删除一个已初始化的环境，确认 `venvPath` 目录被递归删除；venv 清理失败时不阻塞删除（仅日志）
- [x] 11.10 验证列表/详情 API 返回 4 个新字段
