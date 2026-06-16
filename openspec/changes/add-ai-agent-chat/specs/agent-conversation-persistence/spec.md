## ADDED Requirements

### Requirement: 会话表结构
系统 SHALL 新增 `agent_conversations` 表，字段包括：`id`（自增主键）、`title`（varchar 255，会话标题）、`createdAt`、`updatedAt`、`deletedAt`（软删除）。表 SHALL 同时提供 MySQL 和 SQLite 两套 schema 定义，通过 `src/app/db/schema/index.ts` 的 dialect facade 统一导出。

#### Scenario: 表创建
- **WHEN** 执行数据库 migration
- **THEN** `agent_conversations` 表在 MySQL 和 SQLite 两种驱动下均被创建，字段类型与现有 dbt 表保持一致的命名约定（snake_case 列名、`createdAt/updatedAt/deletedAt` 标准字段）

#### Scenario: 软删除字段
- **WHEN** 查询会话列表
- **THEN** repository SHALL 默认排除 `deletedAt IS NOT NULL` 的记录，与其他 repository 的软删除约定一致

### Requirement: 消息表结构
系统 SHALL 新增 `agent_messages` 表，字段包括：`id`（自增主键）、`conversationId`（外键关联 agent_conversations.id）、`role`（enum: `user`、`assistant`、`tool`）、`content`（text，可空）、`toolCalls`（json，可空，assistant 消息的工具调用数组）、`toolCallId`（varchar，可空，tool 消息关联的调用 id）、`createdAt`。

#### Scenario: 表创建
- **WHEN** 执行数据库 migration
- **THEN** `agent_messages` 表在两种驱动下均被创建，`conversationId` 建立外键关联到 `agent_conversations.id`

#### Scenario: JSON 字段跨驱动
- **WHEN** 在 SQLite 驱动下读写 `toolCalls` 字段
- **THEN** repository SHALL 使用 `JSON.parse/stringify` 显式序列化/反序列化，保证与 MySQL 的 `json` 列行为一致

### Requirement: 会话 Repository
系统 SHALL 提供 `conversation.repository.ts`，作为 `agent_conversations` 表的唯一数据访问层。Repository SHALL 提供创建、按 ID 查询、列表查询（分页 + 排除软删除）、更新标题、软删除方法。Repository MUST NOT 包含业务逻辑。

#### Scenario: 创建会话
- **WHEN** service 调用 `create({ title })`
- **THEN** repository 插入一条记录并返回新建的会话（含 id、createdAt）

#### Scenario: 列表查询
- **WHEN** service 调用 `findList({ limit, offset })`
- **THEN** repository 返回 `{ items, total, limit, offset }`，items 按 `createdAt` 倒序，排除软删除记录

#### Scenario: 更新标题
- **WHEN** service 调用 `updateTitle(id, title)`
- **THEN** repository 更新该会话的 `title` 和 `updatedAt`，返回更新后的记录

#### Scenario: 软删除
- **WHEN** service 调用 `softDelete(id)`
- **THEN** repository 设置该会话的 `deletedAt` 为当前时间，后续查询不再返回该记录

### Requirement: 消息 Repository
系统 SHALL 提供 `message.repository.ts`，作为 `agent_messages` 表的唯一数据访问层。Repository SHALL 提供批量创建、按会话查询（按时间正序）、单条创建方法。Repository MUST NOT 包含业务逻辑。

#### Scenario: 按会话查询消息
- **WHEN** service 调用 `findByConversationId(conversationId)`
- **THEN** repository 返回该会话下所有消息，按 `createdAt` 正序排列（用于重建对话上下文）

#### Scenario: 创建 user 消息
- **WHEN** service 调用 `create({ conversationId, role: "user", content })`
- **THEN** repository 插入一条 role 为 `user` 的消息记录，`toolCalls` 和 `toolCallId` 为空

#### Scenario: 创建 assistant 消息
- **WHEN** service 调用 `create({ conversationId, role: "assistant", content, toolCalls })`
- **THEN** repository 插入一条 role 为 `assistant` 的消息记录，`toolCalls` 字段序列化存储

#### Scenario: 创建 tool 消息
- **WHEN** service 调用 `create({ conversationId, role: "tool", content, toolCallId })`
- **THEN** repository 插入一条 role 为 `tool` 的消息记录，`toolCallId` 关联到对应的 assistant 消息工具调用

### Requirement: 会话 CRUD 接口
系统 SHALL 提供会话的 REST 接口：`GET /api/agent/conversations`（列表）、`POST /api/agent/conversations`（创建）、`GET /api/agent/conversations/:id`（详情）、`DELETE /api/agent/conversations/:id`（软删除）、`GET /api/agent/conversations/:id/messages`（会话消息列表）。接口 SHALL 保持 thin，仅做校验、调用 service、返回响应。

#### Scenario: 创建会话
- **WHEN** 客户端 POST `/api/agent/conversations`（body 可选 `{ title }`）
- **THEN** 接口校验后调用 service 创建会话（title 缺省时使用"新对话"），返回 201 和新建会话对象

#### Scenario: 查询会话列表
- **WHEN** 客户端 GET `/api/agent/conversations?limit=20&offset=0`
- **THEN** 接口校验查询参数后调用 service，返回 `{ items, total, limit, offset }`

#### Scenario: 查询会话消息
- **WHEN** 客户端 GET `/api/agent/conversations/1/messages`
- **THEN** 接口校验会话存在后调用 service，返回该会话的消息数组（按时间正序）；会话不存在返回 404

#### Scenario: 软删除会话
- **WHEN** 客户端 DELETE `/api/agent/conversations/1`
- **THEN** 接口调用 service 软删除会话，返回 204；不实际删除消息记录（消息随会话不可见）

### Requirement: 会话标题自动生成
创建会话时若未提供 title，系统 SHALL 使用默认标题"新对话"。会话的首条 user 消息持久化后，service SHALL 将会话标题更新为该消息内容截断至 30 字符（仅当当前标题为"新对话"时）。

#### Scenario: 默认标题
- **WHEN** 创建会话时未传 title
- **THEN** 会话标题为"新对话"

#### Scenario: 首条消息生成标题
- **WHEN** 一个标题为"新对话"的会话收到首条 user 消息"帮我列出所有活跃的项目"
- **THEN** service SHALL 将该会话标题更新为"帮我列出所有活跃的项目"（截断至 30 字符），会话列表刷新后显示新标题

#### Scenario: 已有自定义标题不覆盖
- **WHEN** 一个标题为"数据分析会话"的会话收到新消息
- **THEN** service SHALL 不修改标题（仅"新对话"默认标题会被首条消息覆盖）
