import { z } from "zod";
import { SUPPORTED_FILE_TYPES } from "@/app/server/configs/dbt/constants";

/** 文件类型集合（用于校验） */
const fileTypeSet = new Set<string>(SUPPORTED_FILE_TYPES);

/** 根据文件名提取扩展名并校验 */
function detectFileType(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) {
    throw new Error(`文件 ${filename} 缺少有效的扩展名`);
  }
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  // yml 和 yaml 统一为 yml
  return ext === "yaml" ? "yml" : ext;
}

/** 创建文件 */
export const createFileSchema = z
  .object({
    name: z
      .string()
      .min(1, "文件名称不能为空")
      .max(255)
      .refine((name) => {
        const ext = name.lastIndexOf(".") !== -1 ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
        return fileTypeSet.has(ext) || ext === "yaml";
      }, `不支持的文件类型，支持的类型: ${SUPPORTED_FILE_TYPES.join(", ")}`),
    directoryId: z.number().int().positive().nullable().optional(),
    content: z.string().default(""),
  })
  .transform((data) => ({
    ...data,
    fileType: detectFileType(data.name),
  }));

/** 更新文件 */
export const updateFileSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .refine((name) => {
        const ext = name.lastIndexOf(".") !== -1 ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
        return fileTypeSet.has(ext) || ext === "yaml";
      }, `不支持的文件类型，支持的类型: ${SUPPORTED_FILE_TYPES.join(", ")}`)
      .optional(),
    content: z.string().optional(),
    directoryId: z.number().int().positive().nullable().optional(),
  })
  .transform((data) => ({
    ...data,
    ...(data.name ? { fileType: detectFileType(data.name) } : {}),
  }));

/** 文件 ID 参数 */
export const fileIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的项目 ID"),
  fileId: z.coerce.number().int().positive("无效的文件 ID"),
});

/**
 * 文件列表查询参数。
 *
 * directoryId 三态语义：
 *   - 缺省（undefined）：不过滤目录，返回项目下所有文件
 *   - "null" / "root"：仅返回项目根目录下的文件（directory_id IS NULL）
 *   - 正整数：仅返回该目录下的文件
 *
 * 由于 query string 里拿到的都是字符串，用 preprocess 显式把表示
 * 「根目录」的字面量归一为 null，避免与正整数分支混淆。
 */
export const listFilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  fileType: z.string().optional(),
  directoryId: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (val === "null" || val === "root") return null;
    return val;
  }, z.union([z.coerce.number().int().positive(), z.null()]).optional()),
});
