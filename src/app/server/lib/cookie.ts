import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "dp_auth";

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 天，与 JWT TTL 对齐

/**
 * 在响应上设置会话 Cookie（httpOnly + SameSite=Lax + Path=/）。
 *
 * 仅在登录成功路径调用。
 */
export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** 清除会话 Cookie（登出 / 幂等）。 */
export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** 读取当前请求的会话 token；不存在时返回 undefined。 */
export async function readAuthCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(AUTH_COOKIE_NAME)?.value;
}
