## Why

DataPilot 目前没有任何身份识别机制——所有页面与 API 对任何访问者完全开放。作为一个面向团队的数据管理平台，我们需要先建立最小可用的「用户」概念与登录入口，为后续的访问控制、操作审计和多用户协作打下基础。本次变更**只落地用户登录**：让用户能凭账号密码登录并维持会话，其余用户管理能力（注册、改密、角色权限）留给后续变更。

## What Changes

- 新增 `users` 数据表（含账号、密码哈希、软删除等标准字段），并在 MySQL 与 SQLite 两套 dialect 下同步落地（遵循项目现有双驱动 schema 约定）。
- 新增 `POST /api/auth/login` 与 `POST /api/auth/logout` 两个认证路由；登录成功后下发 httpOnly Cookie（基于签名 JWT），登出时清除 Cookie。
- 新增认证 service（校验账号密码、签发/解析 Token）与 user repository（仅限用户查询，遵循 Repository First）。
- 新增独立的登录页 `/login`（HeroUI 表单），未登录访问受保护页时重定向至此。
- 前端新增 `auth` api-client 与一个轻量 `useAuth` hook，统一管理登录态。
- **非目标（本次不做）**：用户注册、找回密码、角色/权限区分、用户列表管理页、第三方登录（OAuth/SSO）。

## Capabilities

### New Capabilities
- `user-authentication`: 账号密码登录、登出、基于 Cookie 的会话维持，以及登录页 UI。

### Modified Capabilities
<!-- 无既有 spec 被改动 -->

## Impact

- **数据库**：新增 `users` 表 + 迁移（`drizzle-kit generate/migrate`，MySQL 与 SQLite 各一份）。
- **后端**：新增 `app/api/auth/*` 路由、`server/services/auth.service.ts`、`server/repositories/user.repository.ts`、`server/schemas/auth.schema.ts`；引入密码哈希与 JWT 工具（`server/lib/` 下，依赖 Node 原生 `crypto`，不新增第三方依赖）。
- **前端**：新增 `/login` 页、`web/features/auth` 下的登录组件与 `useAuth` hook、`web/api-client/auth.ts`。
- **配置/环境变量**：新增 `AUTH_JWT_SECRET`（JWT 签名密钥），更新 `.env.example`。
- **依赖**：不引入新 npm 依赖（密码哈希用 Node `scrypt`，JWT 用 HS256 手写或原生 `crypto`），保持依赖最小化。
- **现有页面**：根页面 `/` 及后续受保护页面将依赖登录态；本次仅实现登录页与登录态判定，**不强制改造** `/` 的访问控制（保持最小变更，路由保护留待后续）。
