import { z } from "zod";
import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import { BaseAgentTool } from "../base-tool";

/** 查询 dbt 版本列表 */
export class ListDbtVersionsTool extends BaseAgentTool {
  readonly name = "list_dbt_versions";
  readonly description =
    "查询 dbt 版本列表（版本号、适配器包、依赖、状态、创建时间）。支持分页。";

  readonly schema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  });

  async execute(args: { limit?: number; offset?: number }) {
    return versionRepo.findList({
      limit: args.limit ?? 50,
      offset: args.offset ?? 0,
    });
  }
}
