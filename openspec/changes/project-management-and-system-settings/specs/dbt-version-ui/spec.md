## ADDED Requirements

### Requirement: Version list page
系统 SHALL 展示 dbt 版本列表页面，包含分页表格，显示版本名称、版本号、状态、创建时间列。页面顶部 SHALL 有"新建版本"按钮。用户 SHALL 能通过版本号和状态进行筛选。

#### Scenario: Load version list
- **WHEN** 用户点击侧边栏"dbt 版本管理"
- **THEN** 系统 GET `/api/dbt/versions?limit=20&offset=0` 获取版本列表并渲染表格

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选为 "active"
- **THEN** 系统 GET `/api/dbt/versions?limit=20&offset=0&status=active` 并渲染过滤结果

#### Scenario: Filter by version number
- **WHEN** 用户输入版本号 "1.8" 进行搜索
- **THEN** 系统 GET `/api/dbt/versions?limit=20&offset=0&version=1.8` 并渲染匹配结果

### Requirement: Create version
系统 SHALL 提供 Modal 弹窗表单，包含版本名称（必填）、版本号（必填）、适配器包列表（至少 1 项，每项含名称、版本、支持的数据库类型数组）、依赖列表（至少 1 项，每项含名称和版本）。提交时 SHALL POST `/api/dbt/versions`。

#### Scenario: Add adapter package entry
- **WHEN** 用户点击"添加适配器包"按钮
- **THEN** 系统 SHALL 在表单中追加一组适配器包输入行

#### Scenario: Remove adapter package entry
- **WHEN** 用户点击某行适配器包的"删除"按钮且当前超过 1 行
- **THEN** 系统 SHALL 移除该行输入

#### Scenario: Successful creation
- **WHEN** 用户填写完整表单并提交
- **THEN** 系统 POST `/api/dbt/versions`，成功后关闭弹窗并刷新列表

#### Scenario: Duplicate name error
- **WHEN** 用户输入已存在的版本名称并提交
- **THEN** 系统 SHALL 显示错误提示 "版本名称已存在"

### Requirement: Edit version
系统 SHALL 提供 Modal 弹窗用于编辑版本信息（名称、版本号、适配器包、依赖、状态）。提交时 SHALL PUT `/api/dbt/versions/:id`。

#### Scenario: Edit version with pre-filled data
- **WHEN** 用户点击编辑按钮
- **THEN** 系统 SHALL 先 GET `/api/dbt/versions/:id` 获取详情，并用返回数据预填充表单

#### Scenario: Change status to inactive
- **WHEN** 用户将状态改为 "inactive" 并提交
- **THEN** 系统 PUT `/api/dbt/versions/:id` body 含 `{"status":"inactive"}`, 成功后刷新列表

### Requirement: Delete version
系统 SHALL 提供删除确认弹窗。确认后 SHALL DELETE `/api/dbt/versions/:id`。

#### Scenario: Successful delete
- **WHEN** 用户确认删除
- **THEN** 系统 DELETE `/api/dbt/versions/:id`, 成功后移除该行并显示成功提示

#### Scenario: Delete version referenced by environment
- **WHEN** 用户尝试删除被运行环境引用的版本
- **THEN** 系统 SHALL 显示错误提示 "版本被运行环境引用，无法删除"

### Requirement: Version detail display
版本列表中 SHALL 能展开或查看某行的适配器包和依赖详情。

#### Scenario: View version detail inline
- **WHEN** 用户点击版本行的展开按钮
- **THEN** 系统 SHALL 展示该版本的适配器包列表和依赖列表
