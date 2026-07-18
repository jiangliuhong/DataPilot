import * as userRepo from "@/app/server/repositories/user.repository";
import { verifyPassword } from "@/app/server/lib/password";
import { signToken, verifyToken } from "@/app/server/lib/jwt";
import type { User } from "@/app/db/schema";

/** 认证失败专用错误，路由层据此类返回 401。 */
export class UnauthorizedError extends Error {
  constructor(message = "用户名或密码错误") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** 对外暴露的用户形状（剔除密码哈希）。 */
export type SafeUser = Omit<User, "passwordHash">;

function sanitize(user: User): SafeUser {
  // 显式剔除 passwordHash，返回脱敏后的 SafeUser。
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}

/** 登录结果：脱敏用户 + 会话 token。 */
export interface LoginResult {
  user: SafeUser;
  token: string;
}

/**
 * 登录校验。
 *
 * 用户不存在 / 非 active / 密码不匹配，统一抛 `UnauthorizedError`，
 * 错误消息不区分原因，以防账号枚举。
 */
export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  const user = await userRepo.findByUsername(username);

  // 对缺失用户也执行一次哈希校验，抹平响应时序（恒定失败语义）
  if (!user || user.status !== "active") {
    // 即便 user 为空也跑一次校验以对齐耗时
    verifyPassword(password, "00:00");
    throw new UnauthorizedError();
  }

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError();
  }

  const token = signToken({ sub: user.id, username: user.username });
  return { user: sanitize(user), token };
}

/**
 * 解析会话 token，返回当前脱敏用户；无效/过期返回 null。
 *
 * 无状态：不依赖服务端 session 存储。
 */
export async function getCurrentUser(
  token: string | undefined | null,
): Promise<SafeUser | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await userRepo.findById(payload.sub);
  if (!user || user.status !== "active") return null;

  return sanitize(user);
}
