## ADDED Requirements

### Requirement: Create dbt project
系统 SHALL 允许用户通过 API 创建新的 dbt 项目，提供项目名称和可选描述。

#### Scenario: Create project with valid data
- **WHEN** 用户发送 POST /api/dbt/projects，body 包含 name="analytics_project"，description="核心分析项目"
- **THEN** 系统创建项目，返回 201 状态码和项目对象（包含 id, name, description, status="active", createdAt, updatedAt）
- **AND** 数据库 dbt_projects 表新增一条记录

#### Scenario: Create project with duplicate name
- **WHEN** 用户发送 POST /api/dbt/projects，body 包含已存在的 name
- **THEN** 系统返回 409 状态码和错误信息 "Project name already exists"

#### Scenario: Create project with empty name
- **WHEN** 用户发送 POST /api/dbt/projects，body 中 name 为空字符串或缺失
- **THEN** 系统返回 400 状态码和验证错误信息

### Requirement: List dbt projects with pagination
系统 SHALL 返回分页的项目列表，支持 limit 和 offset 参数。

#### Scenario: List projects with default pagination
- **WHEN** 用户发送 GET /api/dbt/projects
- **THEN** 系统返回 200 状态码，body 包含 { items: Project[], total: number, limit: 20, offset: 0 }
- **AND** items 中不包含已软删除的项目（deletedAt IS NULL）

#### Scenario: List projects with custom pagination
- **WHEN** 用户发送 GET /api/dbt/projects?limit=10&offset=20
- **THEN** 系统返回 200 状态码，body 中 limit=10, offset=20，items 最多包含 10 条记录

#### Scenario: List projects ordered by creation time
- **WHEN** 用户发送 GET /api/dbt/projects
- **THEN** items 按 createdAt 降序排列（最新创建的项目排在前面）

### Requirement: Get dbt project by ID
系统 SHALL 允许用户通过项目 ID 查询单个项目的详细信息。

#### Scenario: Get existing project
- **WHEN** 用户发送 GET /api/dbt/projects/:id，id 对应的项目存在且未删除
- **THEN** 系统返回 200 状态码和完整项目对象

#### Scenario: Get non-existent project
- **WHEN** 用户发送 GET /api/dbt/projects/:id，id 对应的项目不存在
- **THEN** 系统返回 404 状态码和错误信息 "Project not found"

#### Scenario: Get soft-deleted project
- **WHEN** 用户发送 GET /api/dbt/projects/:id，id 对应的项目已被软删除
- **THEN** 系统返回 404 状态码和错误信息 "Project not found"

### Requirement: Update dbt project
系统 SHALL 允许用户更新项目的名称和描述。

#### Scenario: Update project name
- **WHEN** 用户发送 PUT /api/dbt/projects/:id，body 包含 name="new_name"
- **THEN** 系统更新项目名称，返回 200 状态码和更新后的项目对象
- **AND** updatedAt 字段自动更新

#### Scenario: Update project description
- **WHEN** 用户发送 PUT /api/dbt/projects/:id，body 包含 description="新描述"
- **THEN** 系统更新项目描述，返回 200 状态码

#### Scenario: Update non-existent project
- **WHEN** 用户发送 PUT /api/dbt/projects/:id，id 对应的项目不存在
- **THEN** 系统返回 404 状态码

### Requirement: Soft delete dbt project
系统 SHALL 通过软删除方式删除项目，保留数据记录。

#### Scenario: Delete existing project
- **WHEN** 用户发送 DELETE /api/dbt/projects/:id，id 对应的项目存在
- **THEN** 系统将项目的 deletedAt 设为当前时间，返回 200 状态码
- **AND** 项目下的所有目录和文件的 deletedAt 同步设为当前时间（级联软删除）
- **AND** 后续查询不再返回该项目及其目录和文件

#### Scenario: Delete non-existent project
- **WHEN** 用户发送 DELETE /api/dbt/projects/:id，id 对应的项目不存在
- **THEN** 系统返回 404 状态码

### Requirement: Project status management
系统 SHALL 支持项目的状态管理，包括 active 和 archived 两种状态。

#### Scenario: Archive a project
- **WHEN** 用户发送 PUT /api/dbt/projects/:id，body 包含 status="archived"
- **THEN** 系统将项目状态更新为 "archived"，返回 200 状态码

#### Scenario: List only active projects
- **WHEN** 用户发送 GET /api/dbt/projects?status=active
- **THEN** 系统仅返回 status="active" 的项目列表
