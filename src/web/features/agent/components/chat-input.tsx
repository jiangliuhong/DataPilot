"use client";

import { useState, useCallback } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  disabled?: boolean;
  onSend: (message: string) => void;
}

/** 消息输入框（多行、Enter 发送、Shift+Enter 换行、空消息禁用、生成中禁用） */
export default function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const canSend = !disabled && value.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }, [canSend, value, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-default-200 p-3">
      <div className="flex items-end gap-2 rounded-xl border border-default-200 bg-white px-3 py-2 focus-within:border-primary-400">
        <textarea
          className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-default-300"
          rows={1}
          placeholder={disabled ? "AI 正在回复中…" : "输入消息，Enter 发送，Shift+Enter 换行"}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canSend}
          onClick={submit}
          aria-label="发送"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
