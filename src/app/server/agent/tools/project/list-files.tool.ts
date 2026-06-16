import { z } from "zod";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import { BaseAgentTool } from "../base-tool";

/** 列出指定项目下的文件（不含 content） */
export class ListFilesTool extends BaseAgentTool {
  readonly name = "list_files";
  readonly description =
    "列出指定 dbt 项目下的文件（不含文件内容，仅元数据：id、名称、路径、类型、大小）。支持分页。读取文件内容请用 read_file。";

  readonly schema = z.object({
    projectId: z.number().int().positive(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  });

  async execute(args: {
    projectId: number;
    limit?: number;
    offset?: number;
  }) {
    return fileRepo.findByProjectId({
      projectId: args.projectId,
      limit: args.limit ?? 50,
      offset: args.offset ?? 0,
    });
  }
}
