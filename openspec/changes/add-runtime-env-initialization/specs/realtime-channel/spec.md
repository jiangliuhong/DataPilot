## ADDED Requirements

### Requirement: Custom Server 启动
系统 SHALL 通过 custom server（`server.ts` 包装 `next()`）启动，在同一个 HTTP server 实例上同时承载 Next.js 应用与 WebSocket 服务，保留 Next.js 的全部能力（含 Turbopack dev）。

#### Scenario: 启动并同时承载 HTTP 与 WebSocket
- **WHEN** 执行启动命令（开发或生产）
- **THEN** 系统使用 `next({ dev })` 准备应用，用 Node `http.createServer` 接收所有 HTTP 请求转交 Next 处理，并在同一 server 实例上挂载 `ws` 的 WebSocketServer

#### Scenario: 普通 HTTP 请求不受影响
- **WHEN** 客户端发起任意现有页面或 `/api/*` 请求
- **THEN** 请求由 Next.js 的 request handler 正常处理，行为与改用 custom server 之前一致

#### Scenario: WebSocket 仅拦截 /ws 路径
- **WHEN** 客户端发起 HTTP 升级请求
- **THEN** 仅当目标路径为 `/ws` 时由 WebSocket 服务接管，其余升级请求交回 Next.js 处理

### Requirement: WebSocket 连接与消息协议
系统 SHALL 实现基于 JSON 的极简 WebSocket 消息协议，支持客户端按主题订阅与取消订阅。

#### Scenario: 客户端订阅主题
- **WHEN** 已连接的客户端发送 `{ type: "subscribe", topic: "<topic>" }`
- **THEN** 系统将该 WebSocket 连接加入该主题的订阅集合

#### Scenario: 客户端取消订阅主题
- **WHEN** 已连接的客户端发送 `{ type: "unsubscribe", topic: "<topic>" }`
- **THEN** 系统将该 WebSocket 连接从该主题的订阅集合移除

#### Scenario: 连接断开清理订阅
- **WHEN** 一个 WebSocket 连接断开
- **THEN** 系统将该连接从其所有已订阅主题中移除

#### Scenario: 忽略非法消息
- **WHEN** 客户端发送无法解析或未知 `type` 的消息
- **THEN** 系统忽略该消息且不断开连接

### Requirement: 进程内事件总线
系统 SHALL 提供与传输解耦的进程内事件总线，业务代码通过发布事件推送数据，由 WebSocket 服务转发给订阅者。

#### Scenario: 发布事件
- **WHEN** 业务代码调用 `publish(topic, event, data)`
- **THEN** 事件总线向所有订阅者（包括 WebSocket 服务）派发该事件

#### Scenario: 无订阅者时安全发布
- **WHEN** 业务代码对一个当前无订阅者的主题发布事件
- **THEN** 事件不产生副作用，发布立即返回，不报错

#### Scenario: 事件转发给 WebSocket 订阅者
- **WHEN** 事件总线收到某主题的事件，且该主题有 WebSocket 订阅者
- **THEN** WebSocket 服务将事件封装为 `{ type: "event", topic, event, data }` 推送给所有订阅该主题的 WebSocket 连接

### Requirement: 主题命名空间
系统 SHALL 使用分层命名空间的主题字符串，支持多业务复用同一实时通道。

#### Scenario: 主题命名格式
- **WHEN** 业务方定义主题
- **THEN** 主题采用 `<domain>:<id>:<action>` 格式（如 `environment:5:init`），保证不同业务的主题互不冲突
