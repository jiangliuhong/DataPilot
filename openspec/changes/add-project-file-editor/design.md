## Context

当前项目详情页（`ContentPanel` 内 `project-detail` 视图）已有目录树和文件列表，但无法查看或编辑文件内容。整个应用采用 `activeKey` 状态驱动的单页导航（非 URL 路由），所有视图渲染在 `ContentPanel` 中。

用户需求是在项目列表中点击"文件编辑"按钮后，在新浏览器页签打开独立的文件编辑器页面。这意味着编辑器必须是一个真实的 Next.js 路由页面（如 `/editor/projects/[id]`），而不是 `activeKey` 视图切换。

后端完全就绪：`GET/PUT /api/dbt/projects/:id/files/:fileId` 已支持文件内容读写，`fileApi.get()` 和 `fileApi.update()` 已封装。

## Goals / Non-Goals

**Goals:**
- 在项目列表操作列新增"文件编辑"按钮，点击后在新页签打开编辑器页面
- 编辑器页面为独立的 Next.js 路由，采用左右分栏布局
- 左侧展示目录树，点击文件节点在右侧打开编辑器 Tab
- 支持多 Tab 切换，每个 Tab 对应一个已打开的文件
- 代码编辑器支持语法高亮（SQL、YAML、Python、Markdown、JSON 等）
- 支持保存文件内容，未保存的文件标记 dirty 状态

**Non-Goals:**
- 不做文件创建和删除（在项目详情页已有）
- 不做目录创建、重命名、移动（在项目详情页已有）
- 不做文件差异对比（diff view）
- 不做 Git 集成或版本历史
- 不做协作编辑
- 不做终端/命令行集成

## Decisions

### Decision 1: 编辑器页面使用独立 Next.js 路由而非 activeKey 视图

**选择**: 创建 `/editor/projects/[id]/page.tsx` 作为独立页面路由

**理由**: 用户需求是"在新页签打开"，`activeKey` 是内存状态，无法跨页签共享。独立路由可通过 `window.open('/editor/projects/' + projectId)` 直接打开，URL 可分享、可刷新。

**备选方案**: 在 `ContentPanel` 中新增 `project-file-editor` 视图 — 无法在新页签打开，违背需求。

### Decision 2: 代码编辑器使用 Monaco Editor（@monaco-editor/react）

**选择**: `@monaco-editor/react`

**理由**:
- 对 SQL、YAML、Python、Markdown、JSON 均有内置语法支持
- 社区最广泛使用，文档丰富
- 与 VS Code 同源编辑器，用户体验熟悉

**备选方案**: CodeMirror 6 — 更轻量但需额外配置语言包，对 SQL/YAML 支持需要插件。Monaco 开箱即用更适合此场景。

### Decision 3: 编辑器页面自带布局，不依赖 AppLayout 侧边栏

**选择**: 编辑器页面使用全屏布局，自带顶部工具栏（项目名、返回链接）

**理由**: 文件编辑器需要最大化编辑区域，左侧目录树已提供导航，不需要外层侧边栏。编辑器页面有自己的最小化导航（顶部显示项目名 + 返回主站链接）。

### Decision 4: 目录树组件独立实现

**选择**: 在 `src/web/features/project/components/editor/` 下创建独立的目录树组件

**理由**: 现有 `DirectoryTree` 组件仅渲染目录节点，不支持显示文件。编辑器的目录树需要同时展示目录和文件，且文件节点点击行为不同（打开 Tab 而非筛选列表）。复用 `directoryApi.getTree()` 获取数据，但渲染逻辑独立。

### Decision 5: Tab 状态管理使用 React useState

**选择**: `useState` 管理 Tab 列表和激活 Tab

**理由**: Tab 状态仅在编辑器页面内使用，生命周期与页面一致，不需要全局状态管理。使用 `useReducer` 管理复杂状态（打开、关闭、切换、标记 dirty、更新内容）。

### Decision 6: 文件类型到 Monaco 语言映射

| 文件类型 | Monaco 语言 |
|---------|------------|
| sql | sql |
| yml / yaml | yaml |
| py | python |
| md | markdown |
| json | json |
| csv | plaintext |
| txt | plaintext |

## Risks / Trade-offs

- **Monaco 包体积较大（~2MB）** → 使用 `@monaco-editor/react` 的动态加载（`loader` 从 CDN 加载或 Next.js dynamic import），不影响主应用首屏加载
- **大文件性能** → 对超过 1MB 的文件显示只读提示或截断警告，Monaco 对大文件性能有限
- **并发编辑冲突** → 当前无锁机制，多用户同时编辑同一文件可能覆盖 → 后续迭代可加乐观锁（updatedAt 校验）
- **独立路由页面需要独立的 Provider 包裹** → 编辑器页面 `layout.tsx` 需包含 `Providers`，确保 HeroUI 主题和 toast 正常工作
