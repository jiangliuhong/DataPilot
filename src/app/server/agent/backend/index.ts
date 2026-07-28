import type { BackendProtocolV2 } from "deepagents";
import type { AgentWorkspace } from "@/app/db/schema";
import { DbProjectBackend } from "./db-project-backend";

/**
 * Backend 工厂：按 workspace.type 分发到对应的文件系统 backend。
 *
 * 这是「独立 workspace 表」架构的核心价值点 —— 新增工作空间类型
 * 只需在此加一个 case + 实现一个 backend，会话/service 层零改动。
 *
 * 当前仅支持 'dbt_project'（refId → dbt_projects.id）。
 * 未来扩展示例：
 *   case "report": return new ReportBackend(workspace.refId);
 */
export function createBackend(workspace: AgentWorkspace): BackendProtocolV2 {
  switch (workspace.type) {
    case "dbt_project":
      return new DbProjectBackend(workspace.refId);
    default:
      throw new Error(
        `不支持的工作空间类型: ${workspace.type}（当前仅支持 dbt_project）`,
      );
  }
}

export { DbProjectBackend };
