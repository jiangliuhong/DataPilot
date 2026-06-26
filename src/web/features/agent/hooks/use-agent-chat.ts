"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  /** 发送消息并流式接收回复。onComplete 在流式到达终态（message_end 或 error）后回调（用于刷新历史） */
  sendMessage: (
    conversationId: number,
    message: string,
    onComplete?: () => void,
  ) => Promise<void>;
  /** 中止当前生成（"停止生成"） */
  stop: () => void;
  /** 把后端历史 AgentMessage[] 转换为展示模型 */
  toDisplayMessages: (messages: AgentMessage[]) => DisplayMessage[];
  clearStreaming: () => void;
}

/** 判断是否为用户主动中止导致的错误 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/**
 * 管理流式对话：发送消息、解析 SSE 事件、追加 token、维护工具调用卡片、错误处理。
 *
 * 历史消息由调用方（组件）管理，本 hook 只负责"当前这一轮"的流式状态。
 *
 * 终态刷新：无论是正常 message_end 还是出错（SSE error 事件 / 网络中断），
 * 都会触发 onComplete 回调，由调用方刷新历史与会话列表，保证状态一致。
 * 卸载时若仍有进行中的请求，会自动中止，避免幽灵流。
 */
export function useAgentChat(): UseAgentChatResult {
  const [streamingMessage, setStreamingMessage] = useState<DisplayMessage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 中止当前生成 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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

      // 在发起请求前创建 AbortController，支持"停止生成"与卸载清理
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await chatApi.streamChat(
          conversationId,
          message,
          controller.signal,
        );

        await parseSSEStream(
          response,
          (event: ChatStreamEvent) => {
            setStreamingMessage((prev) => {
              if (!prev) return prev;
              return applyEvent(prev, event);
            });
            // 终态：message_end（正常完成）或 error（出错）都触发刷新
            if (event.type === "message_end" || event.type === "error") {
              if (event.type === "error") setError(event.message);
              onComplete?.();
            }
          },
          controller.signal,
        );
      } catch (err) {
        // 用户主动中止：不作为错误展示，清理临时流式气泡（避免与刷新后的历史重复显示），
        // 刷新历史落库已接收的部分。
        if (isAbortError(err)) {
          setStreamingMessage(null);
          onComplete?.();
        } else {
          const msg = err instanceof Error ? err.message : "对话出错";
          setError(msg);
          setStreamingMessage((prev) =>
            prev
              ? { ...prev, pending: false, error: true, content: prev.content || msg }
              : null,
          );
          // 网络中断等异常也是终态，触发刷新保证状态一致
          onComplete?.();
        }
      } finally {
        setGenerating(false);
        abortRef.current = null;
      }
    },
    [],
  );

  // 卸载时中止进行中的请求，避免幽灵流
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
    stop,
    toDisplayMessages,
    clearStreaming,
  };
}

/** 把一个 SSE 事件应用到当前流式消息上 */
function applyEvent(draft: DisplayMessage, event: ChatStreamEvent): DisplayMessage {
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
