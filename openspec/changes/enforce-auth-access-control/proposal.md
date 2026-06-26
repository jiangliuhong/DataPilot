## Why

当前登录系统本身可用（`/login` 页面、`/api/auth/*` 接口、`dp_auth` 会话 Cookie 均已实现），但**没有任何机制阻止未登录用户访问应用**：直接访问根路径 `/` 不会跳转到登录页，而是直接渲染带侧边栏的应用界面；同时除 `/api/agent/*` 外，绝大多数业务 API（`/api/dbt/*` 约 15 个路由处理器）也未做鉴权，存在越权访问风险。上一次 `add-user-login` 变更明确把「路由守卫」列为 Non-Goal，本次专门补齐这一缺口。

## What Changes

- **新增 Next.js middleware**（`src/middleware.ts`）：拦截所有请求，对未携带有效会话 Cookie 的访问做统一控制——页面请求重定向到 `/login`，API 请求返回 401。
- **公开路径白名单**：`/login`、`/api/auth/*`、Next.js 静态资源（`/_next/*`、`/favicon.ico`、图标等）不受登录拦截。
- **会话校验下沉到 middleware**：middleware 内解析 `dp_auth` Cookie，校验 JWT 签名（HS256）与 `exp` 过期；失效即视为未登录。**BREAKING**（对现状而言）：未登录访问 `/` 现在会被重定向到 `/login`，而不是直接渲染应用界面。
- **API 层统一鉴权兜底**：为目前缺少鉴权的 `/api/dbt/*` 路由补上 `requireAuth()`（与 `/api/agent/*` 已有方式一致），作为 middleware 之后的纵深防御；middleware 负责「不合法直接拦截」，路由层 `requireAuth()` 负责「取出当前用户供业务使用」。
- **前端 401 处理**：`api-client` 在收到 401 时清理本地登录态并跳转 `/login`，保证会话过期后用户被正确引导回登录页，而不是停留在出错的应用界面。

## Capabilities

### New Capabilities

- `auth-access-control`: 统一的登录访问控制——通过 middleware 在边缘层拦截未登录的页面与 API 请求，配合公开路径白名单、API 路由级 `requireAuth()` 兜底、以及前端 401 自动重定向，形成完整的登录控制闭环。

### Modified Capabilities

<!-- user-authentication 的需求本身不变（登录/登出/会话解析/登录页 UI 行为不变），本次只是新增访问控制层，故不修改其 requirements。 -->

## Impact

- **新增代码**：`src/middleware.ts`（边缘鉴权 + 白名单）；`api-client` 的 401 拦截逻辑（request 层或单独拦截器）。
- **改动代码**：约 15 个 `/api/dbt/*` 路由处理器补加 `requireAuth()`（薄层，符合现有架构）。
- **复用既有能力**：`src/app/server/lib/cookie.ts`（`AUTH_COOKIE_NAME`）、`auth.service` 的 JWT 校验逻辑（HS256 + exp）、`requireAuth()`（已用于 `/api/agent/*`）。
- **外部依赖**：无新增依赖；JWT 校验复用既有 `jsonwebtoken`（已用于登录签发）。
- **运维影响**：所有受保护路径现在都强制登录；新增用户/部署时需确认 seed 用户存在（沿用 `add-user-login` 的 seeding 方案）。
