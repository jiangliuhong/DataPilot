## ADDED Requirements

### Requirement: 用户数据模型

系统 SHALL 在数据库中维护 `users` 表，用于存储登录所需的最小用户信息。表 MUST 同时支持项目现有的 MySQL 与 SQLite 两套 dialect（通过 `src/app/db/schema/{mysql,sqlite}/user.ts` 定义，并由 `schema/index.ts` 门面以 MySQL 规范类型统一导出）。

字段 SHALL 至少包含：自增主键 `id`、唯一的 `username`、`passwordHash`、`displayName`、可空的 `email`、`status`（枚举 `active`/`inactive`，默认 `active`）以及 `createdAt`、`updatedAt`、`deletedAt` 三个标准时间戳。所有通过认证链路查询用户的操作 MUST 默认排除 `deletedAt` 非空的记录（软删除）。

#### Scenario: 双驱动 schema 一致导出
- **WHEN** `DB_DRIVER=mysql` 或 `DB_DRIVER=sqlite`
- **THEN** `src/app/db/schema/index.ts` 都能导出 `users` 表对象及 `User` / `NewUser` 类型，且对消费方（repository/service）的类型签名保持一致

#### Scenario: 软删除用户不可登录
- **WHEN** 某用户记录的 `deletedAt` 不为空
- **THEN** 该用户在任何登录或会话解析流程中都不可被查到

---

### Requirement: 登录接口

系统 SHALL 提供 `POST /api/auth/login` 路由，接收 JSON body `{ username, password }`，校验账号密码后签发会话凭证。

路由 MUST 保持 thin：使用 Zod（`auth.schema.ts`）校验请求体、调用 `auth.service` 完成校验与签发、通过 `server/errors/api-error.ts` 返回统一错误响应。路由 MUST NOT 直接访问 Drizzle 或包含密码校验逻辑。

#### Scenario: 登录成功
- **WHEN** 以存在的 `active` 用户、正确的密码发起 `POST /api/auth/login`
- **THEN** 系统返回 200 与脱敏的用户信息（不含 `passwordHash`），并在响应上设置一个 `httpOnly`、`SameSite=Lax` 的会话 Cookie（值为 HS256 JWT，含 `sub`(userId)、`username`、`exp`）

#### Scenario: 账号或密码错误
- **WHEN** 用户名不存在、密码不匹配，或用户为 `inactive`
- **THEN** 系统返回 401，且错误消息不得区分「用户不存在」与「密码错误」（统一为「用户名或密码错误」），以防止账号枚举

#### Scenario: 请求体校验失败
- **WHEN** body 缺少 `username` 或 `password`，或字段为空
- **THEN** 系统返回 400 及 Zod 校验错误信息

#### Scenario: 密码以 scrypt 存储
- **WHEN** 任意用户被创建时
- **THEN** 其密码必须以 Node `crypto.scrypt` 生成的哈希（含随机 salt）存于 `passwordHash`，明文绝不入库、绝不出现在任何 API 响应中

---

### Requirement: 登出接口

系统 SHALL 提供 `POST /api/auth/logout` 路由，用于终止当前会话。登出 MUST 通过清除会话 Cookie 实现，且无需校验当前是否已登录（幂等）。

#### Scenario: 登出成功
- **WHEN** 发起 `POST /api/auth/logout`（无论当前是否登录）
- **THEN** 系统返回 200，并清除会话 Cookie

---

### Requirement: 会话解析与当前用户

系统 SHALL 提供会话解析能力（`auth.service.getCurrentUser` / `authApi.me`），从请求的会话 Cookie 中解析 JWT 并返回脱敏的当前用户。

解析 MUST 校验 JWT 签名（HS256，使用 `AUTH_JWT_SECRET`）与 `exp` 过期时间；签名无效或过期的 token 视为未登录。

#### Scenario: 有效会话
- **WHEN** 携带有效且未过期的会话 Cookie 请求当前用户
- **THEN** 返回 200 与脱敏用户信息（不含 `passwordHash`）

#### Scenario: 无效或过期会话
- **WHEN** 会话 Cookie 缺失、签名无效或已过期
- **THEN** 返回 401（未登录态）

---

### Requirement: 登录页 UI

系统 SHALL 提供独立的登录页路由 `/login`（`app/login/page.tsx`），渲染基于 HeroUI 的登录表单（`web/features/auth/components/login-form.tsx`）。登录页 MUST NOT 嵌入现有带左侧栏的 `AppLayout`，应呈现为独立的居中卡片式布局。

表单 SHALL 包含用户名、密码输入与「登录」按钮，并具备加载态与错误态展示；提交 MUST 通过 `web/api-client/auth.ts`（`authApi`）调用后端，而非直接 `fetch`。

#### Scenario: 渲染登录表单
- **WHEN** 未登录用户访问 `/login`
- **THEN** 页面显示一个居中的登录卡片，含用户名、密码输入框与登录按钮，使用 HeroUI 组件

#### Scenario: 登录成功跳转
- **WHEN** 用户输入正确凭据并点击登录
- **THEN** 表单进入加载态，登录成功后跳转至根页面 `/`

#### Scenario: 登录失败展示错误
- **WHEN** 登录请求返回非 2xx（如 401）
- **THEN** 表单在登录按钮上方/下方展示错误提示（如「用户名或密码错误」），输入框保留用户名以便重试，密码框清空
