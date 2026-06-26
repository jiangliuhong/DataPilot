"use client";

import { Alert, AlertDescription, Button } from "@heroui/react";
import { X, RotateCw } from "lucide-react";

interface ErrorAlertProps {
  /** 错误信息；为 null 时不渲染 */
  message: string | null;
  /** 关闭错误提示（点击 X 时调用） */
  onClose?: () => void;
  /** 重试回调；提供时显示"重试"按钮 */
  onRetry?: () => void;
  /** 重试中状态（禁用按钮 + 显示加载图标） */
  isRetrying?: boolean;
}

/**
 * 可复用的错误提示条：基于 HeroUI Alert（status="danger"），
 * 就近展示错误信息，可选"重试"与"关闭"。
 *
 * 用于 AI 助手页各操作的失败反馈（会话列表加载/新建、历史加载、对话出错等），
 * 取代此前"错误写进 state 但无组件渲染"的静默行为。
 */
export default function ErrorAlert({
  message,
  onClose,
  onRetry,
  isRetrying = false,
}: ErrorAlertProps) {
  if (!message) return null;

  return (
    <Alert status="danger" className="m-2">
      <AlertDescription className="flex items-center gap-2 text-xs">
        <span className="flex-1 break-words text-danger-600">{message}</span>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onPress={onRetry}
            isDisabled={isRetrying}
            className="h-6 shrink-0 px-2 text-xs"
          >
            <RotateCw size={12} className={isRetrying ? "animate-spin" : ""} />
            重试
          </Button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭错误提示"
            className="shrink-0 rounded p-0.5 text-danger-400 hover:bg-danger-50 hover:text-danger-600"
          >
            <X size={13} />
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
