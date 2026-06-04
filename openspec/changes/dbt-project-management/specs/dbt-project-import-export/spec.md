## ADDED Requirements

### Requirement: Import dbt project from ZIP
系统 SHALL 允许用户上传 ZIP 压缩包，解析后将其目录结构和文件内容存入数据库。

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

#### Scenario: Import ZIP with system config files
- **WHEN** ZIP 中包含 dbt_project.yml 或 packages.yml 文件
- **THEN** 系统 SHALL 跳过这些系统级配置文件，不将其导入到文件表中
- **AND** 其他文件正常导入

### Requirement: Export dbt project to ZIP
系统 SHALL 允许用户将数据库中的项目导出为标准 dbt 工程目录结构的 ZIP 文件。

#### Scenario: Export project with files
- **WHEN** 用户发送 GET /api/dbt/projects/:id/export
- **THEN** 系统根据 dbt_directories 和 dbt_files 重建目录树
- **AND** 每个文件按其 path 写入对应位置，content 作为文件内容
- **AND** 返回 200 状态码，Content-Type 为 application/zip，Content-Disposition 为 attachment
- **AND** ZIP 文件名格式为 "<projectName>.zip"

#### Scenario: Export empty project
- **WHEN** 项目没有任何目录和文件
- **THEN** 系统返回 200 状态码和一个空的 ZIP 文件

#### Scenario: Export non-existent project
- **WHEN** 项目 ID 不存在或已删除
- **THEN** 系统返回 404 状态码

### Requirement: Import transaction safety
导入操作 SHALL 在数据库事务中执行，失败时全部回滚。

#### Scenario: Import rollback on error
- **WHEN** 导入过程中发生错误（如数据库写入失败）
- **THEN** 系统回滚该次导入的所有目录和文件记录
- **AND** 返回 500 状态码和错误信息
- **AND** 数据库保持导入前的状态
