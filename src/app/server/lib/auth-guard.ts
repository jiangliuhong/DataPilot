import { readAuthCookie } from "@/app/server/lib/cookie";
import {
  getCurrentUser,
  UnauthorizedError,
  type SafeUser,
} from "@/app/server/services/auth.service";

/**
 * 强制鉴权：读取会话 Cookie → 解析当前用户。
 *
 * 所有 `/api/agent/*` 路由 SHALL 在处理逻辑前调用本函数获取当前用户，
 * 并将 `userId` 贯穿 service / repository 用于数据隔离。
 *
 * 复用现有 JWT + `dp_auth` Cookie 认证体系，无新认证机制。
 *
 * @returns 当前登录用户（脱敏后的 SafeUser）
 * @throws UnauthorizedError 未登录或会话过期
 */
export async function requireAuth(): Promise<SafeUser> {
  const token = await readAuthCookie();
  const user = await getCurrentUser(token);
  if (!user) {
    throw new UnauthorizedError("未登录");
  }
  return user;
}

export { UnauthorizedError };
