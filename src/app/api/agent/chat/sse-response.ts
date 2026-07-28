import type { ChatStreamEvent } from "@/app/server/agent/types";

const encoder = new TextEncoder();

/** 把一个事件编码为 SSE data 行 */
export function encodeEvent(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * 构建 agent SSE 响应（chat / resume 共用）。
 *
 * @param signal 可选中止信号（前端断开连接时触发）
 * @param run    接收 emit 回调，执行 agent 编排并 emit 事件
 */
export function createAgentSseResponse(
  signal: AbortSignal | undefined,
  run: (emit: (event: ChatStreamEvent) => void) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await run((event) => {
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
    cancel() {
      // 前端断开连接；signal 会让 agent 中止（streamChat 内部已处理 AbortError）
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
