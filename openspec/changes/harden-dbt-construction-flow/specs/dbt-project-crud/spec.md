## MODIFIED Requirements

### Requirement: Create dbt project
系统 SHALL 允许用户通过 API 创建新的 dbt 项目，提供项目名称和可选描述。项目名称唯一性校验 SHALL 由 service 层统一负责；route handler SHALL NOT 直接调用 repository 进行唯一性预检。当名称已存在时，service SHALL 抛出错误，route 通过统一错误映射返回 409。

#### Scenario: Create project with valid data
- **WHEN** 用户发送 POST /api/dbt/projects，body 包含 name="analytics_project"，description="核心分析项目"
- **THEN** 系统创建项目，返回 201 状态码和项目对象（包含 id, name, description, status="active", createdAt, updatedAt）
- **AND** 数据库 dbt_projects 表新增一条记录

#### Scenario: Create project with duplicate name
- **WHEN** 用户发送 POST /api/dbt/projects，body 包含已存在的 name
- **THEN** 系统返回 409 状态码和错误信息 "Project name already exists"
- **AND** 该唯一性判定 SHALL 在 service 层完成，route handler SHALL NOT 直接调用 repository

#### Scenario: Create project with empty name
- **WHEN** 用户发送 POST /api/dbt/projects，body 中 name 为空字符串或缺失
- **THEN** 系统返回 400 状态码和验证错误信息

### Requirement: Delete dbt project atomically cascades

系统 SHALL 软删除项目，并 SHALL 在单个数据库事务中级联软删除该项目下的所有文件和目录（files → directories → project）。任一步骤失败 SHALL 回滚整个操作，不得留下孤儿软删状态。事务 SHALL 在 service 层开启；route handler SHALL NOT 管理事务。

#### Scenario: Delete existing project
- **WHEN** 用户发送 DELETE /api/dbt/projects/:id，项目存在且未删除
- **THEN** 系统软删除该项目及其下所有目录和文件（设置 deletedAt），返回 200 状态码

#### Scenario: Delete project is atomic on partial failure
- **WHEN** 项目删除过程中某一步骤（如软删除目录）失败
- **THEN** 已执行的软删除 SHALL 被回滚
- **AND** 项目及其文件/目录 SHALL 保持删除前状态
- **AND** 操作 SHALL 向调用方报错

#### Scenario: Delete non-existent project
- **WHEN** 项目 ID 不存在或已软删除
- **THEN** 系统返回 404 状态码
