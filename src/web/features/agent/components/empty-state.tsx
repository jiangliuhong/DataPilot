import { Bot } from "lucide-react";

interface EmptyStateProps {
  /** 空状态类型：无选中会话 / 无消息 */
  type: "no-conversation" | "no-messages";
}

/** 对话区空状态提示 */
export default function EmptyState({ type }: EmptyStateProps) {
  const text =
    type === "no-conversation"
      ? "选择或新建一个会话开始对话"
      : "输入消息，开始与 AI 助手对话";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-default-400">
      <Bot size={48} className="opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
