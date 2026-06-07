## MODIFIED Requirements

### Requirement: Project list page
系统 SHALL 展示项目列表页面，包含分页表格，显示项目名称、状态、描述、创建时间列。页面顶部 SHALL 有"新建项目"按钮。用户 SHALL 能通过状态下拉框筛选 active/archived 项目。表格 SHALL 支持分页（每页 20 条），底部显示分页控件。操作列 SHALL 包含"文件编辑"按钮，点击后在新浏览器页签中打开项目文件编辑器页面。

#### Scenario: Load project list
- **WHEN** 用户点击侧边栏"项目管理"
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=0` 获取项目列表并渲染表格

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选为 "archived"
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=0&status=archived` 并渲染过滤结果

#### Scenario: Paginate to next page
- **WHEN** 用户点击分页控件的下一页
- **THEN** 系统 GET `/api/dbt/projects?limit=20&offset=20` 并渲染第二页数据

#### Scenario: 打开文件编辑器
- **WHEN** 用户点击项目行的"文件编辑"按钮
- **THEN** 系统调用 `window.open('/editor/projects/' + projectId, '_blank')` 在新浏览器页签中打开文件编辑器页面
