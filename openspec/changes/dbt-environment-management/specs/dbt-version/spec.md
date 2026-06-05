## ADDED Requirements

### Requirement: Version CRUD
系统 SHALL 提供 dbt Core 版本的创建、查询、更新、删除操作。每个版本记录包含 `name`（唯一名称）、`version`（版本号）、`adapter_packages`（适配器包 JSON）、`dependencies`（Python 依赖 JSON）和 `status`（active/inactive）。

#### Scenario: 创建版本成功
- **WHEN** 用户提交 `{ name: "dbt-core-1.8.0", version: "1.8.0", adapterPackages: [...], dependencies: [...] }`
- **THEN** 系统创建版本记录并返回 201，`status` 默认为 `active`

#### Scenario: 创建版本时 name 重复
- **WHEN** 用户提交的 `name` 与已存在（未软删除）的版本相同
- **THEN** 系统返回 409 错误，提示版本名称已存在

#### Scenario: 查询版本列表
- **WHEN** 用户请求 `GET /api/dbt/versions` 并传入 `limit` 和 `offset` 分页参数
- **THEN** 系统返回分页结果 `{ items, total, limit, offset }`，按 `createdAt` 降序排列，排除已软删除记录

#### Scenario: 按 version 值过滤
- **WHEN** 用户请求 `GET /api/dbt/versions?version=1.8.0` 或 `GET /api/dbt/versions?version=latest`
- **THEN** 系统仅返回 `version` 字段匹配的版本记录

#### Scenario: 按 status 过滤
- **WHEN** 用户请求 `GET /api/dbt/versions?status=active`
- **THEN** 系统仅返回 `status` 为 `active` 的版本记录

#### Scenario: 查询版本详情
- **WHEN** 用户请求 `GET /api/dbt/versions/[id]`
- **THEN** 系统返回对应版本的完整信息；若不存在或已软删除则返回 404

#### Scenario: 更新版本信息
- **WHEN** 用户提交 `PUT /api/dbt/versions/[id]` 并传入需更新的字段
- **THEN** 系统更新指定字段并返回更新后的完整记录；若不存在返回 404

#### Scenario: 删除版本
- **WHEN** 用户提交 `DELETE /api/dbt/versions/[id]`
- **THEN** 系统执行软删除（设置 `deletedAt`）；若不存在返回 404；若该版本被运行环境引用则返回 409 拒绝删除

### Requirement: Version 字段值支持 latest
`version` 字段 SHALL 允许两种取值：具体 semver 版本号（如 `"1.8.0"`）和 `"latest"`。`"latest"` 表示追踪最新版本，不做互斥约束，可存在多条 `version` 为 `"latest"` 的记录。

#### Scenario: 创建 latest 版本
- **WHEN** 用户提交 `{ name: "dbt-core-latest", version: "latest", adapterPackages: [{"name":"dbt-mysql","version":"latest",...}], dependencies: [{"name":"dbt-core","version":"latest"}] }`
- **THEN** 系统创建成功，`version` 值存储为 `"latest"`

#### Scenario: latest 版本不互斥
- **WHEN** 已存在一条 `version` 为 `"latest"` 的记录，用户再创建另一条 `version` 为 `"latest"` 的记录（`name` 不同）
- **THEN** 系统允许创建，两条记录并存

### Requirement: Adapter packages 数据结构
`adapterPackages` 字段 SHALL 为 JSON 数组，每个元素包含 `name`（包名）、`version`（支持 `"latest"` 或具体版本号）和 `supportedDatabases`（支持的数据库类型数组）。

#### Scenario: 创建版本时校验 adapterPackages 结构
- **WHEN** 用户提交的 `adapterPackages` 中某项缺少 `name`、`version` 或 `supportedDatabases` 字段
- **THEN** 系统返回 400 校验错误

#### Scenario: adapterPackages 的 version 支持 latest
- **WHEN** 用户提交 `{ adapterPackages: [{"name":"dbt-mysql","version":"latest","supportedDatabases":["mysql5","mysql8"]}] }`
- **THEN** 系统接受 `"latest"` 作为合法 version 值

### Requirement: Dependencies 数据结构
`dependencies` 字段 SHALL 为 JSON 数组，每个元素包含 `name`（包名）和 `version`（支持 `"latest"` 或具体版本号）。

#### Scenario: 创建版本时校验 dependencies 结构
- **WHEN** 用户提交的 `dependencies` 中某项缺少 `name` 或 `version` 字段
- **THEN** 系统返回 400 校验错误

### Requirement: Version 输入校验
系统 SHALL 使用 Zod schema 校验所有版本相关的输入参数。

#### Scenario: 创建版本时 name 为空
- **WHEN** 用户提交 `{ name: "", version: "1.8.0" }`
- **THEN** 系统返回 400 校验错误

#### Scenario: 创建版本时 version 格式不合法
- **WHEN** 用户提交 `{ name: "dbt-core-test", version: "" }`
- **THEN** 系统返回 400 校验错误

#### Scenario: 分页参数超限
- **WHEN** 用户请求 `GET /api/dbt/versions?limit=200`
- **THEN** 系统使用最大值 100 进行分页
