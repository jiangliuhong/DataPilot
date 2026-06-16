import { streamChat } from "@/app/server/agent/agent.service";
import { sendChatSchema } from "@/app/server/schemas/agent/chat.schema";
import {
  handleValidationError,
  notFound,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";
import type { ChatStreamEvent } from "@/app/server/agent/types";

const encoder = new TextEncoder();

/** 把一个事件编码为 SSE data 行 */
function encodeEvent(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** POST /api/agent/chat — 流式对话（SSE） */
export async function POST(request: Request) {
  // 鉴权与请求校验必须在流启动前完成（HTTP 状态码一旦开始流式就无法再改）
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    return apiError("认证失败", 500);
  }

  let body: { conversationId: number; message: string };
  try {
    const parsed = sendChatSchema.parse(await request.json());
    body = parsed;
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("请求解析失败", 400);
  }

  // 会话存在性预检（在流启动前，以便返回真实 404）
  const { getConversation } = await import(
    "@/app/server/services/agent/conversation.service"
  );
  const existing = await getConversation(body.conversationId, user.id);
  if (!existing) {
    return notFound("会话不存在");
  }

  // 构建 SSE 流
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamChat(user.id, body.conversationId, body.message, (event) => {
          controller.enqueue(encodeEvent(event));
        });
      } catch {
        // 兜底：编排内部已处理异常 emit，此处防止未捕获异常导致连接异常断开
        try {
          controller.enqueue(encodeEvent({ type: "error", message: "对话出错" }));
        } catch {
          // controller 已关闭，忽略
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 禁用反向代理缓冲，确保 SSE 实时下发
      "X-Accel-Buffering": "no",
    },
  });
}
