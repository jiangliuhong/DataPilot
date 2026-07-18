"use client";

import { useCallback, useEffect, useState } from "react";
import { authApi, type AuthUser } from "@/web/api-client";

export interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** 初始化阶段：正在请求 /me 判定登录态 */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * 统一的登录态 hook。
 *
 * - 挂载时调用 `/api/auth/me` 判定登录态。
 * - `login` 成功后写入本地 user；`logout` 后清空。
 * - 错误以字符串形式暴露（便于表单直接展示），调用方也可读 `ApiError`。
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        // 未登录：401 视为正常初始态，不作为错误展示
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const u = await authApi.login({ username, password });
      setUser(u);
      return u;
    } catch (e) {
      const message = e instanceof Error ? e.message : "登录失败";
      setError(message);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    error,
    clearError,
  };
}
