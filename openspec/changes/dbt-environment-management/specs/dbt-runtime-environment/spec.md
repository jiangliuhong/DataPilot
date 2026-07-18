## ADDED Requirements

### Requirement: Runtime Environment CRUD
系统 SHALL 提供运行环境的创建、查询、更新、删除操作。每个运行环境由一个 dbt Core 版本和一个数据库连接组合而成，包含 `name`（唯一名称）、`versionId`（关联版本）、`connectionId`（关联连接）和 `status`（active/inactive）。

#### Scenario: 创建运行环境成功
- **WHEN** 用户提交 `{ name: "dev-env", versionId: 1, connectionId: 2 }` 且版本和连接均存在且适配器兼容性校验通过
- **THEN** 系统创建运行环境记录并返回 201，`status` 默认为 `active`

#### Scenario: 创建运行环境时 name 重复
- **WHEN** 用户提交的 `name` 与已存在（未软删除）的运行环境相同
- **THEN** 系统返回 409 错误，提示环境名称已存在

#### Scenario: 创建运行环境时版本不存在
- **WHEN** 用户提交的 `versionId` 对应的版本不存在或已软删除
- **THEN** 系统返回 404 错误，提示版本不存在

#### Scenario: 创建运行环境时连接不存在
- **WHEN** 用户提交的 `connectionId` 对应的连接不存在或已软删除
- **THEN** 系统返回 404 错误，提示连接不存在

#### Scenario: 查询运行环境列表
- **WHEN** 用户请求 `GET /api/dbt/environments` 并传入 `limit` 和 `offset` 分页参数
- **THEN** 系统返回分页结果 `{ items, total, limit, offset }`，按 `createdAt` 降序排列，排除已软删除记录

#### Scenario: 按 status 过滤
- **WHEN** 用户请求 `GET /api/dbt/environments?status=active`
- **THEN** 系统仅返回 `status` 为 `active` 的运行环境

#### Scenario: 查询运行环境详情
- **WHEN** 用户请求 `GET /api/dbt/environments/[id]`
- **THEN** 系统返回运行环境完整信息，包含关联的版本和连接摘要（版本名、连接名、数据库类型）；若不存在或已软删除则返回 404

#### Scenario: 更新运行环境信息
- **WHEN** 用户提交 `PUT /api/dbt/environments/[id]` 并传入需更新的字段
- **THEN** 系统更新指定字段并返回更新后的完整记录；若更新涉及 `versionId` 或 `connectionId` 变更，重新执行适配器兼容性校验；若不存在返回 404

#### Scenario: 删除运行环境
- **WHEN** 用户提交 `DELETE /api/dbt/environments/[id]`
- **THEN** 系统执行软删除（设置 `deletedAt`）；若不存在返回 404；若该环境被项目绑定则返回 409 拒绝删除

### Requirement: 适配器兼容性校验
创建或更新运行环境时，系统 SHALL 校验所选 dbt Core 版本的 `adapterPackages` 是否支持目标数据库连接的 `databaseType`。

#### Scenario: 兼容性校验通过
- **WHEN** 用户创建运行环境，版本的 `adapterPackages` 中包含匹配连接 `databaseType`（如 `mysql8`）的适配器包
- **THEN** 系统允许创建并返回 201

#### Scenario: 兼容性校验失败
- **WHEN** 用户创建运行环境，版本的 `adapterPackages` 中没有任何适配器包的 `supportedDatabases` 包含连接的 `databaseType`（如版本仅支持 mysql5/mysql8 但连接类型为 postgresql）
- **THEN** 系统返回 400 错误，提示该版本不支持目标数据库类型

#### Scenario: 更新连接触发重新校验
- **WHEN** 用户更新运行环境的 `connectionId` 为一个不同数据库类型的连接
- **THEN** 系统重新执行适配器兼容性校验，校验失败则拒绝更新并返回 400

#### Scenario: 更新版本触发重新校验
- **WHEN** 用户更新运行环境的 `versionId` 为一个不同版本
- **THEN** 系统重新执行适配器兼容性校验，校验失败则拒绝更新并返回 400

### Requirement: 运行环境输入校验
系统 SHALL 使用 Zod schema 校验所有运行环境相关的输入参数。

#### Scenario: 创建时缺少必填字段
- **WHEN** 用户提交缺少 `name`、`versionId` 或 `connectionId` 的数据
- **THEN** 系统返回 400 校验错误

#### Scenario: name 长度超限
- **WHEN** 用户提交 `{ name: "a".repeat(256) }`
- **THEN** 系统返回 400 校验错误

#### Scenario: versionId 或 connectionId 非正整数
- **WHEN** 用户提交 `{ versionId: -1 }` 或 `{ connectionId: 0 }`
- **THEN** 系统返回 400 校验错误
