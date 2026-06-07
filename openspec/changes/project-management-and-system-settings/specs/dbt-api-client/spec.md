## ADDED Requirements

### Requirement: Base request utility
系统 SHALL 提供 `request.ts` 基础请求工具函数，封装 fetch 调用，统一处理 JSON 序列化/反序列化、错误响应解析、Content-Type 头设置。

#### Scenario: Successful GET request
- **WHEN** 调用 `request("/api/dbt/projects", { method: "GET" })`
- **THEN** 系统 SHALL 发起 fetch 请求并返回解析后的 JSON 响应

#### Scenario: Error response handling
- **WHEN** API 返回 4xx/5xx 状态码
- **THEN** 系统 SHALL 抛出包含 error 信息的 Error 对象，供调用方捕获展示

### Requirement: Project API client
系统 SHALL 提供 `project.ts` 封装项目相关 API：list（带分页和状态过滤）、get、create、update、delete。

#### Scenario: List projects with pagination
- **WHEN** 调用 `projectApi.list({ limit: 10, offset: 0, status: "active" })`
- **THEN** 系统 SHALL GET `/api/dbt/projects?limit=10&offset=0&status=active` 并返回 `{ items, total, limit, offset }`

### Requirement: Directory API client
系统 SHALL 提供 `directory.ts` 封装目录相关 API：list、create、update、delete、getTree。

#### Scenario: Get directory tree
- **WHEN** 调用 `directoryApi.getTree(projectId)`
- **THEN** 系统 SHALL GET `/api/dbt/projects/:projectId/tree` 并返回嵌套目录树数组

### Requirement: File API client
系统 SHALL 提供 `file.ts` 封装文件相关 API：list（带分页和过滤）、get、create、update、delete。

#### Scenario: List files filtered by directory
- **WHEN** 调用 `fileApi.list(projectId, { directoryId: 2 })`
- **THEN** 系统 SHALL GET `/api/dbt/projects/:projectId/files?directoryId=2` 并返回分页结果

### Requirement: Version API client
系统 SHALL 提供 `version.ts` 封装版本相关 API：list（带分页和过滤）、get、create、update、delete。

#### Scenario: List versions with version filter
- **WHEN** 调用 `versionApi.list({ version: "1.8" })`
- **THEN** 系统 SHALL GET `/api/dbt/versions?version=1.8` 并返回分页结果

### Requirement: Connection API client
系统 SHALL 提供 `connection.ts` 封装连接相关 API：list（带分页和过滤）、get、create、update、delete。

#### Scenario: Create connection
- **WHEN** 调用 `connectionApi.create({ name: "test", databaseType: "mysql8", host: "localhost", port: 3306, databaseName: "db", username: "root", password: "secret" })`
- **THEN** 系统 SHALL POST `/api/dbt/connections` 并返回创建的连接对象（不含密码）

### Requirement: Environment API client
系统 SHALL 提供 `environment.ts` 封装环境相关 API：list（带分页和过滤）、get、create、update、delete。

#### Scenario: Create environment
- **WHEN** 调用 `environmentApi.create({ name: "prod", versionId: 1, connectionId: 1 })`
- **THEN** 系统 SHALL POST `/api/dbt/environments` 并返回创建的环境对象

### Requirement: Project environment API client
系统 SHALL 提供 `project-environment.ts` 封装项目环境绑定相关 API：list、bind、unbind。

#### Scenario: Bind environment to project
- **WHEN** 调用 `projectEnvironmentApi.bind(projectId, { environmentId: 1, environmentAlias: "prod" })`
- **THEN** 系统 SHALL POST `/api/dbt/projects/:projectId/environments` 并返回绑定记录

### Requirement: Import export API client
系统 SHALL 在 `project.ts` 中封装导入导出 API：importProject（multipart 上传）、exportProject（下载 ZIP）。

#### Scenario: Export project
- **WHEN** 调用 `projectApi.export(projectId)`
- **THEN** 系统 SHALL GET `/api/dbt/projects/:projectId/export` 并返回 Blob 用于下载
