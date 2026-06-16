import { z } from "zod";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import { BaseAgentTool } from "../base-tool";

/** 按 ID 查询单个 dbt 项目详情 */
export class GetProjectTool extends BaseAgentTool {
  readonly name = "get_project";
  readonly description =
    "按 ID 查询单个 dbt 项目的详情。返回项目的 id、名称、描述、状态、创建/更新时间。项目不存在时返回 null。";

  readonly schema = z.object({
    id: z.number().int().positive(),
  });

  async execute(args: { id: number }) {
    const project = await projectRepo.findById(args.id);
    // 不抛异常，返回明确结构便于 Agent 据此回应用户
    return project ?? { notFound: true, id: args.id };
  }
}
