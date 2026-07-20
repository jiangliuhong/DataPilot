"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Chip } from "@heroui/react";
import { useOverlayState } from "@heroui/react";
import type { Task } from "@/web/types/dbt";
import { useTaskRun } from "../hooks/use-task-run";

interface TaskRunLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  /** 运行完成/失败后通知父组件刷新列表 */
  onChanged?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "未运行",
  queued: "排队中",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  canceled: "已取消",
};

const STATUS_COLOR: Record<
  string,
  "default" | "accent" | "success" | "danger"
> = {
  idle: "default",
  queued: "accent",
  running: "accent",
  succeeded: "success",
  failed: "danger",
  canceled: "default",
};

/**
 * 任务运行日志面板。
 *
 * 打开时订阅 `task:<runId>:run`；触发运行后实时展示 dbt 输出。
 */
export default function TaskRunLogPanel({
  isOpen,
  onClose,
  task,
  onChanged,
}: TaskRunLogPanelProps) {
  const run = useTaskRun();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      // 运行中禁止通过 backdrop/Escape 关闭，避免订阅泄漏与未完成的运行被打断（S3）
      if (!open && run.isRunning) return;
      if (!open) onClose();
    },
  });

  const logEndRef = useRef<HTMLDivElement>(null);

  // 状态变为 succeeded/failed 时通知父组件刷新
  const lastNotifiedStatus = useRef<string | null>(null);
  useEffect(() => {
    if (
      run.status !== lastNotifiedStatus.current &&
      (run.status === "succeeded" || run.status === "failed")
    ) {
      lastNotifiedStatus.current = run.status;
      onChanged?.();
    }
  }, [run.status, onChanged]);

  // 日志自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run.logs.length]);

  const isRunning = run.isRunning;
  const buttonLabel =
    run.status === "succeeded"
      ? "再次运行"
      : run.status === "failed"
        ? "重试运行"
        : "开始运行";

  const handleStart = () => {
    if (!task) return;
    lastNotifiedStatus.current = null;
    void run.start(task.id);
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-2xl">
            <Modal.Header>
              <div className="flex items-center justify-between w-full">
                <span>任务运行 · {task?.name}</span>
                <Chip color={STATUS_COLOR[run.status]} variant="soft" size="sm">
                  {STATUS_LABEL[run.status]}
                </Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              {run.error && (
                <div className="mb-2 rounded-md bg-danger-50 p-2 text-sm text-danger-600 dark:bg-danger-100/10">
                  {run.error}
                </div>
              )}
              <div className="h-72 overflow-auto rounded-md bg-default-900/5 p-3 font-mono text-xs dark:bg-default-100/5">
                {run.logs.length === 0 ? (
                  <p className="text-default-400">
                    {run.status === "idle"
                      ? "尚未运行，点击下方按钮开始。"
                      : "等待输出..."}
                  </p>
                ) : (
                  run.logs.map((log) => (
                    <div
                      key={log.id}
                      className={
                        log.stream === "stderr"
                          ? "text-danger-600 dark:text-danger-400"
                          : "text-default-700 dark:text-default-300"
                      }
                    >
                      {log.line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
              {task && (
                <p className="mt-2 text-xs text-default-500">
                  环境：{task.environmentName} · 连接：{task.connectionName}（
                  {task.databaseType}）· 命令：dbt {task.command}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose} isDisabled={isRunning}>
                关闭
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={handleStart}
                isDisabled={isRunning || !task}
              >
                {isRunning ? "执行中..." : buttonLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
