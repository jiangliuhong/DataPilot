import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Agent 工具抽象基类。
 *
 * 所有内置工具 SHALL 继承本基类，实现 `name`、`description`、`schema`（Zod）
 * 和 `execute()`。基类负责把工具契约转换为 LangChain 的 `DynamicStructuredTool`，
 * 使 agent.service 无需感知 LangChain 适配细节。
 *
 * 新增工具只需：① 继承 BaseAgentTool ② 在 tool-registry.ts 注册一行。
 *
 * 泛型 T 为工具入参的 Zod schema，execute 的入参由 schema 推导，避免重复声明类型。
 */
export abstract class BaseAgentTool<
  T extends z.ZodType = z.ZodType,
> {
  /** 工具唯一标识（LLM 调用时使用） */
  abstract readonly name: string;
  /** 工具描述（LLM 据此决定是否调用） */
  abstract readonly description: string;
  /** 工具入参的 Zod schema */
  abstract readonly schema: T;

  /** 执行工具，返回可 JSON 序列化的结果 */
  abstract execute(args: z.infer<T>): Promise<unknown>;

  /**
   * 转换为 LangChain DynamicStructuredTool，供 LLM.bindTools() 使用。
   *
   * 转换时做一次入参校验（schema.parse），保证传入 LLM 的参数符合契约。
   */
  toLangChainTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: this.name,
      description: this.description,
      // DynamicStructuredTool 期望 ZodObject；各工具保证 schema 为 z.object()
      schema: this.schema as unknown as z.ZodObject<z.ZodRawShape>,
      func: async (input: unknown) => {
        const parsed = this.schema.parse(input);
        return this.execute(parsed);
      },
    });
  }
}
