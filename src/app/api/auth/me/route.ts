import * as authService from "@/app/server/services/auth.service";
import { readAuthCookie } from "@/app/server/lib/cookie";
import { apiError } from "@/app/server/errors/api-error";

/** GET /api/auth/me — 当前登录用户（脱敏） */
export async function GET() {
  try {
    const token = await readAuthCookie();
    const user = await authService.getCurrentUser(token);
    if (!user) {
      return apiError("未登录", 401);
    }
    return Response.json(user);
  } catch {
    return apiError("获取用户信息失败", 500);
  }
}
