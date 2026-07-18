## Context

DataPilot 是一个 Next.js App Router 应用，采用严格的前后端分离 + 分层架构（Route → Service → Repository → Drizzle）。当前没有任何用户/认证概念，所有页面与 API 对任意访问者开放。

已有约定（设计需遵循）：
- 双数据库驱动：`src/app/db/schema/{mysql,sqlite}/`，`schema/index.ts` 按 `DB_DRIVER` 选择 dialect，对外统一以 MySQL 类型为准；列名 snake_case（如 `created_at`）、软删除用 `deletedAt`、自增 `id`。
- Repository First：查询只能在 repository；service 调 repository；route 保持 thin（参考 `version.route/service/repository/schema`）。
- `server/lib/crypto.ts` 已有 AES-256-GCM 对称加密工具（用于 DBT 连接密码），模式可复用：从环境变量读取密钥。
- 错误处理：`server/errors/api-error.ts` 的 `safeExecute` / `badRequest` / `conflict` 等，错误消息含 "not found"/"already exists" 等关键字会被自动映射状态码。
- 前端：`web/api-client/request.ts` 的 `BASE_URL` 当前硬编码 `/api/dbt`（仅服务 dbt 模块）；`web/features/auth` 与 `web/features/user` 目录已存在但为空壳。
- 依赖：`package.json` 中**没有** `next-auth`、`bcrypt`、`jose` 等；项目倾向最小依赖。

约束：本次**仅实现登录**，不含注册、找回密码、角色权限、用户管理页。

## Goals / Non-Goals

**Goals:**
- 建立 `users` 数据模型与最小「用户」概念，为后续权限/审计铺路。
- 实现账号密码登录，登录成功后以 httpOnly Cookie 维持会话。
- 提供独立登录页（HeroUI），与现有登录态联动。
- 全程遵循现有分层与双驱动 schema 约定，不引入第三方认证依赖。

**Non-Goals:**
- 用户注册 / 邀请 / 找回密码流程。
- 角色、权限、多租户、组织。
- 用户列表/管理后台页面。
- OAuth/SSO、MFA、登录限流（仅留扩展点，不在本次实现）。
- 对现有 `/` 页面及全部 API 的强制访问控制改造（仅提供登录态判定能力，路由保护留待后续）。

## Decisions

### 1. 认证方式：账号密码 + HS256 JWT（httpOnly Cookie）

**选择**：自实现，登录成功签发 HS256 JWT，写入 `httpOnly` + `SameSite=Lax` 的 Cookie；登出清除 Cookie。

**理由**：
- 项目已有「手写 crypto」的惯例（`crypto.ts` 用原生 `crypto` 做 AES-GCM），JWT HS256 同样可用原生 `crypto.createHmac` 实现，零新依赖。
- NextAuth 会引入额外配置与 provider 模型，对一个仅需「账号密码登录」的内部平台是过度设计。
- Cookie 方式对前端透明（无需手写 `Authorization` 头），且 `httpOnly` 可防 XSS 读取 token。

**备选**：
- NextAuth/Auth.js：功能全但依赖与样板较重，与「最小依赖」倾向冲突。
- 不用 token、仅用签名 Session ID + 服务端存储：需要额外的 session 存储，本次范围外。

### 2. 密码哈希：Node 原生 `scrypt`

**选择**：`crypto.scrypt`（salt + 哈希，格式 `saltHex:hashHex`），存于 `users.passwordHash`。

**理由**：无需引入 `bcrypt`/`argon2` 这类带原生编译依赖的包，`scrypt` 是 Node 内置、内存困难型哈希，安全性足够。新增 `server/lib/password.ts`。

### 3. JWT：原生 `crypto` 手写（不引入 `jsonwebtoken`/`jose`）

**选择**：在 `server/lib/jwt.ts` 中实现 `sign`/`verify`（HS256），payload 含 `sub`(userId)、`username`、`exp`。新增 `server/lib/cookie.ts` 负责在 Route 的 `Response` 上读写/清除 Cookie。

**理由**：JWT 结构极简（`base64url(header).base64url(payload).hmac`），用原生 `crypto` 即可，保持零新增依赖。`exp` 默认 7 天。

**备选**：`jose`（支持更多算法与 JWKS），但当前只用单机对称密钥，无收益。

### 4. 用户表设计（遵循双驱动 + 软删除约定）

`users` 表字段：`id`(自增主键)、`username`(唯一)、`passwordHash`、`displayName`、`email`(可空)、`status`(enum: `active`/`inactive`)、`createdAt`、`updatedAt`、`deletedAt`。在 `schema/mysql/user.ts` 与 `schema/sqlite/user.ts` 各定义一份，并在各自 `index.ts` 与 `db/schema/index.ts` 门面 re-export（含 `User` / `NewUser` 类型）。`relations/` 无需改动（无外键依赖）。

### 5. 分层落点（严格遵循现有分层）

- **Repository**：`server/repositories/user.repository.ts` —— 仅 `findByUsername(username)`、`findById(id)`（均排除软删除）。不含任何认证逻辑。
- **Service**：`server/services/auth.service.ts` —— `login(username, password)` 校验密码并签发 JWT；`logout()` 仅清 Cookie；`getCurrentUser(token)` 解析 token 并返回脱敏用户。密码校验（比较哈希）属业务逻辑，放 service。
- **Zod**：`server/schemas/auth.schema.ts` —— `loginSchema`（username/password 校验）。
- **Route**：`app/api/auth/login/route.ts`、`app/api/auth/logout/route.ts` —— thin，校验 → 调 service → 借助 `api-error` 工具返回。**不**写 Drizzle 查询。

### 6. 前端结构

- 页面：`app/login/page.tsx`（server 组件外壳，渲染客户端登录表单）。
- 组件：`web/features/auth/components/login-form.tsx`（HeroUI `Input` + `Button`，含加载/错误态）。
- Hook：`web/features/auth/hooks/use-auth.ts` —— 封装 `login`/`logout`，提供 `user` 状态与加载态；调用 api-client。
- api-client：`web/api-client/auth.ts` —— `authApi.login(payload)` / `authApi.logout()` / `authApi.me()`。**不复用** 现有 `request.ts`（其 `BASE_URL` 硬编码 `/api/dbt`），而是新建一个面向 `/api/auth` 的请求函数或在 `auth.ts` 内直接 fetch（与现有错误模型 `ApiError` 对齐）。为避免重复，将在 `request.ts` 中抽出可传 `baseUrl` 的内部函数，保持向后兼容。
- 登录页独立、不嵌入现有 `AppLayout`（左侧栏），保持纯净。

### 7. 初始账号

不在代码里硬编码账号。提供一条**可选**的种子脚本（或文档化的 SQL），由部署方预先在 `users` 表插入一个管理员账号（密码用 `server/lib/password.ts` 的 `hash` 生成）。登录功能本身不依赖种子脚本。

## Risks / Trade-offs

- **[自实现 JWT/哈希的安全风险]** → 严格使用 HMAC-SHA256 + 固定算法头防「alg=none」攻击；`verify` 校验签名与 `exp`；密钥从 `AUTH_JWT_SECRET` 读取并校验长度。scrypt 参数取 `N=16384,r=8,p=1`（Node 推荐默认量级）。
- **[无登录限流 → 暴力破解]** → 本次不实现，但 `login` route 预留注释扩展点；文档注明后续应加。
- **[双驱动 schema 需双份维护]** → 沿用现有模式，`schema/index.ts` 门面抹平差异；新增迁移时两套 dialect 各跑一次 `drizzle-kit generate`。
- **[api-client BASE_URL 耦合 dbt]** → 通过抽出可传 baseUrl 的请求函数化解，保持既有 dbt 客户端行为不变。
- **[无注册入口，首账号如何创建]** → 文档化种子方式，避免为实现登录而硬编码后门账号。

## Migration Plan

1. 新增 `users` 两套 schema → `drizzle-kit generate`（按当前 `DB_DRIVER` 生成对应 dialect 迁移）。
2. 本地/目标库执行 `drizzle-kit migrate`（或 SQLite 的 `npm run db:sqlite:migrate`）。
3. 设置环境变量 `AUTH_JWT_SECRET`（更新 `.env.example`）。
4. 按种子文档插入首个账号。
5. 部署；访问 `/login` 验证登录/登出。

**回滚**：`users` 表与 `/api/auth`、`/login` 均为新增，回滚仅需还原代码；数据库层面 `users` 表可保留（无外键依赖，安全）或执行反向迁移。
