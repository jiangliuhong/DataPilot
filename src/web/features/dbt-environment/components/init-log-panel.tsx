"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Chip } from "@heroui/react";
import { useOverlayState } from "@heroui/react";
import type { Environment } from "@/web/types/dbt";
import { useEnvInit } from "../hooks/use-env-init";

interface InitLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  environment: Environment | null;
  /** 初始化完成/失败后通知父组件刷新列表 */
  onChanged?: () => void;
}

const STATUS_LABEL: Record<Environment["initializationStatus"], string> = {
  pending: "待初始化",
  running: "初始化中",
  initialized: "初始化完成",
  failed: "初始化失败",
};

const STATUS_COLOR: Record<Environment["initializationStatus"], "default" | "accent" | "success" | "danger"> = {
  pending: "default",
  running: "accent",
  initialized: "success",
  failed: "danger",
};

export default function InitLogPanel({
  isOpen,
  onClose,
  environment,
  onChanged,
}: InitLogPanelProps) {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const init = useEnvInit(environment);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 状态变化为 initialized/failed 时通知父组件刷新
  const lastNotifiedStatus = useRef<Environment["initializationStatus"] | null>(null);
  useEffect(() => {
    if (
      init.status !== lastNotifiedStatus.current &&
      (init.status === "initialized" || init.status === "failed")
    ) {
      lastNotifiedStatus.current = init.status;
      onChanged?.();
    }
  }, [init.status, onChanged]);

  // 日志自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [init.logs.length]);

  const isRunning = init.status === "running" || init.isStarting;
  const buttonLabel =
    init.status === "initialized"
      ? "重新初始化"
      : init.status === "failed"
        ? "重试初始化"
        : "开始初始化";

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-2xl">
            <Modal.Header>
              <div className="flex items-center justify-between w-full">
                <span>初始化环境 · {environment?.name}</span>
                <Chip
                  color={STATUS_COLOR[init.status]}
                  variant="soft"
                  size="sm"
                >
                  {STATUS_LABEL[init.status]}
                </Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              {init.error && (
                <div className="mb-2 rounded-md bg-danger-50 p-2 text-sm text-danger-600 dark:bg-danger-100/10">
                  {init.error}
                </div>
              )}
              <div className="h-72 overflow-auto rounded-md bg-default-900/5 p-3 font-mono text-xs dark:bg-default-100/5">
                {init.logs.length === 0 ? (
                  <p className="text-default-400">
                    {init.status === "pending"
                      ? "尚未初始化，点击下方按钮开始。"
                      : "等待输出..."}
                  </p>
                ) : (
                  init.logs.map((log) => (
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
              {environment?.venvPath && (
                <p className="mt-2 text-xs text-default-500">
                  venv 路径：{environment.venvPath}
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
                onPress={init.start}
                isDisabled={isRunning}
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
