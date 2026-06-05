## ADDED Requirements

### Requirement: 环境绑定到项目
系统 SHALL 支持将运行环境绑定到 dbt 项目，建立多对多关系。每条绑定记录包含 `projectId`、`environmentId` 和可选的 `environmentAlias`（别名，如 "dev"/"staging"/"prod"）。

#### Scenario: 绑定环境到项目成功
- **WHEN** 用户提交 `POST /api/dbt/projects/[id]/environments` 并传入 `{ environmentId: 1 }`
- **THEN** 系统创建绑定记录并返回 201，项目与环境关联成功

#### Scenario: 绑定时指定别名
- **WHEN** 用户提交 `{ environmentId: 1, environmentAlias: "dev" }`
- **THEN** 系统创建绑定记录，`environmentAlias` 存储为 `"dev"`

#### Scenario: 绑定时项目不存在
- **WHEN** 用户请求的 `projectId` 对应的项目不存在或已软删除
- **THEN** 系统返回 404 错误，提示项目不存在

#### Scenario: 绑定时环境不存在
- **WHEN** 用户提交的 `environmentId` 对应的运行环境不存在或已软删除
- **THEN** 系统返回 404 错误，提示运行环境不存在

#### Scenario: 重复绑定
- **WHEN** 用户尝试将同一环境再次绑定到同一项目（绑定已存在且未软删除）
- **THEN** 系统返回 409 错误，提示绑定关系已存在

### Requirement: 查询项目绑定的环境列表
系统 SHALL 支持查询指定项目下已绑定的所有运行环境。

#### Scenario: 查询绑定列表成功
- **WHEN** 用户请求 `GET /api/dbt/projects/[id]/environments`
- **THEN** 系统返回该项目下所有已绑定的运行环境列表，每个条目包含环境详情（名称、状态、关联的版本名称、连接名称、数据库类型）及绑定别名；按 `createdAt` 降序排列

#### Scenario: 查询不存在项目的绑定列表
- **WHEN** 用户请求的 `projectId` 对应的项目不存在或已软删除
- **THEN** 系统返回 404 错误

### Requirement: 解绑环境
系统 SHALL 支持将运行环境从项目中解绑。

#### Scenario: 解绑成功
- **WHEN** 用户提交 `DELETE /api/dbt/projects/[id]/environments/[envId]` 且绑定关系存在
- **THEN** 系统执行软删除（设置绑定记录的 `deletedAt`）并返回 `{ success: true }`

#### Scenario: 解绑时绑定关系不存在
- **WHEN** 用户请求解绑但该绑定关系不存在或已解绑
- **THEN** 系统返回 404 错误

#### Scenario: 解绑时项目不存在
- **WHEN** 用户请求解绑但项目不存在或已软删除
- **THEN** 系统返回 404 错误

### Requirement: 一个环境可绑定多个项目
系统 SHALL 允许同一个运行环境被多个不同的项目绑定，不限制环境复用次数。

#### Scenario: 同一环境绑定到不同项目
- **WHEN** 运行环境 A 已绑定到项目 X，用户将环境 A 再绑定到项目 Y
- **THEN** 系统创建第二条绑定记录，两个项目均可使用环境 A

### Requirement: 一个项目可绑定多个环境
系统 SHALL 允许同一个项目绑定多个不同的运行环境，不限制绑定数量。

#### Scenario: 同一项目绑定多个环境
- **WHEN** 项目 X 已绑定环境 A，用户将环境 B 也绑定到项目 X
- **THEN** 系统创建第二条绑定记录，项目 X 同时关联环境 A 和环境 B

#### Scenario: 不同绑定可使用不同别名
- **WHEN** 项目 X 绑定环境 A 时设置别名为 "dev"，再绑定环境 B 时设置别名为 "prod"
- **THEN** 两条绑定记录分别存储各自的别名，互不影响

### Requirement: 项目环境绑定输入校验
系统 SHALL 使用 Zod schema 校验所有绑定相关的输入参数。

#### Scenario: 绑定时缺少 environmentId
- **WHEN** 用户提交 `{ environmentAlias: "dev" }` 但未传 `environmentId`
- **THEN** 系统返回 400 校验错误

#### Scenario: environmentId 非正整数
- **WHEN** 用户提交 `{ environmentId: -1 }`
- **THEN** 系统返回 400 校验错误

#### Scenario: 别名长度超限
- **WHEN** 用户提交 `{ environmentId: 1, environmentAlias: "a".repeat(256) }`
- **THEN** 系统返回 400 校验错误
