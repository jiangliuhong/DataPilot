## Context

DataPilot 已具备完整的登录能力（`add-user-login` 变更交付）：`/login` 页面、`POST /api/auth/{login,logout}`、`GET /api/auth/me`，以及通过 `dp_auth` httpOnly Cookie 携带的 HS256 JWT 会话。会话解析逻辑封装在 `src/app/server/services/auth.service.ts`（`getCurrentUser`）与 `src/app/server/lib/cookie.ts`（`AUTH_COOKIE_NAME = "dp_auth"`）中，`src/app/server/lib/auth-guard.ts` 提供了 `requireAuth()` 帮助函数——但目前**仅**被 `/api/agent/*` 路由使用。

**关键既有实现细节（实现时确认）**：
- 本项目**未使用** `jsonwebtoken` / `jose` 等第三方库，JWT 签发/校验是 `src/app/server/lib/jwt.ts` 中的自研实现，基于 Node `crypto.createHmac`（HS256）、`timingSafeEqual` 与 `Buffer`。`verifyToken(token)` 校验算法头（防 `alg=none`）、常量时间签名比对、`exp` 过期，任一不过返回 `null`。本次 edge 守卫可直接复用此函数，无需新建并行实现。
- 项目运行 **Next.js 16.2.6**。该版本中 `middleware.ts` 文件约定已被**重命名为 `proxy.ts`**（v16.0.0 破坏性变更，函数名也从 `middleware` 改为 `proxy`）。因此本次边缘守卫文件为 `src/proxy.ts`。
- Next.js 16 的 Proxy **默认使用 Node.js Runtime**（不再是 Edge Runtime），`runtime` 配置在 proxy 文件中不可用（设置会报错）。这意味着 `node:crypto`、`next/headers` 等 Node API 均可在 proxy 中使用——**不需要** Edge 友好替代方案（如 `jose`）。

当前缺口：

1. **无边缘守卫**：没有任何机制在用户访问 `/` 等页面时检查登录态。未登录用户直接访问根路径会看到完整的应用界面（带侧边栏），而不是被引导到 `/login`。
2. **API 鉴权不完整**：`/api/dbt/*` 约 15 个路由处理器目前没有调用 `requireAuth()`，依赖前端「自觉」。一旦前端或第三方直接调用，存在越权风险。
3. **无前端 401 兜底**：`src/web/api-client/request.ts` 的 `fetchJson` 收到 401 时只是抛出 `ApiError`，不会清理本地登录态或跳转 `/login`。会话过期后用户会停留在出错的应用界面，体验割裂。

约束（来自 `AGENTS.md`）：路由必须保持 thin；鉴权/业务逻辑在 service 或 lib 层；前端只通过 `api-client` 访问后端；不直接写 Drizzle。

## Goals / Non-Goals

**Goals:**

- 未登录访问任何受保护页面（含 `/`）时，重定向到 `/login`。
- 未登录或会话失效时，受保护 API 返回 401。
- 所有 `/api/dbt/*` 路由补齐 `requireAuth()`，与 `/api/agent/*` 一致。
- 前端在收到 401 时自动清理本地态并跳转 `/login`，会话过期体验闭环。
- 公开路径（`/login`、`/api/auth/*`、静态资源）不受拦截，保证登录流程本身可用。

**Non-Goals:**

- 不引入 RBAC / 细粒度权限模型（角色、资源级授权）。本次只做「是否登录」的访问控制。
- 不改动 `user-authentication` 既有需求（登录、登出、会话解析、登录页 UI 的行为不变）。
- 不实现多端会话管理 / 单点登出 / 会话刷新续期（沿用现有 7 天 TTL）。
- 不做 Server Component 级的页面守卫（采用 middleware 边缘守卫，见下）。

## Decisions

### 1. 边缘守卫采用 Next.js 16 的 proxy（原 middleware），而非布局/页面级守卫

采用根级 `src/proxy.ts` 统一拦截。Next.js 16 将 `middleware.ts` 重命名为 `proxy.ts`（函数名 `proxy`），proxy 在每个请求到达页面/路由处理器之前执行，能同时覆盖页面与 API，是「跳转登录页」这一需求的最自然落点。**重要**：Next.js 16 的 proxy 默认运行在 **Node.js Runtime**（非 Edge），因此可直接 `import` 既有 `jwt.ts`（依赖 `node:crypto`），无需 Edge 友好替代。

**为何不用客户端 Provider/HOC 守卫**：客户端守卫需要先加载页面 JS、再在 `useEffect` 里判断登录态，首屏会闪烁出已渲染的应用界面，且无法保护 API。proxy 在边缘层直接决定放行/重定向/401，无闪烁、覆盖面全。

**为何不用每个 page 的 Server Component 守卫**：需要在每个受保护页面重复写 `redirect('/login')` 逻辑，且无法统一处理 API 路由。proxy 是单一真相源。

**matcher 设计**：`matcher` 配置排除静态资源（`_next/static`、`_next/image`、`favicon.ico` 等图标），让 proxy 只对动态路径生效；公开路径（`/login`、`/api/auth/*`）在 proxy 内部用白名单短路放行，而不依赖 matcher 的负向匹配——这样白名单是显式、可读的单一列表。

### 2. proxy 内复用既有 `verifyToken` 做 JWT 校验（无需新实现）

Next.js 16 的 proxy 默认跑在 **Node.js Runtime**，可直接 `import { verifyToken } from "@/app/server/lib/jwt"`（该实现基于 `node:crypto`，Node Runtime 下完全可用）。因此**无需**新建 Edge 版 JWT 实现，也无需引入 `jose`——直接复用与服务端签发端**同一份**校验代码，从源头保证「两处校验绝不漂移」。

proxy 内自行读取 `dp_auth` Cookie（通过 `request.cookies.get(AUTH_COOKIE_NAME)`，而非 `next/headers` 的 `cookies()`），交由 `verifyToken` 校验：

- 复用 `AUTH_JWT_SECRET` 环境变量与 HS256 算法，与 `auth.service` 签发端完全一致。
- 仅校验**签名 + exp 过期**——这正是「是否登录」的判据。不查库（查库是路由层 `requireAuth()` 的职责）。
- 校验失败（缺失 / 签名无效 / 过期）一律视为未登录：页面请求 → 302 重定向到 `/login`；API 请求（`/api/*`）→ 返回 401 JSON。

**为何仍允许 proxy 与 service 存在「校验调用」**：职责不同。proxy 做「快速拒绝」，不查库（只用 `verifyToken`）；路由层 `requireAuth()` 做「解析当前用户并注入业务」，会查库取脱敏用户对象。两者都最终落到同一份 `verifyToken` 实现，结果一致，构成纵深防御——即使 matcher 配置失误漏放某条 API，路由层 `requireAuth()` 仍会兜底。

**考虑过的替代方案**：在 proxy 内 fetch `/api/auth/me` 来判断登录态——会多一次内部往返，且把鉴权耦合到 me 路由上，性能与解耦都不如本地校验 JWT。否决。

### 3. 公开路径用显式白名单

定义一个 `PUBLIC_PATHS` 判断函数，明确放行：

- `/login`（精确匹配）
- `/api/auth/*`（前缀匹配，覆盖 login/logout/me）
- Next.js 静态资源由 matcher 排除，不进入 middleware

判断逻辑集中在一个 helper（如 `isPublicPath(pathname)`），便于测试与后续调整。根路径 `/` **不在**白名单——未登录访问 `/` 重定向到 `/login`。

### 4. API 路由层补 `requireAuth()` 作为纵深防御

middleware 放行的 API 请求，仍需在路由处理器内调用 `requireAuth()`，原因有二：

1. middleware 只判断「会话有效」，不返回用户对象；业务路由需要当前用户（未来接 RBAC 时也需要）。
2. 纵深防御：万一 matcher 配置或白名单失误，路由层仍能拒绝未授权请求。

对约 15 个 `/api/dbt/*` 路由，逐个在处理器入口补 `await requireAuth()`（与 `/api/agent/*` 完全相同的既有模式）。改动机械、风险低、保持路由 thin。

### 5. 前端 401 拦截集中在 `fetchJson`，而非每个调用点

在 `src/web/api-client/request.ts` 的底层 `fetchJson` 中统一拦截 401：收到 401 时清理本地登录态（如 `use-auth` 的用户缓存）并 `window.location.href = "/login"`。

**为何集中在底层**：所有 api-client 模块（dbt、auth、agent 等）都经过 `fetchJson`，一处拦截即可全覆盖，无需在每个业务调用点重复处理。

**为何用 `window.location` 而非 router**：401 可能来自任意组件深层，且 `fetchJson` 是普通函数、不在 React 上下文内，无法用 `useRouter`。整页跳转 `/login` 最简单可靠，也会触发 middleware 重新评估登录态。

**避免循环**：`/api/auth/login`、`/api/auth/me` 也在白名单/公开路径内，login 请求自身的 401（账号密码错误）不应触发跳转——通过区分「会话过期 401」与「凭据错误 401」处理：login 接口的 401 是正常业务错误，由 `login-form` 本地展示，不进入全局 401 跳转逻辑（即 auth api-client 的请求豁免全局拦截，或全局拦截仅作用于非 auth 前缀的请求）。

### 6. 本地登录态清理

`use-auth` hook 维护了客户端当前用户状态。收到 401 跳转前，需重置该状态，避免跳转回 `/login` 后残留过期用户信息。具体：在跳转逻辑里调用一个轻量的 `clearLocalAuth()`（由 `use-auth` 暴露或通过事件让 Provider 自行清理）。若当前实现无全局 store，最简方案是直接整页跳转——浏览器重新加载 `/login` 时 `use-auth` 会重新从 `/api/auth/me` 拉取（返回 401 → 显示未登录态），天然完成清理。**首选后者（整页跳转即天然清理）**，避免引入额外耦合。

## Risks / Trade-offs

- **[双层校验漂移]** proxy 与 service 两处都校验 JWT，未来若改算法/密钥需保证一致。
  → **缓解**：本方案 proxy 直接复用同一份 `verifyToken` 实现（非重写），从根本上消除漂移；密钥统一来自 `AUTH_JWT_SECRET` 单一环境变量。

- **[误拦截公开路径]** 白名单遗漏会导致登录页或 auth 接口被自身拦截，用户无法登录。
  → **缓解**：白名单显式且最小（仅 `/login`、`/api/auth/*`）；在 specs 中以场景固化「未登录可访问 `/login`」与「未登录可调用 `/api/auth/login`」。

- **[login 接口 401 误触发全局跳转]** 若全局 401 拦截不分前缀，会把「账号密码错误」也跳转到 `/login`，丢失错误提示。
  → **缓解**：全局 401 跳转**仅**对非 `/api/auth/*` 前缀生效；auth 接口的错误由调用方（如 `login-form`）本地处理。

- **[matcher 漏配]** proxy `matcher` 若配错，可能放过本应拦截的路径。
  → **缓解**：matcher 只做静态资源负向排除，动态路径全进 proxy；白名单在 proxy 内部显式判断，双重保险。

- **[BREAKING：现有直链行为改变]** 之前可直接访问 `/` 看到应用，现在会被跳转登录。
  → 这是本次的**预期行为**，正是用户要修复的问题；上线前需确保 seed 用户存在。
