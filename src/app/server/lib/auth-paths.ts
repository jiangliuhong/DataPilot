/**
 * 公开路径白名单。
 *
 * 用于边缘访问控制（`src/proxy.ts`）：命中白名单的请求不校验登录态，
 * 保证登录页与登录/登出/会话接口本身可被未登录用户访问。
 */

/** 登录页：精确匹配。 */
const PUBLIC_EXACT_PATHS = new Set<string>(["/login"]);

/** 公开前缀：登录/登出/会话接口。 */
const PUBLIC_PATH_PREFIXES = ["/api/auth"];

/**
 * 判断给定路径是否为公开路径（不受登录拦截）。
 *
 * - `/login` 精确匹配
 * - `/api/auth` 前缀匹配（覆盖 `/api/auth/login`、`/api/auth/logout`、`/api/auth/me`）
 *
 * 根路径 `/` 不在白名单——未登录访问 `/` 会被重定向到 `/login`。
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
