import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/app/server/lib/cookie";
import { verifyToken } from "@/app/server/lib/jwt";
import { isPublicPath } from "@/app/server/lib/auth-paths";

/**
 * 边缘访问控制（Next.js 16 proxy）。
 *
 * 在所有受保护页面与 API 请求到达处理器之前统一校验登录态：
 * 1. 公开路径（`/login`、`/api/auth/*`）直接放行——保证登录流程可用。
 * 2. 否则校验 `dp_auth` Cookie 中的会话 JWT（复用与服务端签发端同一份
 *    `verifyToken`）：有效则放行。
 * 3. 无效（缺失 / 签名无效 / 过期）时区分请求类型：页面请求 302 重定向到
 *    `/login`；`/api/*` 请求返回 401 JSON。
 *
 * 这是「快速拒绝」层；路由处理器内的 `requireAuth()` 仍是纵深防御，
 * 负责解析当前用户供业务使用（见 `auth-guard.ts`）。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径：登录页与 auth 接口本身不校验登录态。
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isValidSession = verifyToken(token) !== null;

  if (isValidSession) {
    return NextResponse.next();
  }

  // 未登录：页面请求重定向到登录页，API 请求返回 401。
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "未登录" },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  /**
   * 仅对动态路径生效；排除静态资源、图片优化与常见元数据/图标文件。
   * matcher 只做负向排除，动态路径（含 `/`、`/login`、`/api/*`）全进 proxy，
   * 由 proxy 内部白名单与登录态判断决定放行/拒绝。
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
