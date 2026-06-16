import { User, Bot } from "lucide-react";
import ToolCallCard from "./tool-call-card";
import TypingIndicator from "./typing-indicator";
import type { DisplayMessage } from "../hooks/use-agent-chat";

interface MessageBubbleProps {
  message: DisplayMessage;
}

/**
 * 单条消息气泡（区分 user/assistant 样式）。
 *
 * user 右对齐，assistant 左对齐。
 * assistant 消息上方的工具调用步骤以卡片形式展示。
 *
 * 注：首版以纯文本（whitespace-pre-wrap）渲染 assistant 内容，
 * Markdown 渲染（代码块、表格等）作为后续迭代（需引入 markdown 库）。
 */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* 头像 */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary-100 text-primary-600"
            : "bg-default-100 text-default-600"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* 气泡内容 */}
      <div
        className={`flex max-w-[80%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
      >
        {/* 工具调用卡片（仅 assistant） */}
        {message.toolCalls.map((tc, idx) => (
          <ToolCallCard key={`${tc.name}-${idx}`} toolCall={tc} />
        ))}

        {/* 文本内容 */}
        {(message.content || message.pending) && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm ${
              isUser
                ? "bg-primary-500 text-white"
                : message.error
                  ? "bg-danger-50 text-danger-700"
                  : "bg-default-100 text-default-900"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">
              {message.content}
            </p>
            {message.pending && !message.content && <TypingIndicator />}
          </div>
        )}
      </div>
    </div>
  );
}
