## ADDED Requirements

### Requirement: API documentation HTML file
系统 SHALL 在 `docs/api.html` 中提供完整的 API 接口文档。

#### Scenario: Documentation file exists and is accessible
- **WHEN** 开发者打开 docs/api.html
- **THEN** 文件包含所有本次新增 API 端点的完整说明

### Requirement: Documentation content completeness
API 文档 SHALL 包含每个端点的以下信息。

#### Scenario: Each endpoint documented with full details
- **WHEN** 开发者查看任意一个 API 端点的文档
- **THEN** 文档包含：HTTP 方法、URL 路径、请求参数说明（query 参数、body 参数）、请求示例（curl 或 JSON）、成功响应示例（含状态码）、错误响应示例（含状态码和错误信息）

### Requirement: Documentation covers all endpoints
API 文档 SHALL 覆盖所有新增的 API 端点。

#### Scenario: All project CRUD endpoints documented
- **WHEN** 开发者查看文档
- **THEN** 以下端点均有完整说明：
  - POST /api/dbt/projects
  - GET /api/dbt/projects
  - GET /api/dbt/projects/:id
  - PUT /api/dbt/projects/:id
  - DELETE /api/dbt/projects/:id

#### Scenario: All directory management endpoints documented
- **WHEN** 开发者查看文档
- **THEN** 以下端点均有完整说明：
  - POST /api/dbt/projects/:id/directories
  - GET /api/dbt/projects/:id/directories
  - GET /api/dbt/projects/:id/tree
  - PUT /api/dbt/projects/:id/directories/:dirId
  - DELETE /api/dbt/projects/:id/directories/:dirId

#### Scenario: All file management endpoints documented
- **WHEN** 开发者查看文档
- **THEN** 以下端点均有完整说明：
  - POST /api/dbt/projects/:id/files
  - GET /api/dbt/projects/:id/files
  - GET /api/dbt/projects/:id/files/:fileId
  - PUT /api/dbt/projects/:id/files/:fileId
  - DELETE /api/dbt/projects/:id/files/:fileId

#### Scenario: Import and export endpoints documented
- **WHEN** 开发者查看文档
- **THEN** 以下端点均有完整说明：
  - POST /api/dbt/projects/:id/import
  - GET /api/dbt/projects/:id/export

### Requirement: Documentation format
API 文档 SHALL 使用中文编写，格式为独立可访问的 HTML 文件。

#### Scenario: Documentation is self-contained HTML
- **WHEN** 开发者在浏览器中直接打开 docs/api.html
- **THEN** 页面无需外部依赖即可正常渲染（CSS 内联或使用浏览器原生样式）
- **AND** 页面使用中文编写所有说明文字
- **AND** 页面有清晰的目录导航，便于快速定位各端点
