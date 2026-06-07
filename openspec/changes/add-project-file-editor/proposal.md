## Why

项目详情页已有文件列表和目录树，但无法在线查看或编辑文件内容。用户需要下载 ZIP 才能修改文件，体验割裂。设计文档明确将"在线文件编辑器"标记为后续迭代功能，现在正是实现时机。

## What Changes

- 在项目列表的操作列增加"文件编辑"按钮，点击后在新浏览器页签中打开独立的文件编辑器页面
- 新建文件编辑器页面，采用左右分栏布局：左侧为目录树导航，右侧为代码编辑区域
- 右侧编辑区域支持多 Tab 切换已打开的文件，每个 Tab 显示文件名
- 编辑器使用代码编辑器组件（Monaco Editor 或 CodeMirror），支持语法高亮（SQL、YAML、Python、Markdown、JSON 等已支持的文件类型）
- 支持文件内容修改和保存，利用已有的 `PUT /api/dbt/projects/:id/files/:fileId` 接口
- 支持 Tab 状态管理：未保存的文件标记为 dirty 状态，关闭 Tab 时提示保存
- 文件编辑器页面作为独立路由，通过 URL 参数传递项目 ID

## Capabilities

### New Capabilities
- `project-file-editor-ui`: 项目文件在线编辑器的前端页面和组件，包括左右分栏布局、目录树、多 Tab 编辑器、语法高亮、文件保存与 dirty 状态管理

### Modified Capabilities
- `project-management-ui`: 在项目列表的操作列中增加"文件编辑"按钮入口

## Impact

- **前端**: 新增文件编辑器页面和组件（约 4-6 个新文件），修改项目列表组件增加操作按钮
- **后端**: 无变更，完全复用现有 `GET/PUT /api/dbt/projects/:id/files/:fileId` 接口
- **API 客户端**: 无变更，已支持 `fileApi.get()` 和 `fileApi.update()`
- **依赖**: 需引入代码编辑器库（Monaco Editor via `@monaco-editor/react` 或 CodeMirror）
- **类型**: 无新增类型，复用已有 `ProjectFile`、`UpdateFileInput` 类型
