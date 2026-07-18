## 1. 边缘守卫 proxy（Next.js 16）

- [x] 1.1 阅读 `node_modules/next/dist/docs/` 中关于 proxy（原 middleware）的文档，确认本项目 Next.js 16 的 proxy 文件约定与运行时特性
- [x] 1.2 确认 Next.js 16 的 proxy 默认使用 Node.js Runtime（非 Edge），可直接 `import` 既有 `src/app/server/lib/jwt.ts`（基于 `node:crypto`），无需 `jose` 或 Edge 替代
- [x] 1.3 实现公开路径白名单判断函数 `isPublicPath(pathname)`：精确匹配 `/login`、前缀匹配 `/api/auth`；其余路径返回 false（与 `verifyToken` 复用逻辑一并置于 proxy 同文件或 `src/app/server/lib/auth-paths.ts`）
- [x] 1.4 新建 `src/proxy.ts`：读取 `dp_auth` Cookie（`request.cookies.get(AUTH_COOKIE_NAME)`，**不**用 `next/headers`）→ 命中白名单直接放行 → 用 `verifyToken` 校验，有效则放行 → 无效时区分请求类型（页面 → 302 `/login`；`/api` → 401 JSON）
- [x] 1.5 导出 `config.matcher`，排除 `/_next/static`、`/_next/image`、`favicon.ico` 及常见根级图标文件，使 proxy 仅对动态路径生效

## 2. API 路由层鉴权兜底

- [x] 2.1 枚举所有 `/api/dbt/*` 路由处理器（参考 `src/app/api/dbt/` 下的 `route.ts`），确认当前均未调用 `requireAuth()`
- [x] 2.2 为每个 `/api/dbt/*` 路由处理器的 GET/POST/PUT/PATCH/DELETE 方法入口补加 `await requireAuth()`，保持路由 thin（仅鉴权 + 调 service + 返回）
- [x] 2.3 复核 `/api/agent/*` 路由已具备 `requireAuth()`，确认与 dbt 路由鉴权方式一致；若有遗漏则补齐
- [x] 2.4 确认鉴权失败时路由统一以 401 响应（沿用 `requireAuth()` 既有错误模型）

## 3. 前端 401 自动重定向

- [x] 3.1 在 `src/web/api-client/request.ts` 的底层 `fetchJson` 中增加 401 拦截：当 `res.status === 401` 且请求路径**不属于** `/api/auth/*` 前缀时，执行 `window.location.href = "/login"` 跳转
- [x] 3.2 对 `requestBlob`、`uploadFile` 等同构衍生函数同步增加 401 拦截，覆盖非 JSON 请求路径（dbt 导出/导入等）
- [x] 3.3 确认 `/api/auth/login` 的 401（凭据错误）豁免全局跳转，由 `login-form` 本地展示错误（验证白名单判断以请求 URL 前缀为准）
- [x] 3.4 确认会话过期场景：应用内任一业务 API 返回 401 时，浏览器整页跳转 `/login`，重新加载后 `use-auth` 通过 `/api/auth/me` 自然重置为未登录态

## 4. 验证

- [x] 4.1 验证未登录访问 `/` → 302 重定向到 `/login`
- [x] 4.2 验证未登录访问 `/login` 与 `/api/auth/*` → 正常放行，可完成登录
- [x] 4.3 验证未登录访问 `/api/dbt/*` 与 `/api/agent/*` → 返回 401
- [x] 4.4 验证登录后访问受保护页面与 API → 正常工作
- [x] 4.5 验证会话过期（手动篡改/删除 Cookie 或等 JWT 过期）→ 业务 API 返回 401 → 前端整页跳转 `/login`
- [x] 4.6 验证 `/api/auth/login` 凭据错误 401 → 不触发全局跳转，`login-form` 正常展示「用户名或密码错误」
- [x] 4.7 运行既有 lint/typecheck/build，确认 proxy（Next.js 16，默认 Node.js Runtime）与新增改动无类型与构建错误
