import { ZodError } from "zod";

/** 统一 API 错误响应 */
export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** 404 Not Found */
export function notFound(message = "Resource not found") {
  return apiError(message, 404);
}

/** 400 Bad Request */
export function badRequest(message: string) {
  return apiError(message, 400);
}

/** 409 Conflict */
export function conflict(message: string) {
  return apiError(message, 409);
}

/** 413 Payload Too Large */
export function payloadTooLarge(message: string) {
  return apiError(message, 413);
}

/** 500 Internal Server Error */
export function serverError(message = "Internal server error") {
  return apiError(message, 500);
}

/** 处理 Zod 验证错误 */
export function handleValidationError(error: ZodError) {
  const messages = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return apiError(messages.join("; "), 400);
}

/** 安全执行 service 方法，捕获异常并返回统一错误响应 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
): Promise<Response> {
  try {
    const result = await fn();
    if (result === null) {
      return notFound();
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error);
    }
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes("not found") || msg.includes("not Found")) {
        return notFound(msg);
      }
      if (msg.includes("already exists")) {
        return conflict(msg);
      }
      if (msg.includes("exceeds limit")) {
        return payloadTooLarge(msg);
      }
      if (msg.includes("Cannot move")) {
        return badRequest(msg);
      }
      if (msg.includes("Unsupported") || msg.includes("不支持")) {
        return badRequest(msg);
      }
      return badRequest(msg);
    }
    return serverError();
  }
}
