"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { chatApi, parseSSEStream } from "@/web/api-client";
import type {
  AgentMessage,
  AgentTodo,
  ApprovalInterrupt,
  ChatStreamEvent,
  ResumeDecision,
} from "@/web/types/agent";

/** 工具调用步骤的展示状态（对应一张工具调用卡片） */
export interface ToolCallState {
  name: string;
  input: unknown;
  status: "running" | "done" | "error";
  output?: unknown;
  error?: string;
}

/** 子 agent 委派区段 */
export interface SubagentState {
  name: string;
  status: "running" | "done";
}

/** 消息展示模型（统一历史消息与流式临时消息） */
export interface DisplayMessage {
  id: number | null; // 流式生成中的消息 id 为 null，message_end 后赋值
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallState[];
  /** 任务清单（deepagents write_todos 产出，实时更新） */
  todos: AgentTodo[];
  /** 子 agent 委派记录 */
  subagents: SubagentState[];
  pending?: boolean; // 正在生成
  error?: boolean;
}

interface UseAgentChatResult {
  /** 流式生成中的消息（用户发送后到 message_end 之间） */
  streamingMessage: DisplayMessage | null;
  generating: boolean;
  /** 是否正在等待用户审批写操作（HITL 暂停态） */
  awaitingApproval: boolean;
  /** 待审批的中断列表 */
  pendingApprovals: ApprovalInterrupt[];
  error: string | null;
  /** 发送消息并流式接收回复 */
  sendMessage: (
    conversationId: number,
    message: string,
    onComplete?: () => void,
  ) => Promise<void>;
  /** 提交审批决策，恢复被 HITL 中断的执行 */
  resume: (
    conversationId: number,
    decisions: ResumeDecision[],
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

/** 创建空的流式 assistant 消息草稿 */
function createDraft(): DisplayMessage {
  return {
    id: null,
    role: "assistant",
    content: "",
    toolCalls: [],
    todos: [],
    subagents: [],
    pending: true,
  };
}

/**
 * 管理流式对话：发送消息、解析 SSE 事件、追加 token、维护工具调用卡片、
 * 任务清单、子 agent、HITL 审批状态、错误处理。
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
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalInterrupt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 中止当前生成 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** 消费 SSE 流的通用逻辑（sendMessage 和 resume 共用） */
  const consumeStream = useCallback(
    async (
      response: Response,
      conversationId: number,
      signal: AbortSignal,
      onComplete?: () => void,
    ) => {
      await parseSSEStream(
        response,
        (event: ChatStreamEvent) => {
          setStreamingMessage((prev) => {
            if (!prev) return prev;
            return applyEvent(prev, event);
          });
          // HITL：进入审批等待态（不触发 onComplete，等用户 resume）
          if (event.type === "approval_request") {
            setAwaitingApproval(true);
            setPendingApprovals(event.interrupts);
          } else if (event.type === "approval_resolved") {
            setAwaitingApproval(false);
            setPendingApprovals([]);
          }
          // 终态：message_end（正常完成）或 error（出错）都触发刷新
          if (event.type === "message_end" || event.type === "error") {
            if (event.type === "error") setError(event.message);
            onComplete?.();
          }
        },
        signal,
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      conversationId: number,
      message: string,
      onComplete?: () => void,
    ) => {
      setGenerating(true);
      setError(null);
      setAwaitingApproval(false);
      setPendingApprovals([]);
      setStreamingMessage({ ...createDraft() });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await chatApi.streamChat(
          conversationId,
          message,
          controller.signal,
        );
        await consumeStream(response, conversationId, controller.signal, onComplete);
      } catch (err) {
        handleStreamError(err, setStreamingMessage, setError, onComplete);
      } finally {
        setGenerating(false);
        abortRef.current = null;
      }
    },
    [consumeStream],
  );

  const resume = useCallback(
    async (
      conversationId: number,
      decisions: ResumeDecision[],
      onComplete?: () => void,
    ) => {
      // 审批态恢复为生成态（继续流式）
      setGenerating(true);
      setError(null);
      setAwaitingApproval(false);
      setPendingApprovals([]);

      // resume 复用同一 controller（保持可中止）
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await chatApi.resumeChat(
          conversationId,
          decisions,
          controller.signal,
        );
        await consumeStream(response, conversationId, controller.signal, onComplete);
      } catch (err) {
        handleStreamError(err, setStreamingMessage, setError, onComplete);
      } finally {
        setGenerating(false);
        abortRef.current = null;
      }
    },
    [consumeStream],
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
    setAwaitingApproval(false);
    setPendingApprovals([]);
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
          todos: [],
          subagents: [],
        }));
    },
    [],
  );

  return {
    streamingMessage,
    generating,
    awaitingApproval,
    pendingApprovals,
    error,
    sendMessage,
    resume,
    stop,
    toDisplayMessages,
    clearStreaming,
  };
}

/** 统一处理流错误：用户中止 vs 网络异常 */
function handleStreamError(
  err: unknown,
  setStreamingMessage: (updater: (prev: DisplayMessage | null) => DisplayMessage | null) => void,
  setError: (msg: string | null) => void,
  onComplete?: () => void,
) {
  if (isAbortError(err)) {
    setStreamingMessage(() => null);
    onComplete?.();
  } else {
    const msg = err instanceof Error ? err.message : "对话出错";
    setError(msg);
    setStreamingMessage((prev) =>
      prev
        ? { ...prev, pending: false, error: true, content: prev.content || msg }
        : null,
    );
    onComplete?.();
  }
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
        toolCalls: markLastRunningDone(draft.toolCalls, event.tool, event.output),
      };

    case "tool_error":
      return {
        ...draft,
        toolCalls: markLastRunningError(draft.toolCalls, event.tool, event.error),
      };

    case "todos_update":
      return { ...draft, todos: event.todos };

    case "subagent_start":
      return {
        ...draft,
        subagents: [...draft.subagents, { name: event.name, status: "running" }],
      };

    case "subagent_end":
      return {
        ...draft,
        subagents: draft.subagents.map((sa) =>
          sa.name === event.name && sa.status === "running"
            ? { ...sa, status: "done" }
            : sa,
        ),
      };

    case "approval_request":
    case "approval_resolved":
      // approval 状态由 hook 顶层 state 管理（awaitingApproval/pendingApprovals），
      // 此处不修改 draft
      return draft;

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

/** 标记最后一个同名且仍在运行的卡片为完成 */
function markLastRunningDone(
  toolCalls: ToolCallState[],
  name: string,
  output: unknown,
): ToolCallState[] {
  const lastRunningIdx = findLastRunningIdx(toolCalls, name);
  return toolCalls.map((tc, idx) =>
    idx === lastRunningIdx ? { ...tc, status: "done" as const, output } : tc,
  );
}

/** 标记最后一个同名且仍在运行的卡片为出错 */
function markLastRunningError(
  toolCalls: ToolCallState[],
  name: string,
  error: string,
): ToolCallState[] {
  const lastRunningIdx = findLastRunningIdx(toolCalls, name);
  return toolCalls.map((tc, idx) =>
    idx === lastRunningIdx ? { ...tc, status: "error" as const, error } : tc,
  );
}

function findLastRunningIdx(toolCalls: ToolCallState[], name: string): number {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    if (toolCalls[i].name === name && toolCalls[i].status === "running") {
      return i;
    }
  }
  return -1;
}
