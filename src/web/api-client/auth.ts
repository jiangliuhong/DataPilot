import { fetchJsonRequest } from "./request";

const BASE_URL = "/api/auth";

/** 登录后返回的脱敏用户（与服务端 SafeUser 形状一致，不含密码哈希）。 */
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** 登录请求参数 */
export interface LoginPayload {
  username: string;
  password: string;
}

export const authApi = {
  /** POST /api/auth/login — 登录并设置会话 Cookie */
  login(payload: LoginPayload): Promise<AuthUser> {
    return fetchJsonRequest<AuthUser>(BASE_URL, "/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** POST /api/auth/logout — 登出（清除 Cookie） */
  logout(): Promise<{ ok: boolean }> {
    return fetchJsonRequest<{ ok: boolean }>(BASE_URL, "/logout", {
      method: "POST",
    });
  },

  /** GET /api/auth/me — 当前登录用户 */
  me(): Promise<AuthUser> {
    return fetchJsonRequest<AuthUser>(BASE_URL, "/me", {
      method: "GET",
    });
  },
};
