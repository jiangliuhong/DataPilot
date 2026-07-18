## ADDED Requirements

### Requirement: Connection list page
系统 SHALL 展示数据库连接列表页面，包含分页表格，显示连接名称、数据库类型、主机、端口、数据库名、状态、创建时间列。页面顶部 SHALL 有"新建连接"按钮。用户 SHALL 能通过数据库类型和状态进行筛选。

#### Scenario: Load connection list
- **WHEN** 用户点击侧边栏"数据库连接管理"
- **THEN** 系统 GET `/api/dbt/connections?limit=20&offset=0` 获取连接列表并渲染表格

#### Scenario: Filter by database type
- **WHEN** 用户选择数据库类型筛选为 "mysql8"
- **THEN** 系统 GET `/api/dbt/connections?limit=20&offset=0&databaseType=mysql8` 并渲染过滤结果

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选为 "active"
- **THEN** 系统 GET `/api/dbt/connections?limit=20&offset=0&status=active` 并渲染过滤结果

### Requirement: Create connection
系统 SHALL 提供 Modal 弹窗表单，包含连接名称（必填）、数据库类型（必填，下拉选择：mysql5/mysql8/starrocks/postgresql）、主机（必填）、端口（必填，1-65535）、数据库名（必填）、Schema 名（选填）、用户名（必填）、密码（必填）输入框。提交时 SHALL POST `/api/dbt/connections`。

#### Scenario: Successful creation
- **WHEN** 用户填写完整表单并提交
- **THEN** 系统 POST `/api/dbt/connections`, 成功后关闭弹窗并刷新列表

#### Scenario: Duplicate name error
- **WHEN** 用户输入已存在的连接名称并提交
- **THEN** 系统 SHALL 显示错误提示 "连接名称已存在"

#### Scenario: Port validation
- **WHEN** 用户输入端口号为 99999（超出范围）
- **THEN** 系统 SHALL 在前端显示验证错误，阻止提交

### Requirement: Edit connection
系统 SHALL 提供 Modal 弹窗用于编辑连接信息。所有字段均可选，仅更新传入的字段。密码字段 SHALL 显示为空（不回显），仅在用户输入新密码时才发送。

#### Scenario: Edit host and port
- **WHEN** 用户修改主机地址并提交
- **THEN** 系统 PUT `/api/dbt/connections/:id` body 含更新字段，成功后刷新列表

### Requirement: Delete connection
系统 SHALL 提供删除确认弹窗。确认后 SHALL DELETE `/api/dbt/connections/:id`。

#### Scenario: Successful delete
- **WHEN** 用户确认删除
- **THEN** 系统 DELETE `/api/dbt/connections/:id`, 成功后移除该行

#### Scenario: Delete connection referenced by environment
- **WHEN** 用户尝试删除被运行环境引用的连接
- **THEN** 系统 SHALL 显示错误提示 "连接被运行环境引用，无法删除"

### Requirement: Password masking
系统 SHALL 确保密码字段不在任何列表或详情响应中展示。前端 SHALL 永远不在 UI 中显示密码值。

#### Scenario: Connection list does not show password
- **WHEN** 连接列表加载完成
- **THEN** 表格中 SHALL 不包含密码列，API 响应中也不返回密码字段
