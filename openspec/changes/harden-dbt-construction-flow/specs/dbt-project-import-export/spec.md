## MODIFIED Requirements

### Requirement: Import dbt project from ZIP
系统 SHALL 允许用户上传 ZIP 压缩包，解析后将其目录结构和文件内容存入数据库。导入操作 SHALL 在数据库事务中执行（见 "Import transaction safety"）。`dbt_project.yml` SHALL 被导入（不再跳过），以便保留项目的 `model-paths`、`profile` 等配置；仅 `packages.yml` 因依赖安装是独立关注点而继续被跳过。导入的 `dbt_project.yml` 在运行物化时需通过 profile 名一致性校验（见 dbt-task-execution capability）。

#### Scenario: Import valid ZIP file
- **WHEN** 用户发送 POST /api/dbt/projects/:id/import，body 为 multipart/form-data 包含 ZIP 文件
- **THEN** 系统解析 ZIP，为每个目录创建 dbt_directories 记录，为每个文件创建 dbt_files 记录
- **AND** 目录结构保持原有层级关系（parentId 正确关联）
- **AND** path 字段根据目录层级自动计算
- **AND** 文件的 content、fileType、size 正确存储
- **AND** 返回 200 状态码和导入结果摘要 { directories: number, files: number }

#### Scenario: Import ZIP with nested directories
- **WHEN** ZIP 包含深层嵌套目录结构（如 models/staging/finance/）
- **THEN** 系统递归创建所有层级的目录，正确设置 parentId、path 和 depth

#### Scenario: Import ZIP to non-existent project
- **WHEN** 目标项目 ID 不存在或已删除
- **THEN** 系统返回 404 状态码

#### Scenario: Import empty ZIP file
- **WHEN** 上传的 ZIP 文件为空（无任何文件）
- **THEN** 系统返回 200 状态码和 { directories: 0, files: 0 }

#### Scenario: Import ZIP exceeding size limit
- **WHEN** 上传的 ZIP 文件超过 50MB
- **THEN** 系统返回 413 状态码和错误信息 "File size exceeds limit (50MB)"

#### Scenario: Import non-ZIP file
- **WHEN** 上传的文件不是 ZIP 格式
- **THEN** 系统返回 400 状态码和错误信息 "Invalid file format, only ZIP is supported"

#### Scenario: Import ZIP with packages dependency manifest only
- **WHEN** ZIP 中包含 packages.yml 文件
- **THEN** 系统 SHALL 跳过 packages.yml（依赖安装是独立关注点），不将其导入到文件表中
- **AND`dbt_project.yml` SHALL 被正常导入（不再跳过）
