## ADDED Requirements

### Requirement: Database Connection CRUD
系统 SHALL 提供数据库连接的创建、查询、更新、删除操作。每个连接记录包含 `name`（唯一名称）、`databaseType`（数据库类型）、`host`、`port`、`databaseName`、`schemaName`（可选）、`username`、`encryptedPassword`（加密存储）和 `extraConfig`（可选额外参数 JSON）。

#### Scenario: 创建连接成功
- **WHEN** 用户提交 `{ name: "prod-mysql", databaseType: "mysql8", host: "10.0.0.1", port: 3306, databaseName: "analytics", username: "dbt_user", password: "secret123" }`
- **THEN** 系统加密 `password` 后存储为 `encryptedPassword`，返回 201，响应中不包含密码原文，仅返回 `hasPassword: true`

#### Scenario: 创建连接时 name 重复
- **WHEN** 用户提交的 `name` 与已存在（未软删除）的连接相同
- **THEN** 系统返回 409 错误，提示连接名称已存在

#### Scenario: 查询连接列表
- **WHEN** 用户请求 `GET /api/dbt/connections` 并传入 `limit` 和 `offset` 分页参数
- **THEN** 系统返回分页结果 `{ items, total, limit, offset }`，按 `createdAt` 降序排列，排除已软删除记录，响应中不包含密码原文

#### Scenario: 按 databaseType 过滤
- **WHEN** 用户请求 `GET /api/dbt/connections?databaseType=mysql8`
- **THEN** 系统仅返回 `databaseType` 为 `mysql8` 的连接记录

#### Scenario: 按 status 过滤
- **WHEN** 用户请求 `GET /api/dbt/connections?status=active`
- **THEN** 系统仅返回 `status` 为 `active` 的连接记录

#### Scenario: 查询连接详情
- **WHEN** 用户请求 `GET /api/dbt/connections/[id]`
- **THEN** 系统返回对应连接的完整信息（不含密码原文，含 `hasPassword`）；若不存在或已软删除则返回 404

#### Scenario: 更新连接信息
- **WHEN** 用户提交 `PUT /api/dbt/connections/[id]` 并传入需更新的字段
- **THEN** 系统更新指定字段并返回更新后的完整记录；若更新包含 `password` 字段则重新加密存储；若不存在返回 404

#### Scenario: 更新连接时不传 password
- **WHEN** 用户提交 `PUT /api/dbt/connections/[id]` 的 body 中不包含 `password` 字段
- **THEN** 系统保持原有密码不变，仅更新其他字段

#### Scenario: 删除连接
- **WHEN** 用户提交 `DELETE /api/dbt/connections/[id]`
- **THEN** 系统执行软删除（设置 `deletedAt`）；若不存在返回 404；若该连接被运行环境引用则返回 409 拒绝删除

### Requirement: 支持四种数据库类型
系统 SHALL 支持以下 `databaseType` 枚举值：`mysql5`、`mysql8`、`starrocks`、`postgresql`。不接受其他值。

#### Scenario: 创建 mysql5 类型连接
- **WHEN** 用户提交 `{ databaseType: "mysql5", ... }`
- **THEN** 系统创建成功

#### Scenario: 创建 mysql8 类型连接
- **WHEN** 用户提交 `{ databaseType: "mysql8", ... }`
- **THEN** 系统创建成功

#### Scenario: 创建 starrocks 类型连接
- **WHEN** 用户提交 `{ databaseType: "starrocks", ... }`
- **THEN** 系统创建成功

#### Scenario: 创建 postgresql 类型连接
- **WHEN** 用户提交 `{ databaseType: "postgresql", ... }`
- **THEN** 系统创建成功

#### Scenario: 创建不支持的数据库类型
- **WHEN** 用户提交 `{ databaseType: "oracle", ... }`
- **THEN** 系统返回 400 校验错误，提示不支持的数据库类型

### Requirement: 密码加密存储
系统 SHALL 使用 AES-256-GCM 对 `password` 字段加密后存储为 `encryptedPassword`。加密密钥从环境变量 `DBT_ENCRYPTION_KEY` 读取。

#### Scenario: 创建连接时密码加密
- **WHEN** 用户提交包含 `password` 的连接数据
- **THEN** 系统使用 AES-256-GCM 加密密码，将 `iv:authTag:ciphertext` 格式的 base64 字符串存入 `encryptedPassword` 字段

#### Scenario: API 响应不返回密码原文
- **WHEN** 系统返回连接信息（列表或详情）
- **THEN** 响应中不包含 `encryptedPassword` 和 `password` 字段，而是返回 `hasPassword: boolean` 表示是否已设置密码

#### Scenario: 更新密码时重新加密
- **WHEN** 用户更新连接信息并包含新的 `password`
- **THEN** 系统使用新的随机 IV 重新加密并覆盖 `encryptedPassword`

#### Scenario: 加密密钥缺失
- **WHEN** 环境变量 `DBT_ENCRYPTION_KEY` 未设置，且用户尝试创建或更新包含密码的连接
- **THEN** 系统返回 500 错误，提示加密配置缺失

### Requirement: Database Connection 输入校验
系统 SHALL 使用 Zod schema 校验所有连接相关的输入参数。

#### Scenario: 创建连接时缺少必填字段
- **WHEN** 用户提交缺少 `host`、`port`、`databaseName`、`username`、`password` 中任一字段的数据
- **THEN** 系统返回 400 校验错误

#### Scenario: port 超出范围
- **WHEN** 用户提交 `{ port: 99999 }`
- **THEN** 系统返回 400 校验错误，port 必须在 1-65535 范围内

#### Scenario: name 长度超限
- **WHEN** 用户提交 `{ name: "a".repeat(256) }`
- **THEN** 系统返回 400 校验错误
