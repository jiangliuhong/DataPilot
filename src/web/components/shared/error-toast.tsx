"use client";

import { toast } from "@heroui/react";

export function showError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "操作失败，请稍后重试";
  toast.danger(message);
}

export function showSuccess(message: string) {
  toast.success(message);
}

export function useErrorToast() {
  return { showError, showSuccess };
}
