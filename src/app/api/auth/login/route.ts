import * as authService from "@/app/server/services/auth.service";
import { UnauthorizedError } from "@/app/server/services/auth.service";
import { loginSchema } from "@/app/server/schemas/auth.schema";
import { setAuthCookie } from "@/app/server/lib/cookie";
import {
  handleValidationError,
  apiError,
} from "@/app/server/errors/api-error";

/** POST /api/auth/login — 账号密码登录，成功后下发会话 Cookie */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const { user, token } = await authService.login(username, password);
    await setAuthCookie(token);
    return Response.json(user);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("登录失败", 500);
  }
}
