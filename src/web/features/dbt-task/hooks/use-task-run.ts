"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { taskApi } from "@/web/api-client";
import { getWsClient } from "@/web/lib/ws-client";
import type { TaskRunStatus } from "@/web/types/dbt";

export interface RunLog {
  id: number;
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
}

export interface TaskRunState {
  /** 当前运行状态（由 WS 事件驱动） */
  status: TaskRunStatus | "idle";
  /** 实时日志行 */
  logs: RunLog[];
  /** 是否正在触发/执行 */
  isRunning: boolean;
  /** 错误信息（触发失败或运行失败） */
  error: string | null;
  /** 当前订阅的 runId（触发后设置） */
  runId: number | null;
}

const INITIAL_STATE: TaskRunState = {
  status: "idle",
  logs: [],
  isRunning: false,
  error: null,
  runId: null,
};

/**
 * 任务执行 hook：触发运行 + 订阅 `task:<runId>:run` 实时事件。
 *
 * - start(taskId): 调 API 触发运行，拿到 runId 后订阅对应 topic
 * - 通过 ws-client 接收 status / log / done 事件
 * - 组件卸载自动取消订阅
 *
 * 健壮性（review round 1 修复 W8）：
 *   - mountedRef 防止卸载后 setState
 *   - startRef 防止重复触发（避免前一次未完成又开新一次造成订阅交叉）
 *   - 卸载时若仍有 in-flight 订阅，清理在 cleanup effect 中完成
 */
export function useTaskRun() {
  const [state, setState] = useState<TaskRunState>(INITIAL_STATE);
  const logIdRef = useRef(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const startRef = useRef<Promise<void> | null>(null);

  // 跟踪挂载状态，卸载后所有 setState 被忽略
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const subscribeRun = useCallback((runId: number) => {
    // 取消上一次订阅（保证同一时刻只有一个活跃订阅）
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const topic = `task:${runId}:run`;
    const client = getWsClient();

    const handler = (event: string, data: unknown) => {
      if (!mountedRef.current) return;
      const d = (data ?? {}) as Record<string, unknown>;
      if (event === "status") {
        const step = d.step as string | undefined;
        if (step === "starting" || d.status === "running") {
          setState((prev) => ({ ...prev, status: "running", isRunning: true }));
        }
      } else if (event === "log") {
        const line = String(d.line ?? "");
        const stream = (d.stream as "stdout" | "stderr") ?? "stdout";
        if (line) {
          setState((prev) => ({
            ...prev,
            logs: [
              ...prev.logs,
              { id: ++logIdRef.current, stream, line, ts: Date.now() },
            ].slice(-500),
          }));
        }
      } else if (event === "done") {
        const status = (d.status as TaskRunStatus) ?? "failed";
        setState((prev) => ({
          ...prev,
          status,
          isRunning: false,
          error: (d.error as string | null) ?? null,
        }));
      }
    };

    unsubscribeRef.current = client.subscribe(topic, handler);
  }, []);

  const start = useCallback(
    (taskId: number) => {
      // 若上一次 start 仍在进行中，忽略重复触发（避免订阅交叉）
      if (startRef.current) return startRef.current;

      const p = (async () => {
        setState({ ...INITIAL_STATE, isRunning: true });
        try {
          const result = await taskApi.run(taskId);
          if (!mountedRef.current) return;
          setState((prev) => ({ ...prev, runId: result.runId }));
          subscribeRun(result.runId);
        } catch (err) {
          if (!mountedRef.current) return;
          setState((prev) => ({
            ...prev,
            isRunning: false,
            error: err instanceof Error ? err.message : "触发运行失败",
          }));
        } finally {
          startRef.current = null;
        }
      })();
      startRef.current = p;
      return p;
    },
    [subscribeRun],
  );

  const reset = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (mountedRef.current) {
      setState(INITIAL_STATE);
    }
  }, []);

  return { ...state, start, reset };
}
