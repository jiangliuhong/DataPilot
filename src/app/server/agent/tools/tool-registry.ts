import { DynamicStructuredTool } from "@langchain/core/tools";
import type { StructuredTool } from "@langchain/core/tools";
import type { AgentWorkspace } from "@/app/db/schema";
import { BaseAgentTool } from "./base-tool";
import { ListProjectsTool } from "./project/list-projects.tool";
import { GetProjectTool } from "./project/get-project.tool";
import { ListDbtVersionsTool } from "./dbt/list-dbt-versions.tool";

/**
 * 业务工具注册中心（供 deepagents createDeepAgent 的 tools 参数）。
 *
 * 注意：文件系统相关工具（ls/read_file/write_file/edit_file/glob/grep）
 * 由 deepagents 内置，通过 backend 自动接管，**不在此注册**。
 * 本文件仅注册「业务领域工具」（查项目、查版本等）。
 *
 * 工具按 workspace.type 分组：未来不同工作空间类型可有不同工具集。
 */

/** dbt_project 工作空间的业务工具实例 */
function dbtProjectTools(): BaseAgentTool[] {
  return [new ListProjectsTool(), new GetProjectTool(), new ListDbtVersionsTool()];
}

/** 校验工具名唯一性 */
function assertUniqueNames(instances: BaseAgentTool[]) {
  const seen = new Set<string>();
  for (const t of instances) {
    if (seen.has(t.name)) {
      throw new Error(`工具名冲突：${t.name}`);
    }
    seen.add(t.name);
  }
}

/**
 * 按 workspace 组装业务工具（转换为 LangChain StructuredTool[]）。
 *
 * deepagents createDeepAgent 的 tools 参数接受 StructuredTool[]。
 * 注意：工具名不可与 deepagents 内置 fs 工具（ls/read_file/write_file/
 * edit_file/glob/grep/execute/task/write_todos）冲突。
 */
export function buildDomainTools(
  workspace: AgentWorkspace,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: number,
): StructuredTool[] {
  let instances: BaseAgentTool[] = [];
  switch (workspace.type) {
    case "dbt_project":
      instances = dbtProjectTools();
      break;
    default:
      instances = [];
  }
  assertUniqueNames(instances);
  return instances.map((t) => t.toLangChainTool());
}

/** 转换为 LangChain DynamicStructuredTool 数组（兼容旧调用，逐步弃用） */
export function getAgentTools(): DynamicStructuredTool[] {
  return dbtProjectTools().map((t) => t.toLangChainTool());
}

