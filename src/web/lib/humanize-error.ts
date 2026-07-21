/**
 * 把后端返回的错误转换成对用户友好的中文提示。
 *
 * 后端 `apiError(message, status)` 返回 `{ error: string }`，
 * 前端 api-client 的 `request<T>` 把它包装成 `ApiError(status, body)` 抛出。
 * 本函数优先取 `body.error`（后端通常是中文），退而求其次取 `error.message`。
 *
 * 对于网络/未知错误，给出兜底文案而不是英文 stack。
 */
import { ApiError } from "@/web/api-client";

export function humanizeError(error: unknown, fallback = "操作失败，请稍后重试"): string {
  if (error instanceof ApiError) {
    // 后端返回的 { error: string }，通常是中文（service 抛的中文消息或 Zod 本地化消息）
    const bodyMsg = typeof error.body?.error === "string" ? error.body.error : null;
    if (bodyMsg && bodyMsg.trim()) return bodyMsg.trim();
    // 按 HTTP 状态码给兜底
    if (error.status === 401) return "未登录或会话已过期";
    if (error.status === 403) return "没有权限执行此操作";
    if (error.status === 404) return "请求的资源不存在";
    if (error.status === 409) return "操作冲突，请刷新后重试";
    if (error.status >= 500) return "服务器异常，请稍后重试";
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
