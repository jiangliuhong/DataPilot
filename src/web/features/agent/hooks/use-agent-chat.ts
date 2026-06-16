"use client";

import { useState, useCallback, useRef } from "react";
import { chatApi, parseSSEStream } from "@/web/api-client";
import type { AgentMessage, ChatStreamEvent } from "@/web/types/agent";

/** 工具调用步骤的展示状态（对应一张工具调用卡片） */
export interface ToolCallState {
  name: string;
  input: unknown;
  status: "running" | "done";
  output?: unknown;
}

/** 消息展示模型（统一历史消息与流式临时消息） */
export interface DisplayMessage {
  id: number | null; // 流式生成中的消息 id 为 null，message_end 后赋值
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallState[];
  pending?: boolean; // 正在生成
  error?: boolean;
}

interface UseAgentChatResult {
  /** 流式生成中的消息（用户发送后到 message_end 之间） */
  streamingMessage: DisplayMessage | null;
  generating: boolean;
  error: string | null;
  /** 发送消息并流式接收回复。onComplete 在 message_end 后回调（用于刷新历史） */
  sendMessage: (
    conversationId: number,
    message: string,
    onComplete?: () => void,
  ) => Promise<void>;
  /** 把后端历史 AgentMessage[] 转换为展示模型 */
  toDisplayMessages: (messages: AgentMessage[]) => DisplayMessage[];
  clearStreaming: () => void;
}

/**
 * 管理流式对话：发送消息、解析 SSE 事件、追加 token、维护工具调用卡片、错误处理。
 *
 * 历史消息由调用方（组件）管理，本 hook 只负责"当前这一轮"的流式状态。
 */
export function useAgentChat(): UseAgentChatResult {
  const [streamingMessage, setStreamingMessage] = useState<DisplayMessage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      conversationId: number,
      message: string,
      onComplete?: () => void,
    ) => {
      setGenerating(true);
      setError(null);

      // 初始化流式 assistant 消息（pending）
      const draft: DisplayMessage = {
        id: null,
        role: "assistant",
        content: "",
        toolCalls: [],
        pending: true,
      };
      setStreamingMessage({ ...draft });

      try {
        const response = await chatApi.streamChat(conversationId, message);
        abortRef.current = new AbortController();

        await parseSSEStream(
          response,
          (event: ChatStreamEvent) => {
            setStreamingMessage((prev) => {
              if (!prev) return prev;
              return applyEvent(prev, event, onComplete);
            });
          },
          abortRef.current.signal,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "对话出错";
        setError(msg);
        setStreamingMessage((prev) =>
          prev
            ? { ...prev, pending: false, error: true, content: prev.content || msg }
            : null,
        );
      } finally {
        setGenerating(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const clearStreaming = useCallback(() => {
    setStreamingMessage(null);
    setError(null);
  }, []);

  const toDisplayMessages = useCallback(
    (messages: AgentMessage[]): DisplayMessage[] => {
      return messages
        .filter((m) => m.role !== "tool")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content ?? "",
          toolCalls: (m.toolCalls ?? []).map((tc) => ({
            name: tc.name,
            input: tc.args,
            status: "done" as const,
          })),
        }));
    },
    [],
  );

  return {
    streamingMessage,
    generating,
    error,
    sendMessage,
    toDisplayMessages,
    clearStreaming,
  };
}

/** 把一个 SSE 事件应用到当前流式消息上 */
function applyEvent(
  draft: DisplayMessage,
  event: ChatStreamEvent,
  onComplete?: () => void,
): DisplayMessage {
  switch (event.type) {
    case "token":
      return { ...draft, content: draft.content + event.value };
    case "tool_start":
      return {
        ...draft,
        toolCalls: [
          ...draft.toolCalls,
          { name: event.tool, input: event.input, status: "running" },
        ],
      };
    case "tool_end":
      return {
        ...draft,
        toolCalls: draft.toolCalls.map((tc, idx) => {
          // 标记最后一个同名且仍在运行的卡片为完成
          const lastRunningIdx = (() => {
            for (let i = draft.toolCalls.length - 1; i >= 0; i--) {
              if (
                draft.toolCalls[i].name === event.tool &&
                draft.toolCalls[i].status === "running"
              ) {
                return i;
              }
            }
            return -1;
          })();
          return idx === lastRunningIdx
            ? { ...tc, status: "done" as const, output: event.output }
            : tc;
        }),
      };
    case "message_end":
      // 流式完成，触发回调（刷新历史）
      onComplete?.();
      return { ...draft, id: event.messageId, pending: false };
    case "error":
      return {
        ...draft,
        pending: false,
        error: true,
        content: draft.content || event.message,
      };
    default:
      return draft;
  }
}
