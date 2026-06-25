## MODIFIED Requirements

### Requirement: Runtime Environment CRUD
系统 SHALL 提供运行环境的创建、查询、更新、删除操作。每个运行环境由一个 dbt Core 版本和一个数据库连接组合而成，包含 `name`（唯一名称）、`versionId`（关联版本）、`connectionId`（关联连接）、`status`（active/inactive）以及初始化相关字段 `initializationStatus`（pending/running/initialized/failed，默认 pending）、`venvPath`（虚拟环境磁盘路径，可空）、`initializedAt`（初始化完成时间，可空）、`lastErrorMessage`（最近一次初始化失败原因，可空）。

查询接口（列表与详情）SHALL 返回上述全部初始化相关字段。删除运行环境时，系统 SHALL 在软删除数据库记录的同时，尝试递归清理 `venvPath` 指向的虚拟环境目录；清理失败 SHALL NOT 阻塞删除，仅记录日志。

#### Scenario: 创建运行环境成功
- **WHEN** 用户提交 `{ name: "dev-env", versionId: 1, connectionId: 2 }` 且版本和连接均存在且适配器兼容性校验通过
- **THEN** 系统创建运行环境记录并返回 201，`status` 默认为 `active`，`initializationStatus` 默认为 `pending`，`venvPath`/`initializedAt`/`lastErrorMessage` 为空

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
- **THEN** 系统返回分页结果 `{ items, total, limit, offset }`，按 `createdAt` 降序排列，排除已软删除记录，每个 item 包含 `initializationStatus`、`venvPath`、`initializedAt`、`lastErrorMessage` 字段

#### Scenario: 按 status 过滤
- **WHEN** 用户请求 `GET /api/dbt/environments?status=active`
- **THEN** 系统仅返回 `status` 为 `active` 的运行环境

#### Scenario: 查询运行环境详情
- **WHEN** 用户请求 `GET /api/dbt/environments/[id]`
- **THEN** 系统返回运行环境完整信息，包含关联的版本和连接摘要（版本名、连接名、数据库类型）以及全部初始化字段；若不存在或已软删除则返回 404

#### Scenario: 更新运行环境信息
- **WHEN** 用户提交 `PUT /api/dbt/environments/[id]` 并传入需更新的字段
- **THEN** 系统更新指定字段并返回更新后的完整记录；若更新涉及 `versionId` 或 `connectionId` 变更，重新执行适配器兼容性校验；若不存在返回 404

#### Scenario: 删除运行环境并清理 venv
- **WHEN** 用户提交 `DELETE /api/dbt/environments/[id]` 且该环境未被项目绑定
- **THEN** 系统软删除数据库记录（设置 `deletedAt`），并递归删除 `venvPath` 指向的虚拟环境目录；返回成功

#### Scenario: 删除运行环境时 venv 清理失败
- **WHEN** 用户提交 `DELETE /api/dbt/environments/[id]`，且 `venvPath` 指向的目录因权限等原因无法删除
- **THEN** 系统仍完成数据库软删除并返回成功，文件清理失败仅记录到服务端日志，不向用户报错

#### Scenario: 删除运行环境时存在项目绑定
- **WHEN** 用户提交 `DELETE /api/dbt/environments/[id]` 且该环境已被项目绑定
- **THEN** 系统返回 409 拒绝删除，提示环境已被项目绑定
