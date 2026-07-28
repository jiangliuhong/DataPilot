"use client";

import { useEffect, useCallback, useState } from "react";
import ConversationList from "./conversation-list";
import MessageList from "./message-list";
import ChatInput from "./chat-input";
import EmptyState from "./empty-state";
import ErrorAlert from "@/web/components/shared/error-alert";
import ApprovalCard from "./approval-card";
import WorkspaceSelectModal from "./workspace-select-modal";
import { useConversations } from "../hooks/use-conversations";
import { useConversationMessages } from "../hooks/use-conversation-messages";
import { useAgentChat } from "../hooks/use-agent-chat";

/**
 * AI Agent 对话页：左右二级布局（左会话列表 + 右对话区）。
 *
 * - 左侧：会话列表（新建→选 dbt project、选中、删除）
 * - 右侧：消息流（历史 + 流式）+ 任务清单 + 子 agent + 审批卡片 + 输入框
 *
 * 新建会话需先选一个 dbt project 作为工作空间（workspace），
 * 由 conversationApi.create({type:"dbt_project", refId, name}) 一步到位创建。
 */
export default function AgentChatLayout() {
  const {
    conversations,
    loading: convsLoading,
    creating: convsCreating,
    error: convsError,
    selectedId,
    refresh: refreshConvs,
    select,
    create: createConv,
    remove: deleteConv,
    clearError: clearConvsError,
  } = useConversations();

  const {
    messages: history,
    loading: messagesLoading,
    error: messagesError,
    load: loadMessages,
    clear: clearMessages,
    clearError: clearMessagesError,
  } = useConversationMessages();

  const {
    streamingMessage,
    generating,
    awaitingApproval,
    pendingApprovals,
    error: chatError,
    sendMessage,
    resume,
    stop: stopGenerating,
    toDisplayMessages,
    clearStreaming,
  } = useAgentChat();

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

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
      if (!selectedId || generating || awaitingApproval) return;
      sendMessage(selectedId, message, () => {
        loadMessages(selectedId);
        refreshConvs();
      });
    },
    [
      selectedId,
      generating,
      awaitingApproval,
      sendMessage,
      loadMessages,
      refreshConvs,
    ],
  );

  /** 新建会话：打开 workspace 选择 modal */
  const handleNewConversation = useCallback(() => {
    setWorkspaceModalOpen(true);
  }, []);

  /** 选中 dbt project 后，创建会话（一步到位 upsert workspace + 建会话） */
  const handleSelectProject = useCallback(
    async (project: { id: number; name: string }) => {
      setWorkspaceModalOpen(false);
      await createConv({ type: "dbt_project", refId: project.id, name: project.name });
    },
    [createConv],
  );

  /** 审批决策：approve / reject → resume 恢复执行 */
  const handleResolveApproval = useCallback(
    (decisions: Parameters<typeof resume>[1]) => {
      if (!selectedId) return;
      setResolving(true);
      resume(selectedId, decisions, () => {
        loadMessages(selectedId);
        refreshConvs();
      }).finally(() => setResolving(false));
    },
    [selectedId, resume, loadMessages, refreshConvs],
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
          creating={convsCreating}
          error={convsError}
          onSelect={select}
          onCreate={handleNewConversation}
          onDelete={deleteConv}
          onClearError={clearConvsError}
          onRetry={refreshConvs}
          retrying={convsLoading}
        />
      </aside>

      {/* 右侧对话区 */}
      <section className="flex flex-1 flex-col bg-background">
        {selectedId && (
          <ErrorAlert
            message={messagesError}
            onClose={clearMessagesError}
            onRetry={() => loadMessages(selectedId)}
            isRetrying={messagesLoading}
          />
        )}
        {selectedId && chatError && !messagesError && (
          <ErrorAlert message={chatError} onClose={clearStreaming} />
        )}
        {selectedId ? (
          displayMessages.length === 0 && !streamingMessage ? (
            messagesError ? null : <EmptyState type="no-messages" />
          ) : (
            <>
              <MessageList
                messages={displayMessages}
                streamingMessage={streamingMessage}
              />
              {/* HITL 审批卡片（写操作暂停时展示在消息流下方） */}
              {awaitingApproval && pendingApprovals.length > 0 && (
                <div className="px-4 pb-2">
                  <ApprovalCard
                    interrupts={pendingApprovals}
                    onResolve={handleResolveApproval}
                    resolving={resolving}
                  />
                </div>
              )}
            </>
          )
        ) : (
          <EmptyState type="no-conversation" />
        )}

        <ChatInput
          disabled={!selectedId || generating || awaitingApproval}
          generating={generating}
          onSend={handleSend}
          onStop={stopGenerating}
        />
      </section>

      {/* 选择工作空间 modal */}
      <WorkspaceSelectModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onSelect={handleSelectProject}
      />
    </div>
  );
}
