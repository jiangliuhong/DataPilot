import { SystemMessage } from "@langchain/core/messages";
import * as conversationRepo from "@/app/server/repositories/agent/conversation.repository";
import * as messageRepo from "@/app/server/repositories/agent/message.repository";
import type { ToolCallRecord } from "@/app/server/repositories/agent/message.repository";
import { createLLM } from "./llm";
import { getAgentTools, findToolByName } from "./tools";
import { dbMessagesToLangChain } from "./message-mapper";
import type { EmitEvent } from "./types";

/** Agent 单轮对话的最大工具调用轮次（防死循环） */
const MAX_TOOL_ROUNDS = 8;

/** 系统提示词，定义 Agent 的角色与行为边界 */
const SYSTEM_PROMPT = `你是 DataPilot 的 AI 助手，帮助用户查询和管理数据资产（dbt 项目、文件、版本等）。
你可以调用工具查询数据，但首版工具仅支持查询，不支持创建、修改、删除操作。
回答用户问题时：
- 用中文回答
- 需要数据时主动调用工具，不要编造
- 工具返回后，用自然语言总结结果`;

/**
 * 流式编排一轮 Agent 对话。
 *
 * 流程：校验会话归属 → 持久化 user 消息（+首条消息生成标题）→ 加载历史上下文
 *      → 驱动 Agent 循环（工具调用 + 最终流式回复）→ 持久化 assistant 消息。
 *
 * 编排过程中通过 emit 回调下发 SSE 事件；异常时 emit error 并停止。
 *
 * @param userId     当前登录用户（数据隔离）
 * @param conversationId 会话 ID
 * @param message    用户消息文本
 * @param emit       事件下发回调
 */
export async function streamChat(
  userId: number,
  conversationId: number,
  message: string,
  emit: EmitEvent,
): Promise<void> {
  try {
    // 1. 校验会话归属（越权 → 视为不存在）
    const conversation = await conversationRepo.findById(conversationId, userId);
    if (!conversation) {
      emit({ type: "error", message: "会话不存在" });
      return;
    }

    // 2. 持久化 user 消息
    await messageRepo.create({
      conversationId,
      role: "user",
      content: message,
    });

    // 首条消息生成标题（仅当标题仍为默认"新对话"）
    if (conversation.title === "新对话") {
      await conversationRepo.updateTitle(
        conversationId,
        userId,
        message.slice(0, 30),
      );
    }

    // 3. 加载历史上下文（含刚写入的 user 消息），转换为 LangChain 消息序列
    const historyRows = await messageRepo.findByConversationId(conversationId);
    const history = dbMessagesToLangChain(historyRows);

    // 4. 组装 LLM + 工具，驱动 Agent 循环
    const llm = createLLM();
    const tools = getAgentTools();
    const boundLLM = llm.bindTools(tools);

    const messages: import("@langchain/core/messages").BaseMessage[] = [
      new SystemMessage({ content: SYSTEM_PROMPT }),
      ...history,
    ];

    // 收集本轮 assistant 消息的工具调用（用于持久化）
    const collectedToolCalls: ToolCallRecord[] = [];
    let assistantContent = "";

    // 5. Agent 循环：LLM 决策 → 执行工具 → 喂回 → 直到产出最终文本
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const aiMessage = await boundLLM.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = (aiMessage as { tool_calls?: unknown }).tool_calls;

      // 无工具调用 → 本轮为最终回复，流式输出
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        assistantContent = typeof aiMessage.content === "string"
          ? aiMessage.content
          : String(aiMessage.content ?? "");

        // 整体下发（首版非 token 级流式，以完整文本作为一个 token 事件）
        emit({ type: "token", value: assistantContent });
        break;
      }

      // 有工具调用 → 逐个执行
      for (const call of toolCalls as Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }>) {
        collectedToolCalls.push({
          id: call.id,
          name: call.name,
          args: call.args,
        });

        emit({ type: "tool_start", tool: call.name, input: call.args });

        const tool = findToolByName(call.name);
        let output: unknown;
        try {
          output = tool ? await tool.execute(call.args) : { error: `未知工具: ${call.name}` };
        } catch (err) {
          output = {
            error: err instanceof Error ? err.message : "工具执行失败",
          };
        }

        // 序列化工具结果（确保可 JSON 化）
        const outputStr = safeStringify(output);
        emit({ type: "tool_end", tool: call.name, output });

        // 把工具结果作为 ToolMessage 喂回，供下一轮 LLM 决策
        const { ToolMessage } = await import("@langchain/core/messages");
        messages.push(
          new ToolMessage({
            content: outputStr,
            tool_call_id: call.id,
          }),
        );
      }
    }

    // 6. 持久化 assistant 消息（含本轮工具调用），emit message_end
    const created = await messageRepo.create({
      conversationId,
      role: "assistant",
      content: assistantContent,
      ...(collectedToolCalls.length > 0
        ? { toolCalls: collectedToolCalls }
        : {}),
    });

    emit({
      type: "message_end",
      messageId: created?.id ?? 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "对话编排失败";
    emit({ type: "error", message });
  }
}

/** 安全序列化工具结果为字符串（处理 BigInt、循环引用等） */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val,
    );
  } catch {
    return String(value);
  }
}
