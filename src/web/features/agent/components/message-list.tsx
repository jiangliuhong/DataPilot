"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./message-bubble";
import type { DisplayMessage } from "../hooks/use-agent-chat";

interface MessageListProps {
  /** 历史消息（已固化的） */
  messages: DisplayMessage[];
  /** 当前流式生成中的消息（可能为 null） */
  streamingMessage: DisplayMessage | null;
}

/** 消息流渲染（user 右对齐 / assistant 左对齐 / 自动滚到底部） */
export default function MessageList({
  messages,
  streamingMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 内容变化时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id ?? `m-${m.content.slice(0, 8)}`} message={m} />
      ))}
      {streamingMessage && (
        <MessageBubble
          key="streaming"
          message={streamingMessage}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
