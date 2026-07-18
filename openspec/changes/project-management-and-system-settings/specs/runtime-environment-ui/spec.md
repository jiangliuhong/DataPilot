## ADDED Requirements

### Requirement: Environment list page
系统 SHALL 展示运行环境列表页面，包含分页表格，显示环境名称、关联的版本名称、关联的连接名称、状态、创建时间列。页面顶部 SHALL 有"新建环境"按钮。用户 SHALL 能通过状态进行筛选。

#### Scenario: Load environment list
- **WHEN** 用户点击侧边栏"运行环境管理"
- **THEN** 系统 GET `/api/dbt/environments?limit=20&offset=0` 获取环境列表，同时 GET `/api/dbt/versions` 和 `/api/dbt/connections` 获取关联数据用于展示名称

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选为 "active"
- **THEN** 系统 GET `/api/dbt/environments?limit=20&offset=0&status=active` 并渲染过滤结果

### Requirement: Create environment
系统 SHALL 提供 Modal 弹窗表单，包含环境名称（必填）、dbt 版本（必填，下拉选择，数据来源 GET `/api/dbt/versions`）、数据库连接（必填，下拉选择，数据来源 GET `/api/dbt/connections`）。提交时 SHALL POST `/api/dbt/environments`。

#### Scenario: Successful creation
- **WHEN** 用户填写名称、选择版本和连接后提交
- **THEN** 系统 POST `/api/dbt/environments` body `{"name":"...","versionId":1,"connectionId":1}`, 成功后关闭弹窗并刷新列表

#### Scenario: Adapter compatibility error
- **WHEN** 用户选择的版本适配器不支持所选连接的数据库类型
- **THEN** 系统 SHALL 显示后端返回的错误 "适配器不支持该数据库类型"

#### Scenario: Duplicate name error
- **WHEN** 用户输入已存在的环境名称并提交
- **THEN** 系统 SHALL 显示错误提示 "环境名称已存在"

### Requirement: Edit environment
系统 SHALL 提供 Modal 弹窗用于编辑环境名称、关联版本、关联连接和状态。版本和连接 SHALL 以下拉选择器展示。

#### Scenario: Edit environment with pre-filled data
- **WHEN** 用户点击编辑按钮
- **THEN** 系统 SHALL 先 GET `/api/dbt/environments/:id` 获取详情，预填充表单

#### Scenario: Change associated version
- **WHEN** 用户选择新的 dbt 版本并提交
- **THEN** 系统 PUT `/api/dbt/environments/:id` body 含 `{"versionId":2}`, 成功后刷新列表

### Requirement: Delete environment
系统 SHALL 提供删除确认弹窗。确认后 SHALL DELETE `/api/dbt/environments/:id`。

#### Scenario: Successful delete
- **WHEN** 用户确认删除
- **THEN** 系统 DELETE `/api/dbt/environments/:id`, 成功后移除该行

#### Scenario: Delete environment bound to project
- **WHEN** 用户尝试删除已被项目绑定的环境
- **THEN** 系统 SHALL 显示错误提示 "环境已被项目绑定，无法删除"

### Requirement: Environment displays related resource names
环境列表和详情中 SHALL 显示关联的版本名称和连接名称（而非仅显示 ID）。

#### Scenario: Show version name in list
- **WHEN** 环境列表加载
- **THEN** 版本列 SHALL 显示版本名称（如 "dbt-core-1.8"），而非 "versionId: 1"
