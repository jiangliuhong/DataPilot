"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { environmentApi } from "@/web/api-client";
import { getWsClient } from "@/web/lib/ws-client";
import type { Environment } from "@/web/types/dbt";

export interface InitLog {
  id: number;
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
}

export interface EnvInitState {
  /** 当前初始化状态（由 WS 事件与初始环境数据驱动） */
  status: Environment["initializationStatus"];
  /** 实时日志行 */
  logs: InitLog[];
  /** 是否正在触发/执行初始化 */
  isStarting: boolean;
  /** 错误信息（触发失败或初始化失败） */
  error: string | null;
}

/**
 * 封装某运行环境的初始化触发 + WebSocket 实时订阅。
 *
 * - start(): 调 API 触发初始化
 * - 通过 ws-client 订阅 `environment:<id>:init`，实时更新 status / logs
 * - 组件卸载时自动取消订阅
 */
export function useEnvInit(env: Environment | null) {
  const [state, setState] = useState<EnvInitState>({
    status: env?.initializationStatus ?? "pending",
    logs: [],
    isStarting: false,
    error: env?.lastErrorMessage ?? null,
  });

  const logIdRef = useRef(0);

  // 环境切换时重置状态
  useEffect(() => {
    setState({
      status: env?.initializationStatus ?? "pending",
      logs: [],
      isStarting: false,
      error: env?.lastErrorMessage ?? null,
    });
  }, [env?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 订阅 WebSocket 实时事件
  useEffect(() => {
    if (!env) return;
    const topic = `environment:${env.id}:init`;
    const client = getWsClient();

    const handler = (event: string, data: unknown) => {
      const d = (data ?? {}) as Record<string, unknown>;
      if (event === "status") {
        setState((prev) => ({
          ...prev,
          status: (d.status as Environment["initializationStatus"]) ?? prev.status,
          isStarting: false,
        }));
      } else if (event === "log") {
        const line = String(d.line ?? "");
        const stream = (d.stream as "stdout" | "stderr") ?? "stdout";
        if (line) {
          setState((prev) => ({
            ...prev,
            logs: [
              ...prev.logs,
              { id: ++logIdRef.current, stream, line, ts: Date.now() },
            ].slice(-500), // 保留最近 500 行避免无限增长
          }));
        }
      } else if (event === "done") {
        setState((prev) => ({
          ...prev,
          status: (d.status as Environment["initializationStatus"]) ?? prev.status,
          error: (d.error as string) ?? null,
          isStarting: false,
        }));
      }
    };

    const unsubscribe = client.subscribe(topic, handler);
    return () => {
      unsubscribe();
    };
  }, [env?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    if (!env) return;
    setState((prev) => ({ ...prev, isStarting: true, error: null, logs: [] }));
    try {
      await environmentApi.initialize(env.id);
      // 触发成功，状态由 WS 事件推进为 running
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isStarting: false,
        error: err instanceof Error ? err.message : "触发初始化失败",
      }));
    }
  }, [env]);

  return { ...state, start };
}
