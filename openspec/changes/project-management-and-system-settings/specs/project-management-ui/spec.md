## ADDED Requirements

### Requirement: Project list page
系统 SHALL 展示项目列表页面，包含分页表格，显示项目名称、状态、描述、创建时间列。页面顶部 SHALL 有"新建项目"按钮。用户 SHALL 能通过状态下拉框筛选 active/archived 项目。表格 SHALL 支持分页（每页 20 条），底部显示分页控件。

#### Scenario: Load project list
- **WHEN** 用户点击侧边栏"项目管理"
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=0` 获取项目列表并渲染表格

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选为 "archived"
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=0&status=archived` 并渲染过滤结果

#### Scenario: Paginate to next page
- **WHEN** 用户点击分页控件的下一页
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=20` 并渲染第二页数据

### Requirement: Create project
系统 SHALL 提供 Modal 弹窗表单，包含项目名称（必填）和描述（选填）输入框。提交时 SHALL POST `/api/dbt/projects`。

#### Scenario: Successful creation
- **WHEN** 用户填写项目名称 "test_project" 并点击提交
- **THEN** 系统 POST `/api/dbt/projects` body `{"name":"test_project","description":"..."}`, 成功后关闭弹窗并刷新列表

#### Scenario: Duplicate name error
- **WHEN** 用户输入已存在的项目名称并提交
- **THEN** 系统 SHALL 显示错误提示 "项目名称已存在"

### Requirement: Edit project
系统 SHALL 提供 Modal 弹窗用于编辑项目名称、描述和状态（active/archived）。提交时 SHALL PUT `/api/dbt/projects/:id`。

#### Scenario: Edit project status to archived
- **WHEN** 用户将项目状态改为 "archived" 并提交
- **THEN** 系统 PUT `/api/dbt/projects/:id` body `{"status":"archived"}`, 成功后刷新列表

### Requirement: Delete project
系统 SHALL 提供删除确认弹窗。确认后 SHALL DELETE `/api/dbt/projects/:id`。

#### Scenario: Confirm delete
- **WHEN** 用户点击删除按钮并在确认弹窗中确认
- **THEN** 系统 DELETE `/api/dbt/projects/:id`, 成功后从列表移除该行并显示成功提示

### Requirement: Project detail view
系统 SHALL 在用户点击"查看"时切换到项目详情视图，展示项目基本信息（名称、描述、状态、创建/更新时间）。

#### Scenario: Navigate to project detail
- **WHEN** 用户点击项目行的"查看"按钮
- **THEN** 系统 GET `/api/dbt/projects/:id` 获取详情并渲染详情视图

### Requirement: Directory tree in project detail
项目详情页 SHALL 展示目录树。系统 SHALL GET `/api/dbt/projects/:id/tree` 获取嵌套目录树并渲染为可折叠的树形结构。

#### Scenario: Load directory tree
- **WHEN** 项目详情页加载
- **THEN** 系统 GET `/api/dbt/projects/:id/tree` 并渲染目录树，根节点默认展开

### Requirement: File list in project detail
项目详情页 SHALL 展示文件列表，支持按文件类型和目录筛选。列表 SHALL 支持分页。

#### Scenario: Filter files by type
- **WHEN** 用户选择文件类型过滤为 "sql"
- **THEN** 系统 GET `/api/dbt/projects/:id/files?fileType=sql&limit=20&offset=0` 并渲染过滤结果

### Requirement: Project environment binding
项目详情页 SHALL 展示已绑定的环境列表，并提供绑定新环境和解绑功能。

#### Scenario: Bind environment to project
- **WHEN** 用户选择环境 ID 1 并设置别名 "prod" 后点击绑定
- **THEN** 系统 POST `/api/dbt/projects/:id/environments` body `{"environmentId":1,"environmentAlias":"prod"}`, 成功后刷新绑定列表

#### Scenario: Unbind environment
- **WHEN** 用户点击解绑按钮并确认
- **THEN** 系统 DELETE `/api/dbt/projects/:id/environments/:envId`, 成功后从绑定列表移除

### Requirement: Import ZIP to project
项目详情页 SHALL 提供 ZIP 文件上传功能，用于导入 dbt 工程。

#### Scenario: Upload valid ZIP
- **WHEN** 用户选择一个 ZIP 文件并点击导入
- **THEN** 系统 POST `/api/dbt/projects/:id/import` (multipart/form-data), 成功后显示导入的目录数和文件数

#### Scenario: Upload file too large
- **WHEN** 用户选择的 ZIP 文件超过 50MB
- **THEN** 系统 SHALL 显示错误提示 "文件大小超过限制 (50MB)"

### Requirement: Export project as ZIP
项目详情页 SHALL 提供导出按钮，点击后下载项目 ZIP 文件。

#### Scenario: Export project
- **WHEN** 用户点击"导出"按钮
- **THEN** 系统 GET `/api/dbt/projects/:id/export` 并触发浏览器下载 ZIP 文件
