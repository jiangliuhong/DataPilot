## ADDED Requirements

### Requirement: 边缘访问控制 proxy

系统 SHALL 在 `src/proxy.ts` 提供一个根级 Next.js proxy（Next.js 16 由 `middleware.ts` 重命名而来），在所有受保护页面与 API 请求到达处理器之前统一校验登录态。校验依据为请求中 `dp_auth` Cookie 携带的会话 JWT：MUST 复用既有 `src/app/server/lib/jwt.ts` 的 `verifyToken`，使用与登录签发端相同的 `AUTH_JWT_SECRET` 与 HS256 算法校验签名，并校验 `exp` 过期时间。Cookie 缺失、签名无效或已过期时，一律视为未登录。

middleware MUST 通过 `matcher` 配置排除 Next.js 静态资源（含 `/_next/static`、`/_next/image`、`favicon.ico` 及根级图标文件），使 middleware 仅对动态路径生效。

middleware 内部 SHALL 维护一个显式的公开路径白名单，包含 `/login`（精确匹配）与 `/api/auth`（前缀匹配，覆盖 `/api/auth/login`、`/api/auth/logout`、`/api/auth/me`）。命中白名单的请求 MUST 直接放行，不校验登录态。

对于未命中白名单且会话无效的请求，middleware MUST 区分请求类型做出响应：页面请求（非 `/api` 前缀）SHALL 返回 302 重定向到 `/login`；API 请求（`/api` 前缀）SHALL 返回 401 与 JSON 错误体。会话有效的请求 MUST 原样放行，不得附加副作用。

#### Scenario: 未登录访问根路径重定向到登录页
- **WHEN** 未携带有效 `dp_auth` Cookie 的请求访问 `/`
- **THEN** middleware 返回 302，`Location` 指向 `/login`

#### Scenario: 未登录访问受保护页面重定向
- **WHEN** 未携带有效会话 Cookie 的请求访问任意非公开页面（如 `/dashboard`）
- **THEN** middleware 返回 302 重定向到 `/login`

#### Scenario: 未登录访问受保护 API 返回 401
- **WHEN** 未携带有效会话 Cookie 的请求访问任意 `/api/dbt/*` 或 `/api/agent/*` 路径
- **THEN** middleware 返回 401 与 JSON 错误体（不重定向）

#### Scenario: 已登录请求原样放行
- **WHEN** 携带签名有效且未过期的 `dp_auth` Cookie 的请求访问任意受保护路径
- **THEN** middleware 放行请求，业务逻辑正常执行

#### Scenario: 会话过期视为未登录
- **WHEN** 请求的 `dp_auth` JWT 已过 `exp`
- **THEN** middleware 视为未登录，按请求类型重定向（页面）或返回 401（API）

#### Scenario: 静态资源不经过 middleware
- **WHEN** 请求 `/_next/static/*`、`/_next/image/*` 或 `favicon.ico` 等图标
- **THEN** 该请求被 `matcher` 排除，不进入 middleware，直接由静态资源管线处理

---

### Requirement: 公开路径白名单

系统 SHALL 在 middleware 中以单一显式判断函数（如 `isPublicPath(pathname)`）定义公开路径，作为登录态校验的唯一短路条件。白名单 MUST 且仅包含 `/login`（精确匹配）与 `/api/auth`（前缀匹配）。根路径 `/` MUST NOT 被视为公开路径——未登录访问 `/` SHALL 被重定向到 `/login`。

#### Scenario: 未登录可访问登录页
- **WHEN** 未登录请求访问 `/login`
- **THEN** 请求命中白名单被放行，正常渲染登录页

#### Scenario: 未登录可调用 auth 接口
- **WHEN** 未登录请求访问 `/api/auth/login`、`/api/auth/logout` 或 `/api/auth/me`
- **THEN** 请求命中白名单被放行，由对应路由处理器处理

#### Scenario: 业务 API 不在白名单
- **WHEN** 未登录请求访问 `/api/dbt/*` 或 `/api/agent/*`
- **THEN** 请求不命中白名单，按未登录策略返回 401

---

### Requirement: API 路由层鉴权兜底

所有 `/api/*` 业务路由处理器（含 `/api/dbt/*` 全部路由与 `/api/agent/*` 既有路由）SHALL 在处理器入口调用 `requireAuth()`（`src/app/server/lib/auth-guard.ts`），作为 middleware 之后的纵深防御。`requireAuth()` MUST 在会话无效时抛出/返回鉴权错误，使路由以 401 响应。

路由处理器 MUST 保持 thin：鉴权调用之外不得引入 Drizzle 查询或业务逻辑。鉴权通过后由 service 处理业务，并由 service/repository 访问数据。

#### Scenario: dbt 路由鉴权兜底
- **WHEN** 已通过 middleware 的请求到达任一 `/api/dbt/*` 路由处理器
- **THEN** 该处理器调用 `requireAuth()`；会话有效时继续业务，会话无效时返回 401

#### Scenario: middleware 失误时路由层兜底
- **WHEN** 因 matcher 或白名单配置失误，一个未携带有效会话的 `/api/dbt/*` 请求未被 middleware 拦截而到达处理器
- **THEN** 处理器内的 `requireAuth()` 仍返回 401，拒绝该请求

---

### Requirement: 前端 401 自动重定向

`src/web/api-client/request.ts` 的底层请求封装（`fetchJson` 及其同构衍生函数）SHALL 统一拦截 401 响应：当响应状态为 401 且请求路径**不属于** `/api/auth/*` 前缀时，MUST 将浏览器重定向到 `/login`（整页跳转）。

`/api/auth/*` 前缀的请求 SHALL 豁免该全局 401 跳转逻辑，以便 `POST /api/auth/login` 的「账号或密码错误」401 能由调用方（如 `login-form`）本地展示，而非触发跳转。

整页跳转后，浏览器重新加载 `/login` 时前端登录态 SHALL 自然重置（通过重新请求 `/api/auth/me` 判定），无需在跳转前显式清理客户端用户缓存。其他非 401 错误 SHALL 继续按既有方式抛出 `ApiError`。

#### Scenario: 业务接口 401 触发跳转登录页
- **WHEN** 任一非 `/api/auth/*` 前缀的 api-client 请求（如 `/api/dbt/*`、`/api/agent/*`）收到 401 响应
- **THEN** 浏览器整页跳转到 `/login`

#### Scenario: auth 接口 401 不触发跳转
- **WHEN** `/api/auth/login` 因凭据错误返回 401
- **THEN** 不发生全局跳转，错误由 `login-form` 本地展示为「用户名或密码错误」

#### Scenario: 会话过期触发跳转
- **WHEN** 用户在应用内操作时，会话已过期导致业务 API 返回 401
- **THEN** 浏览器跳转到 `/login`，用户被引导重新登录

#### Scenario: 非 401 错误仍抛出 ApiError
- **WHEN** api-client 请求收到非 401 的错误状态码（如 400、404、500）
- **THEN** 继续抛出 `ApiError`，不触发登录跳转
