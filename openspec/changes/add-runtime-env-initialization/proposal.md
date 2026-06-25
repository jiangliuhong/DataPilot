## Why

DataPilot 的运行环境（runtime environment）目前仅是一条逻辑记录——把 dbt Core 版本与数据库连接组合在一起，但从未真正在宿主机上创建任何 Python 运行环境。用户要在该环境里跑 dbt 编译/运行任务，就必须先有一个装好 `dbt-core` 和对应适配器的 Python 虚拟环境。当前缺少"把运行环境落地为可用 Python venv"的能力，用户也无从知道某个环境是否已就绪。需要新增**手动触发的 venv 初始化**，并在初始化过程中把实时进度/日志推给前端，完成后页面明确提示"初始化完成"。

## What Changes

- 新增 **初始化触发**：在每个运行环境上提供"初始化"操作，由用户手动点击触发（系统不会自动创建 venv）。已初始化完成的环境可再次初始化以重建/升级。
- 新增 **Python venv 创建 + 依赖安装**：初始化时调用 `python -m venv` 在磁盘上创建虚拟环境，再用 venv 内的 pip 安装该环境关联版本的 `dependencies`（`dbt-core` + 适配器包等）。
- 新增 **venv 目录策略**：所有环境的 venv 集中放在一个总目录下，每个环境按环境名分目录。总目录默认为进程当前工作目录（`process.cwd()`）下的 `./venvs/`，可通过 `DBT_VENV_ROOT` 环境变量覆盖。
- 新增 **初始化状态管理**：运行环境新增初始化状态字段（`pending`/`running`/`initialized`/`failed`），记录 venv 路径、初始化完成时间、失败原因；状态持久化到 DB。
- 新增 **异步执行 + WebSocket 实时推送**：初始化为长时间异步任务，触发后立即返回；任务执行过程中通过 WebSocket 把状态变化和 pip 输出日志实时推给前端。为支持真正的 WebSocket（而非单向 SSE），项目改用 **custom server** 启动方式（`node server.ts` 包装 `next()`），在同一个 HTTP server 上挂载 `ws` WebSocket 服务端。WebSocket 是一项面向未来的基础设施——后续 dbt 任务执行、agent 长任务等都需要双向实时通信，本次一次性引入。
- 新增 **并发与幂等控制**：同一环境同时只允许一个初始化任务在跑（`running` 状态再次触发返回 409）；任务基于进程级内存锁，单实例部署。
- 新增 **前端状态展示与操作**：环境列表新增"初始化状态"列与"初始化"按钮，状态为 `initialized` 时显示"初始化完成"，`failed` 时显示失败并可重试；点击初始化后展开实时日志面板。

### 不在本次范围

- 不做多实例/多进程的分布式任务调度（当前单实例内存锁足够）。
- 不在初始化时做 dbt 连通性校验（`dbt debug`），那是后续 dbt 任务执行功能的范畴。
- 不做 venv 的自动清理/回收定时任务（删除环境时顺带清理 venv 目录即可）。

## Capabilities

### New Capabilities

- `runtime-env-initialization`: 运行环境的 Python venv 初始化管理——手动触发 venv 创建与依赖安装、初始化状态生命周期（pending/running/initialized/failed）、venv 目录策略、异步执行与 WebSocket 实时进度/日志推送、并发与幂等控制、删除环境时清理 venv。
- `realtime-channel`: 基于 custom server + `ws` 的 WebSocket 基础设施——连接管理、按主题订阅/取消订阅、服务端事件广播。作为通用实时通信底座，本次被初始化任务使用，未来供 dbt 任务执行、agent 长任务等复用。

### Modified Capabilities

- `dbt-runtime-environment`: 运行环境实体新增初始化相关字段（`initializationStatus`、`venvPath`、`initializedAt`、`lastErrorMessage`），列表/详情 API 返回这些字段；删除环境的语义扩展为"同时清理对应 venv 目录"。

## Impact

- **数据库 Schema**：`dbt_runtime_environments` 表新增 4 个字段（`initialization_status` enum、`venv_path` text、`initialized_at` timestamp、`last_error_message` text nullable）。两套 dialect（mysql / sqlite）schema 同步修改，需生成并执行 migration。**向后兼容**：新字段均可空或有默认值（`initialization_status` 默认 `pending`），老数据不受影响。
- **Config 层**：`src/app/server/configs/dbt/constants.ts` 追加 venv 相关常量（根目录解析、Python 解释器配置、pip 超时等）；新增 `DBT_VENV_ROOT` 环境变量说明。
- **Repository 层**：`environment.repository.ts` 扩展 `updateInitializationState()` 等方法；`findList`/`findById` 返回新字段。
- **Service 层**：新增 `environment-init.service.ts`（异步执行 venv 创建 + pip install、状态机推进、进程级并发锁、日志收集）；`environment.service.ts` 的 `deleteEnvironment` 扩展 venv 目录清理。
- **进程执行层**：新增 `src/app/server/lib/process.ts` 或等价模块封装 `child_process.spawn`，流式收集 stdout/stderr，支持超时与取消。
- **实时推送层**：新增 `realtime-channel` 能力——custom server（`server.ts` 包装 `next()`）在同一个 HTTP server 上挂载 `ws` WebSocket 服务端；封装连接管理 + 按主题订阅的事件总线（EventEmitter），把初始化任务的状态变化和 pip 日志推给已订阅的 WebSocket 客户端。
- **API 路由**：新增 `POST /api/dbt/environments/[id]/initialize`（触发，立即返回）；`GET 列表/详情` 返回新增字段。**实时日志/进度走 WebSocket**（不走 REST route），客户端连 `ws://.../ws` 后发送订阅消息即可。
- **Validation 层**：扩展 `environment.schema.ts`，新增 initialize 相关校验。
- **前端**：`web/features/dbt-environment/` 列表新增初始化状态列与初始化按钮、实时日志面板（WebSocket 客户端）；`web/lib/` 新增通用 WebSocket 客户端封装（连接、自动重连、主题订阅）；`api-client/environment.ts` 新增 `initialize` 方法；`types/dbt.ts` 扩展 `Environment` 类型。
- **部署模型变更**：`package.json` 的 `dev`/`start` 脚本由 `next dev`/`next start` 改为 `node server.ts`/`NODE_ENV=production node server.ts`（server.ts 内部仍调用 `next()`，保留 Turbopack 等所有 Next 能力）。`next build` 不变。
- **依赖**：新增 `ws` 运行时依赖 + `@types/ws` 开发依赖。`child_process` 为 Node 内置。
- **运行时要求**：宿主机需有可用的 `python3`（或通过 `DBT_PYTHON_BIN` 指定），且进程对 venv 根目录有读写权限。
