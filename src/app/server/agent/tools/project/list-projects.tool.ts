import { z } from "zod";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import { BaseAgentTool } from "../base-tool";

/** 查询 dbt 项目列表 */
export class ListProjectsTool extends BaseAgentTool {
  readonly name = "list_projects";
  readonly description =
    "查询 dbt 项目列表。可按状态过滤（active/archived），支持分页。返回项目的 id、名称、描述、状态、创建时间。";

  readonly schema = z.object({
    status: z.enum(["active", "archived"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  });

  async execute(args: {
    status?: "active" | "archived";
    limit?: number;
    offset?: number;
  }) {
    return projectRepo.findList({
      limit: args.limit ?? 20,
      offset: args.offset ?? 0,
      status: args.status,
    });
  }
}
