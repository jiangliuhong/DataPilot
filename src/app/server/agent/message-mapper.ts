import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentMessage } from "@/app/db/schema";
import { parseToolCalls, type ToolCallRecord } from "@/app/server/repositories/agent/message.repository";

/**
 * 把 DB 消息记录转换为 LangChain 消息序列（用于重建对话上下文）。
 *
 * - role=user   → HumanMessage
 * - role=assistant → AIMessage（含 tool_calls）
 * - role=tool   → ToolMessage（关联 tool_call_id）
 *
 * 消息表存原始 toolCalls（JSON 字符串），重建时完整还原，支持多轮工具调用上下文。
 */
export function dbMessagesToLangChain(rows: AgentMessage[]) {
  const messages: (HumanMessage | AIMessage | ToolMessage | SystemMessage)[] = [];

  for (const row of rows) {
    switch (row.role) {
      case "user":
        messages.push(new HumanMessage({ content: row.content ?? "" }));
        break;
      case "assistant": {
        const toolCalls = parseToolCalls(row.toolCalls);
        messages.push(
          new AIMessage({
            content: row.content ?? "",
            ...(toolCalls ? { tool_calls: toolCallsToLangChain(toolCalls) } : {}),
          }),
        );
        break;
      }
      case "tool":
        messages.push(
          new ToolMessage({
            content: row.content ?? "",
            tool_call_id: row.toolCallId ?? "",
          }),
        );
        break;
    }
  }

  return messages;
}

/** 把存储的 ToolCallRecord 转换为 LangChain AIMessage.tool_calls 所需形状 */
function toolCallsToLangChain(toolCalls: ToolCallRecord[]) {
  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.name,
    args: tc.args,
  }));
}
