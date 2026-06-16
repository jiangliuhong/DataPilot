"use client";

import { useEffect, useCallback } from "react";
import ConversationList from "./conversation-list";
import MessageList from "./message-list";
import ChatInput from "./chat-input";
import EmptyState from "./empty-state";
import { useConversations } from "../hooks/use-conversations";
import { useConversationMessages } from "../hooks/use-conversation-messages";
import { useAgentChat } from "../hooks/use-agent-chat";

/**
 * AI Agent 对话页：左右二级布局（左会话列表 + 右对话区）。
 *
 * - 左侧：会话列表（新建、选中、删除）
 * - 右侧：消息流（历史 + 流式）+ 输入框
 */
export default function AgentChatLayout() {
  const {
    conversations,
    loading: convsLoading,
    selectedId,
    refresh: refreshConvs,
    select,
    create: createConv,
    remove: deleteConv,
  } = useConversations();

  const {
    messages: history,
    load: loadMessages,
    clear: clearMessages,
  } = useConversationMessages();

  const {
    streamingMessage,
    generating,
    sendMessage,
    toDisplayMessages,
    clearStreaming,
  } = useAgentChat();

  // 选中会话变化 → 加载历史
  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      clearStreaming();
    } else {
      clearMessages();
      clearStreaming();
    }
  }, [selectedId, loadMessages, clearMessages, clearStreaming]);

  const handleSend = useCallback(
    (message: string) => {
      if (!selectedId || generating) return;
      sendMessage(selectedId, message, () => {
        // message_end 后刷新历史与会话列表（标题可能已更新）
        loadMessages(selectedId);
        refreshConvs();
      });
    },
    [selectedId, generating, sendMessage, loadMessages, refreshConvs],
  );

  const displayMessages = toDisplayMessages(history);

  return (
    <div className="flex h-full">
      {/* 左侧会话列表 */}
      <aside className="w-64 shrink-0 border-r border-default-200 bg-white">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          loading={convsLoading}
          onSelect={select}
          onCreate={createConv}
          onDelete={deleteConv}
        />
      </aside>

      {/* 右侧对话区 */}
      <section className="flex flex-1 flex-col bg-background">
        {selectedId ? (
          displayMessages.length === 0 && !streamingMessage ? (
            <EmptyState type="no-messages" />
          ) : (
            <MessageList
              messages={displayMessages}
              streamingMessage={streamingMessage}
            />
          )
        ) : (
          <EmptyState type="no-conversation" />
        )}

        <ChatInput disabled={!selectedId || generating} onSend={handleSend} />
      </section>
    </div>
  );
}
