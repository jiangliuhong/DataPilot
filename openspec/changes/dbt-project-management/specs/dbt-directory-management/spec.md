## ADDED Requirements

### Requirement: Create directory
系统 SHALL 允许用户在指定项目内创建目录。

#### Scenario: Create root-level directory
- **WHEN** 用户发送 POST /api/dbt/projects/:id/directories，body 包含 name="models"，parentId 为 null 或不传
- **THEN** 系统创建目录，返回 201 状态码和目录对象（包含 id, projectId, parentId=null, name, path="models", depth=0）
- **AND** path 字段等于 name

#### Scenario: Create nested directory
- **WHEN** 用户发送 POST /api/dbt/projects/:id/directories，body 包含 name="staging"，parentId=<models目录的id>
- **THEN** 系统创建目录，返回 201 状态码，path="models/staging"，depth=1

#### Scenario: Create directory with duplicate name under same parent
- **WHEN** 用户在同一 parentId 下创建同名目录 name="models"
- **THEN** 系统返回 409 状态码和错误信息 "Directory already exists in this location"

#### Scenario: Create directory in non-existent project
- **WHEN** 用户在不存在或已删除的项目下创建目录
- **THEN** 系统返回 404 状态码 "Project not found"

### Requirement: List directories
系统 SHALL 返回指定项目下的目录列表。

#### Scenario: List all directories in project
- **WHEN** 用户发送 GET /api/dbt/projects/:id/directories
- **THEN** 系统返回 200 状态码和目录数组（不包含已软删除的目录）

#### Scenario: List directories filtered by parentId
- **WHEN** 用户发送 GET /api/dbt/projects/:id/directories?parentId=<dirId>
- **THEN** 系统返回 200 状态码，仅包含指定 parentId 下的直接子目录

### Requirement: Get directory tree
系统 SHALL 返回指定项目的完整目录树结构。

#### Scenario: Get full directory tree
- **WHEN** 用户发送 GET /api/dbt/projects/:id/tree
- **THEN** 系统返回 200 状态码和嵌套树形结构，每个节点包含 id, name, path, children[]（子目录数组）
- **AND** 树根节点为所有 parentId=null 的目录，children 递归展开

#### Scenario: Get tree of empty project
- **WHEN** 用户获取一个没有目录的项目的 tree
- **THEN** 系统返回 200 状态码和空数组 []

### Requirement: Rename directory
系统 SHALL 允许用户重命名目录，并自动更新该目录及所有子目录和文件的 path。

#### Scenario: Rename directory successfully
- **WHEN** 用户发送 PUT /api/dbt/projects/:id/directories/:dirId，body 包含 name="staging_new"
- **THEN** 系统更新目录名称，重新计算 path（如 "models/staging" → "models/staging_new"）
- **AND** 所有子目录的 path 前缀同步更新（如 "models/staging/users" → "models/staging_new/users"）
- **AND** 该目录下所有文件的 path 前缀同步更新
- **AND** 上述更新在同一个数据库事务中完成

#### Scenario: Rename to existing name under same parent
- **WHEN** 用户将目录重命名为同父目录下已存在的名称
- **THEN** 系统返回 409 状态码

### Requirement: Move directory
系统 SHALL 允许用户将目录移动到新的父目录下，并级联更新 path。

#### Scenario: Move directory to another parent
- **WHEN** 用户发送 PUT /api/dbt/projects/:id/directories/:dirId，body 包含 parentId=<newParentId>
- **THEN** 系统更新 parentId，重新计算 path
- **AND** 所有子目录和文件的 path 同步更新
- **AND** 上述更新在同一个数据库事务中完成

#### Scenario: Move directory to itself or its descendant
- **WHEN** 用户尝试将目录移动到自身或其子目录下
- **THEN** 系统返回 400 状态码和错误信息 "Cannot move directory to itself or its descendant"

#### Scenario: Move directory to different project
- **WHEN** 用户指定的 parentId 属于不同项目
- **THEN** 系统返回 400 状态码

### Requirement: Delete directory
系统 SHALL 支持级联软删除目录及其所有子目录和文件。

#### Scenario: Delete directory with children
- **WHEN** 用户发送 DELETE /api/dbt/projects/:id/directories/:dirId
- **THEN** 系统将目标目录的 deletedAt 设为当前时间
- **AND** 所有子目录（递归）的 deletedAt 设为当前时间
- **AND** 该目录及所有子目录下的所有文件的 deletedAt 设为当前时间
- **AND** 上述操作在同一个数据库事务中完成
- **AND** 返回 200 状态码

#### Scenario: Delete non-existent directory
- **WHEN** 用户删除不存在的目录
- **THEN** 系统返回 404 状态码
