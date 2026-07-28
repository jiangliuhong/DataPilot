import { fetchJsonRequest, ApiError, handleUnauthorized } from "./request";
import { buildQuery } from "./request";
import type {
  AgentConversation,
  AgentWorkspace,
  ConversationListResponse,
  MessageListResponse,
  WorkspaceListResponse,
  ChatStreamEvent,
  ResumeDecision,
} from "@/web/types/agent";

const BASE_URL = "/api/agent";

export const workspaceApi = {
  /** GET /api/agent/workspaces — 当前用户的工作空间列表 */
  list(params?: { limit?: number; offset?: number }) {
    return fetchJsonRequest<WorkspaceListResponse>(
      BASE_URL,
      `/workspaces${buildQuery(params ?? {})}`,
    );
  },
};

export const conversationApi = {
  /** GET /api/agent/conversations — 当前用户的会话列表 */
  list(params?: { limit?: number; offset?: number }) {
    return fetchJsonRequest<ConversationListResponse>(
      BASE_URL,
      `/conversations${buildQuery(params ?? {})}`,
    );
  },

  /** GET /api/agent/conversations/:id — 会话详情 */
  get(id: number) {
    return fetchJsonRequest<AgentConversation>(BASE_URL, `/conversations/${id}`);
  },

  /**
   * POST /api/agent/conversations — 创建会话。
   *
   * 主流程：传 { type, refId, name }，后端 upsert workspace + 建会话（一步到位）。
   * 已有 workspace：传 { workspaceId }。
   */
  create(
    data:
      | { type: string; refId: number; name: string; title?: string }
      | { workspaceId: number; title?: string },
  ) {
    return fetchJsonRequest<AgentConversation>(BASE_URL, "/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** DELETE /api/agent/conversations/:id — 软删除会话 */
  delete(id: number) {
    return fetchJsonRequest<void>(BASE_URL, `/conversations/${id}`, {
      method: "DELETE",
    });
  },

  /** GET /api/agent/conversations/:id/messages — 会话消息列表 */
  getMessages(id: number) {
    return fetchJsonRequest<MessageListResponse>(
      BASE_URL,
      `/conversations/${id}/messages`,
    );
  },
};

export const chatApi = {
  /**
   * POST /api/agent/chat — 流式对话（SSE）。
   *
   * 返回原始 Response，调用方读取 body 解析 `data: <JSON>\n\n` 事件。
   * 非流式错误（401/404/400）会抛 ApiError。
   *
   * @param signal 可选 AbortSignal，用于中止请求（"停止生成"）。
   */
  async streamChat(
    conversationId: number,
    message: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
      signal,
    });

    if (res.status === 401) {
      handleUnauthorized(`${BASE_URL}/chat`);
    }

    if (!res.ok) {
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        // ignore parse error
      }
      throw new ApiError(res.status, body);
    }

    return res;
  },

  /**
   * POST /api/agent/chat/resume — 恢复 HITL 中断（SSE）。
   *
   * 用户审批写操作后调用，返回与 streamChat 同格式的 SSE 流。
   */
  async resumeChat(
    conversationId: number,
    decisions: ResumeDecision[],
    signal?: AbortSignal,
  ): Promise<Response> {
    const res = await fetch(`${BASE_URL}/chat/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, decisions }),
      signal,
    });

    if (res.status === 401) {
      handleUnauthorized(`${BASE_URL}/chat/resume`);
    }

    if (!res.ok) {
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        // ignore parse error
      }
      throw new ApiError(res.status, body);
    }

    return res;
  },
};

/** 解析 SSE 流，逐事件回调。供 use-agent-chat hook 使用。 */
export async function parseSSEStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("响应无可读流");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 `\n\n` 分隔
      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const event = parseSSEEvent(rawEvent);
        if (event) onEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 解析单条 SSE 事件（`data: <JSON>`） */
function parseSSEEvent(raw: string): ChatStreamEvent | null {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const jsonStr = trimmed.slice(5).trim();
      try {
        return JSON.parse(jsonStr) as ChatStreamEvent;
      } catch {
        return null;
      }
    }
  }
  return null;
}
