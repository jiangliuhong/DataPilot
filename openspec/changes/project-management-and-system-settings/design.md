## Context

DataPilot 是一个 dbt 项目管理平台，后端 17 个 API 端点已全部实现（项目管理、目录/文件、版本、连接、环境、绑定、导入导出），7 张数据库表已建好并迁移完成。当前前端仅有骨架——侧边栏导航和硬编码 mock 数据的 ContentPanel，无任何真实 API 调用。本次变更构建完整前端 UI，对接已有后端 API。

当前架构约束：
- 单页应用，内容切换通过 React `activeKey` 状态管理（非 URL 路由）
- HeroUI v3 作为 UI 框架
- 前后端严格分离，前端通过 `api-client` 层调用 API
- 目录结构遵循 `src/web/` 前端、`src/app/api/` 后端的分层约定

## Goals / Non-Goals

**Goals:**
- 构建项目管理页面：项目列表（CRUD + 分页）、项目详情（目录树 + 文件管理）、ZIP 导入导出、环境绑定
- 构建系统设置子页面：dbt 版本管理、数据库连接管理、运行环境管理（各含列表 + CRUD）
- 建立前端 `api-client` 层，类型安全地封装所有 `/api/dbt/*` 端点
- 更新侧边栏导航：增加系统设置分组及子菜单，支持层级菜单展示
- 保持现有单页 `activeKey` 路由模式，不引入 URL 路由

**Non-Goals:**
- 不做 URL 路由迁移（保持当前 activeKey 模式）
- 不做仪表盘数据对接（保持占位状态）
- 不做用户认证/权限管理页面
- 不做文件在线编辑器（仅展示文件内容，后续迭代再加代码编辑器）
- 不做实时协同或 WebSocket 功能
- 不修改任何后端代码

## Decisions

### 1. 保持 activeKey 单页路由模式，引入两级菜单

**选择**：在现有 `activeKey` 状态机制上扩展，MenuItem 类型增加 `children` 字段支持子菜单，`ContentPanel` 的 `contentMap` 映射新的 key。

**替代方案**：迁移到 Next.js App Router URL 路由（`/projects`、`/settings/versions` 等）。

**理由**：当前应用功能集中在 dbt 管理域，页面数量有限（~6 个主页面），URL 路由收益不大且需重构整个布局层。activeKey 模式简单直接，保持一致性。后续如需 URL 路由可平滑迁移。

### 2. api-client 按资源域分文件

**选择**：`src/web/api-client/` 下按资源域拆分文件：`project.ts`、`directory.ts`、`file.ts`、`version.ts`、`connection.ts`、`environment.ts`、`project-environment.ts`、`request.ts`（基础请求工具）。

**理由**：与后端 API 路径和 repository/service 结构一一对应，方便查找和维护。每个文件导出 async 函数，内部调用 `request.ts` 的通用 fetch 封装。

### 3. feature 模块按功能域组织

**选择**：`src/web/features/` 下创建 4 个功能模块：
- `project/` — 项目列表页、项目详情页（含目录树和文件管理）
- `dbt-version/` — 版本管理页
- `dbt-connection/` — 数据库连接管理页
- `dbt-environment/` — 运行环境管理页

每个模块下含 `components/`（页面级和局部组件）和 `hooks/`（数据获取和状态管理 hook）。

**理由**：功能内聚，与后端模块对齐。避免大文件，每个组件 < 150 行。

### 4. 数据获取使用自定义 hooks

**选择**：每个列表页使用自定义 hook（如 `useProjects`、`useVersions`）管理数据获取、分页、加载/错误状态。基于 `useState` + `useEffect` + `useCallback`，不引入 SWR/TanStack Query。

**理由**：当前功能简单，无需引入额外依赖。hooks 内部调用 api-client 函数，管理 loading/error/data 状态。后续如需缓存和自动刷新可平滑迁移到 TanStack Query。

### 5. 表单使用 Modal + HeroUI Form 组件

**选择**：创建/编辑操作通过 Modal 弹窗实现，表单使用 HeroUI 的 Input、Select、Button 组件，手动管理表单状态和提交。

**理由**：与现有 UI 风格一致，无需引入第三方表单库（如 react-hook-form）。表单字段有限（项目 2 字段、版本 ~5 字段、连接 ~8 字段、环境 3 字段），复杂度可控。

### 6. 侧边栏支持分组和子菜单

**选择**：扩展 `MenuItem` 类型增加 `group?: string` 和 `children?: MenuItem[]`。Sidebar 组件渲染时按 group 分组，children 渲染为缩进的子菜单项。`ContentPanel` 的 `contentMap` 增加新的 activeKey 映射。

**菜单结构**：
```
仪表盘 (dashboard)
项目管理 (project-list)
--- 分隔线 ---
系统设置 (system-settings) [分组标签]
  ├─ dbt 版本管理 (dbt-version-list)
  ├─ 数据库连接管理 (dbt-connection-list)
  └─ 运行环境管理 (dbt-environment-list)
--- 分隔线 ---
用户 (system-users)
```

### 7. 项目详情使用子视图切换

**选择**：项目列表点击"查看"后，在 ContentPanel 区域内切换到项目详情视图（通过 `activeKey` 变为 `project-detail-{id}` 或引入 viewState）。详情视图包含：基本信息、目录树、文件列表、环境绑定、导入导出。

**理由**：不引入 URL 路由，通过状态管理视图切换。项目详情是项目列表的下钻视图，保持上下文连贯。

## Risks / Trade-offs

- **[Risk] 单页路由导致浏览器后退键失效** → 当前阶段可接受，后续可加入 `history.pushState` 或迁移到 URL 路由
- **[Risk] 项目详情视图状态管理变复杂** → 使用 AppLayout 级别的 `viewState` 管理当前视图和参数，而非嵌套在 ContentPanel 内
- **[Trade-off] 不使用数据缓存库意味着每次切换页面重新请求** → 可接受，API 响应快且数据量小；后续可按需引入 TanStack Query
- **[Trade-off] 表单不使用库意味着验证逻辑手写** → Zod schema 可在前端复用（后端已有），验证逻辑统一
- **[Trade-off] 侧边栏扩展 MenuItem 类型是侵入式改动** → 改动范围可控，仅影响 menu-config.ts、sidebar.tsx、types/menu.ts 三个文件
