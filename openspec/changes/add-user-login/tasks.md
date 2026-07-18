## 1. 数据层（schema + 迁移）

- [ ] 1.1 新增 `src/app/db/schema/mysql/user.ts`：定义 `users` 表（`id` 自增主键、唯一 `username`、`passwordHash`、`displayName`、可空 `email`、`status` enum(active/inactive) 默认 active、`createdAt`/`updatedAt`/`deletedAt`），导出 `users` 及 `User` / `NewUser` 类型。参考现有 `dbt-version.ts` 的字段命名与时间戳约定。
- [ ] 1.2 新增 `src/app/db/schema/sqlite/user.ts`：SQLite dialect 对应定义，字段与 MySQL 对齐（参考现有 sqlite 目录结构）。
- [ ] 1.3 在 `schema/mysql/index.ts` 与 `schema/sqlite/index.ts` 各自 `export * from "./user"`。
- [ ] 1.4 在 `src/app/db/schema/index.ts` 门面 re-export `users`、`User`、`NewUser`（与现有 dbt 导出风格一致，类型以 MySQL 为规范）。
- [ ] 1.5 运行 `npm run db:generate` 生成迁移；分别在 `DB_DRIVER=mysql` 与 `DB_DRIVER=sqlite` 下各生成一份，确认两套迁移文件生成成功。
- [ ] 1.6 运行 `npm run db:migrate`（或 `db:sqlite:migrate`）应用迁移，确认 `users` 表创建成功。

## 2. 后端工具库（password / jwt / cookie）

- [ ] 2.1 新增 `src/app/server/lib/password.ts`：`hashPassword(plain)`（Node `crypto.scrypt`，salt 随机，返回 `saltHex:hashHex`）与 `verifyPassword(plain, stored)`。
- [ ] 2.2 新增 `src/app/server/lib/jwt.ts`：`signToken(payload)` / `verifyToken(token)`（HS256，用原生 `crypto.createHmac`，密钥从 `AUTH_JWT_SECRET` 读取并校验长度；payload 含 `sub`/`username`/`exp`，默认 7 天；`verifyToken` 校验签名与 `exp`，防 `alg=none`）。
- [ ] 2.3 新增 `src/app/server/lib/cookie.ts`：常量 `AUTH_COOKIE_NAME`，以及 `setAuthCookie(res, token)` / `clearAuthCookie(res)` / `readAuthCookie(req)`（httpOnly、SameSite=Lax、Path=/）。

## 3. 后端业务层（schema / repository / service）

- [ ] 3.1 新增 `src/app/server/schemas/auth.schema.ts`：`loginSchema = z.object({ username, password })`，含非空校验与中文错误提示（参考 `version.schema.ts` 风格）。
- [ ] 3.2 新增 `src/app/server/repositories/user.repository.ts`：`findByUsername(username)` 与 `findById(id)`，均 `and(isNull(deletedAt))` 排除软删除。仅查询，不含认证逻辑。
- [ ] 3.3 新增 `src/app/server/services/auth.service.ts`：
  - `login(username, password)`：取用户 → 不存在/`inactive`/密码不符统一抛「用户名或密码错误」（401）；通过则签发 JWT，返回脱敏用户（剔除 `passwordHash`）。
  - `logout()`：无状态，仅清 Cookie。
  - `getCurrentUser(token)`：解析 token，`findById(sub)`，返回脱敏用户或 null。

## 4. 后端路由（auth API）

- [ ] 4.1 新增 `src/app/api/auth/login/route.ts`：thin —— `loginSchema.parse(body)` → `authService.login(...)` → 设置 Cookie（`setAuthCookie`）→ `Response.json(脱敏用户)`。错误用 `apiError`/`handleValidationError` 统一返回。禁止 Drizzle。
- [ ] 4.2 新增 `src/app/api/auth/logout/route.ts`：调用 `clearAuthCookie`，返回 200。
- [ ] 4.3 新增 `src/app/api/auth/me/route.ts`：`GET`，读 Cookie → `getCurrentUser`，无则 401。

## 5. 前端 api-client

- [ ] 5.1 在 `src/web/api-client/request.ts` 抽出可传 `baseUrl` 的内部请求函数，保持现有 dbt 客户端（`BASE_URL=/api/dbt`）行为不变（向后兼容）。
- [ ] 5.2 新增 `src/web/api-client/auth.ts`：`authApi.login(payload)` / `authApi.logout()` / `authApi.me()`，指向 `/api/auth`，复用 `ApiError` 错误模型。在 `api-client/index.ts` 导出 `authApi`。

## 6. 前端登录功能（hook + 组件 + 页面）

- [ ] 6.1 新增 `src/web/features/auth/hooks/use-auth.ts`：封装 `authApi`，暴露 `login` / `logout`、`user`、`isAuthenticated`、加载/错误态。
- [ ] 6.2 新增 `src/web/features/auth/components/login-form.tsx`：HeroUI 表单（`Input` 用户名/密码 + `Button` 登录），含加载态与错误提示；提交调用 `authApi.login`；成功后 `router.push("/")`；失败时保留用户名、清空密码并显示「用户名或密码错误」。组件 < 150 行。
- [ ] 6.3 新增 `src/app/login/page.tsx`：独立居中卡片布局（不嵌 `AppLayout`），渲染 `<LoginForm />`。

## 7. 配置与文档

- [ ] 7.1 在 `.env.example` 增加 `AUTH_JWT_SECRET`（附生成命令注释），并在启动路径校验缺失时给出清晰错误。
- [ ] 7.2 在变更目录或 README 附「首账号种子说明」：如何用 `server/lib/password.ts` 的 `hashPassword` 生成 `passwordHash`，并给出向 `users` 插入一条管理员账号的示例 SQL（覆盖 MySQL/SQLite）。

## 8. 验证

- [ ] 8.1 `npm run lint` 与 `npm run build` 通过，无类型错误。
- [ ] 8.2 本地跑通：访问 `/login` → 用种子账号登录成功 → Cookie 设置 → `/api/auth/me` 返回当前用户 → `/api/auth/logout` 清除 Cookie。
- [ ] 8.3 验证错误场景：错误密码返回 401 且消息不区分「用户不存在/密码错误」；空字段返回 400；无效/过期 token 的 `/me` 返回 401。
