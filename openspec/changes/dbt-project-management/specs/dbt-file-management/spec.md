## ADDED Requirements

### Requirement: Create file
系统 SHALL 允许用户在指定目录（或项目根目录）下创建文件。

#### Scenario: Create file in directory
- **WHEN** 用户发送 POST /api/dbt/projects/:id/files，body 包含 name="stg_users.sql"，directoryId=<目录id>，content="SELECT * FROM users"
- **THEN** 系统创建文件，返回 201 状态码和文件对象（包含 id, projectId, directoryId, name, path="models/staging/stg_users.sql", content, fileType="sql", size=21, createdAt, updatedAt）
- **AND** path 由系统根据目录 path + name 自动计算
- **AND** size 为 content 的字节长度
- **AND** fileType 由系统根据文件扩展名自动检测

#### Scenario: Create file at project root
- **WHEN** 用户发送 POST /api/dbt/projects/:id/files，body 包含 name="packages.yml"，directoryId 为 null 或不传，content="packages: []"
- **THEN** 系统创建文件，path="packages.yml"，directoryId=null

#### Scenario: Create file with duplicate name in same directory
- **WHEN** 用户在同一目录下创建同名文件 name="stg_users.sql"
- **THEN** 系统返回 409 状态码和错误信息 "File already exists in this directory"

#### Scenario: Create file with unsupported type
- **WHEN** 用户创建文件扩展名不在支持列表（sql, yml, yaml, md, py, csv, json, txt）中
- **THEN** 系统返回 400 状态码和错误信息 "Unsupported file type"

### Requirement: Get file by ID
系统 SHALL 允许用户通过文件 ID 获取文件详情。

#### Scenario: Get existing file
- **WHEN** 用户发送 GET /api/dbt/projects/:id/files/:fileId，文件存在且未删除
- **THEN** 系统返回 200 状态码和完整文件对象（包含 content）

#### Scenario: Get non-existent file
- **WHEN** 用户获取不存在的文件
- **THEN** 系统返回 404 状态码

### Requirement: List files
系统 SHALL 返回指定项目或目录下的文件列表。

#### Scenario: List all files in project
- **WHEN** 用户发送 GET /api/dbt/projects/:id/files
- **THEN** 系统返回 200 状态码和文件数组（不包含 content 字段，仅返回 id, name, path, fileType, size, directoryId, createdAt, updatedAt）

#### Scenario: List files in directory
- **WHEN** 用户发送 GET /api/dbt/projects/:id/files?directoryId=<dirId>
- **THEN** 系统返回 200 状态码，仅包含指定目录下的文件（不含子目录的文件）

#### Scenario: List files with pagination
- **WHEN** 用户发送 GET /api/dbt/projects/:id/files?limit=10&offset=0
- **THEN** 系统返回 200 状态码，body 包含 { items: File[], total: number, limit: 10, offset: 0 }

#### Scenario: List files filtered by fileType
- **WHEN** 用户发送 GET /api/dbt/projects/:id/files?fileType=sql
- **THEN** 系统仅返回 fileType="sql" 的文件

### Requirement: Update file content
系统 SHALL 允许用户更新文件的内容和名称。

#### Scenario: Update file content
- **WHEN** 用户发送 PUT /api/dbt/projects/:id/files/:fileId，body 包含 content="SELECT id, name FROM users WHERE active = true"
- **THEN** 系统更新 content，重新计算 size，更新 updatedAt，返回 200 状态码

#### Scenario: Rename file
- **WHEN** 用户发送 PUT /api/dbt/projects/:id/files/:fileId，body 包含 name="stg_active_users.sql"
- **THEN** 系统更新 name，重新计算 path（保持目录前缀不变），更新 updatedAt

#### Scenario: Move file to another directory
- **WHEN** 用户发送 PUT /api/dbt/projects/:id/files/:fileId，body 包含 directoryId=<newDirId>
- **THEN** 系统更新 directoryId，重新计算 path

#### Scenario: Update non-existent file
- **WHEN** 用户更新不存在的文件
- **THEN** 系统返回 404 状态码

### Requirement: Delete file
系统 SHALL 支持文件的软删除。

#### Scenario: Delete existing file
- **WHEN** 用户发送 DELETE /api/dbt/projects/:id/files/:fileId
- **THEN** 系统将文件的 deletedAt 设为当前时间，返回 200 状态码
- **AND** 后续查询不再返回该文件

#### Scenario: Delete non-existent file
- **WHEN** 用户删除不存在的文件
- **THEN** 系统返回 404 状态码

### Requirement: File type detection
系统 SHALL 根据文件扩展名自动检测 fileType 字段。

#### Scenario: Detect SQL file type
- **WHEN** 用户创建文件 name="query.sql"
- **THEN** fileType 自动设为 "sql"

#### Scenario: Detect YAML file type
- **WHEN** 用户创建文件 name="schema.yml" 或 name="config.yaml"
- **THEN** fileType 自动设为 "yml"

#### Scenario: Detect Python file type
- **WHEN** 用户创建文件 name="transform.py"
- **THEN** fileType 自动设为 "py"
