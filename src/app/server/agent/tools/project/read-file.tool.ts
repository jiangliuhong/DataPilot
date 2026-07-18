import { z } from "zod";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import { BaseAgentTool } from "../base-tool";

/** 文件内容截断阈值（字符），避免上下文超限 */
const MAX_FILE_CONTENT_LENGTH = 50_000;

/** 读取指定文件的内容 */
export class ReadFileTool extends BaseAgentTool {
  readonly name = "read_file";
  readonly description =
    "读取指定 dbt 项目的某个文件内容（含 id、名称、类型、内容）。文件不存在返回 notFound。超大文件会被截断（truncated=true）。";

  readonly schema = z.object({
    projectId: z.number().int().positive(),
    fileId: z.number().int().positive(),
  });

  async execute(args: { projectId: number; fileId: number }) {
    const file = await fileRepo.findById(args.fileId);
    if (!file) {
      return { notFound: true, fileId: args.fileId };
    }

    // 保护：截断过长内容，避免 LLM 上下文超限
    const originalLength = file.content.length;
    const truncated = originalLength > MAX_FILE_CONTENT_LENGTH;

    return {
      id: file.id,
      name: file.name,
      path: file.path,
      fileType: file.fileType,
      content: truncated
        ? file.content.slice(0, MAX_FILE_CONTENT_LENGTH)
        : file.content,
      truncated,
      originalLength,
    };
  }
}
