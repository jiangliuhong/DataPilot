import { DynamicStructuredTool } from "@langchain/core/tools";
import { BaseAgentTool } from "./base-tool";
import { ListProjectsTool } from "./project/list-projects.tool";
import { GetProjectTool } from "./project/get-project.tool";
import { ListFilesTool } from "./project/list-files.tool";
import { ReadFileTool } from "./project/read-file.tool";
import { ListDbtVersionsTool } from "./dbt/list-dbt-versions.tool";

/**
 * 工具注册中心。
 *
 * 聚合所有内置工具实例，做 name 唯一性校验，并提供转换为 LangChain 工具的出口。
 * agent.service 仅依赖 getAgentTools()，不直接 import 具体工具实现 →
 * 工具新增/移除对 agent 编排零侵入。
 *
 * 新增工具：① 在 tools/<域>/ 下新建 .tool.ts 继承 BaseAgentTool
 *          ② 在下方 toolInstances 数组中添加实例
 */
const toolInstances: BaseAgentTool[] = [
  new ListProjectsTool(),
  new GetProjectTool(),
  new ListFilesTool(),
  new ReadFileTool(),
  new ListDbtVersionsTool(),
];

/** 校验工具名唯一性 */
function assertUniqueNames(instances: BaseAgentTool[]) {
  const seen = new Set<string>();
  for (const tool of instances) {
    if (seen.has(tool.name)) {
      throw new Error(`工具名冲突：${tool.name}`);
    }
    seen.add(tool.name);
  }
}

assertUniqueNames(toolInstances);

/** 原始工具实例（供需要 BaseAgentTool 契约的场景） */
export function getToolInstances(): BaseAgentTool[] {
  return toolInstances;
}

/** 转换为 LangChain DynamicStructuredTool 数组（供 LLM.bindTools() 使用） */
export function getAgentTools(): DynamicStructuredTool[] {
  return toolInstances.map((tool) => tool.toLangChainTool());
}

/** 按 name 查找工具实例（供 agent.service 执行工具调用时使用） */
export function findToolByName(name: string): BaseAgentTool | undefined {
  return toolInstances.find((tool) => tool.name === name);
}
