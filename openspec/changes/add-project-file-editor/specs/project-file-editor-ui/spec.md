## ADDED Requirements

### Requirement: 文件编辑器页面路由
系统 SHALL 提供独立页面路由 `/editor/projects/[id]`，用于在浏览器新页签中打开项目文件编辑器。该页面 SHALL 自带全屏布局（不包含主站侧边栏），顶部显示项目名称和返回主站链接。

#### Scenario: 从项目列表打开编辑器
- **WHEN** 用户在项目列表点击"文件编辑"按钮
- **THEN** 系统调用 `window.open('/editor/projects/' + projectId)` 在新页签打开编辑器页面

#### Scenario: 直接通过 URL 访问编辑器
- **WHEN** 用户在浏览器地址栏输入 `/editor/projects/1`
- **THEN** 系统加载项目 ID 为 1 的文件编辑器页面，GET `/api/dbt/projects/1` 获取项目信息并显示在顶部

#### Scenario: 项目不存在
- **WHEN** 用户访问 `/editor/projects/9999` 且该项目不存在
- **THEN** 系统 SHALL 显示"项目不存在"提示并提供返回主站链接

### Requirement: 左侧目录树导航
编辑器页面左侧 SHALL 展示项目目录树，同时包含目录节点和文件节点。目录节点 SHALL 可展开/折叠，文件节点点击 SHALL 在右侧打开文件编辑 Tab。左侧面板宽度 SHALL 为 260px，支持拖拽调整宽度。

#### Scenario: 加载目录树
- **WHEN** 编辑器页面加载完成
- **THEN** 系统 GET `/api/dbt/projects/:id/tree` 获取目录树数据，渲染为树形结构，根目录默认展开

#### Scenario: 展开目录查看文件
- **WHEN** 用户点击目录节点展开
- **THEN** 系统在该目录节点下展示其直接子目录和子文件，目录在前、文件在后，按名称排序

#### Scenario: 点击文件打开编辑 Tab
- **WHEN** 用户点击目录树中的文件节点
- **THEN** 系统 GET `/api/dbt/projects/:id/files/:fileId` 获取文件内容，在右侧编辑区打开新 Tab 显示文件名和编辑器。若该文件已打开，则切换到已有 Tab

### Requirement: 多 Tab 编辑区域
右侧编辑区 SHALL 支持 Tab 栏，显示所有已打开的文件名。每个 Tab SHALL 显示文件名，点击可切换到对应文件。当前激活 Tab SHALL 有高亮样式。用户 SHALL 能通过点击 Tab 上的关闭按钮关闭 Tab。

#### Scenario: 打开多个文件
- **WHEN** 用户依次点击目录树中的 file_a.sql、file_b.yml、file_c.py
- **THEN** Tab 栏显示 3 个 Tab，当前激活的为 file_c.py，编辑器显示 file_c.py 的内容

#### Scenario: 切换 Tab
- **WHEN** 用户点击 Tab 栏中的 file_a.sql Tab
- **THEN** 编辑器切换显示 file_a.sql 的内容，该 Tab 变为激活状态

#### Scenario: 关闭 Tab
- **WHEN** 用户点击 file_b.yml Tab 上的关闭按钮且文件未修改
- **THEN** 该 Tab 被移除，编辑器自动切换到相邻 Tab

#### Scenario: 关闭未保存的 Tab
- **WHEN** 用户点击已修改但未保存的 Tab 的关闭按钮
- **THEN** 系统 SHALL 弹出确认弹窗"文件已修改，是否保存？"，提供"保存"、"不保存"、"取消"三个选项

#### Scenario: 关闭最后一个 Tab
- **WHEN** 用户关闭所有已打开的 Tab
- **THEN** 编辑区显示空状态提示"从左侧目录树选择文件开始编辑"

### Requirement: 代码编辑器
系统 SHALL 使用 Monaco Editor 作为代码编辑器组件，根据文件类型自动启用语法高亮。支持的语言映射：sql→sql, yml/yaml→yaml, py→python, md→markdown, json→json, csv/txt→plaintext。

#### Scenario: 编辑 SQL 文件
- **WHEN** 用户打开一个 .sql 文件
- **THEN** 编辑器 SHALL 以 SQL 语法高亮模式显示文件内容，用户可自由编辑

#### Scenario: 编辑 YAML 文件
- **WHEN** 用户打开一个 .yml 文件
- **THEN** 编辑器 SHALL 以 YAML 语法高亮模式显示文件内容

#### Scenario: 编辑内容后标记 dirty
- **WHEN** 用户修改了编辑器中的内容
- **THEN** 对应 Tab 的文件名前 SHALL 显示圆点（●）标记，表示文件有未保存的修改

### Requirement: 文件保存
系统 SHALL 提供保存按钮和快捷键（Ctrl+S / Cmd+S）保存文件。保存时 SHALL 调用 `PUT /api/dbt/projects/:id/files/:fileId` 提交 `{ content }` 更新文件内容。保存成功后 SHALL 清除 dirty 标记。

#### Scenario: 点击保存按钮
- **WHEN** 用户修改文件内容后点击保存按钮
- **THEN** 系统 PUT `/api/dbt/projects/:id/files/:fileId` body `{ "content": "修改后的内容" }`, 成功后显示成功提示并清除 dirty 标记

#### Scenario: 快捷键保存
- **WHEN** 用户按下 Ctrl+S（Mac 为 Cmd+S）
- **THEN** 系统执行保存当前激活 Tab 的文件

#### Scenario: 保存失败
- **WHEN** 保存请求返回错误
- **THEN** 系统 SHALL 显示错误提示，dirty 标记保持不变

### Requirement: 顶部工具栏
编辑器页面顶部 SHALL 显示工具栏，包含：项目名称（左侧）、保存按钮（右侧）、返回主站链接（左侧）。

#### Scenario: 显示项目信息
- **WHEN** 编辑器页面加载完成
- **THEN** 顶部工具栏左侧显示"← 返回 DataPilot"链接和项目名称，右侧显示保存按钮（仅在当前文件有修改时启用）
