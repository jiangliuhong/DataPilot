import { clearAuthCookie } from "@/app/server/lib/cookie";
import { apiError } from "@/app/server/errors/api-error";

/** POST /api/auth/logout — 终止会话（清除 Cookie，幂等） */
export async function POST() {
  try {
    await clearAuthCookie();
    return Response.json({ ok: true });
  } catch {
    return apiError("登出失败", 500);
  }
}
