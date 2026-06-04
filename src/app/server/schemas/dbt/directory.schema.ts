import { z } from "zod";

/** 创建目录 */
export const createDirectorySchema = z.object({
  name: z
    .string()
    .min(1, "目录名称不能为空")
    .max(255)
    .regex(
      /^[a-zA-Z0-9_\-.]+$/,
      "目录名称只能包含字母、数字、下划线、连字符和点",
    ),
  parentId: z.number().int().positive().nullable().optional(),
});

/** 更新目录 */
export const updateDirectorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_\-.]+$/, "目录名称只能包含字母、数字、下划线、连字符和点")
    .optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

/** 目录 ID 参数 */
export const directoryIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的项目 ID"),
  dirId: z.coerce.number().int().positive("无效的目录 ID"),
});

/** 目录列表查询参数 */
export const listDirectoriesQuerySchema = z.object({
  parentId: z.coerce.number().int().positive().nullable().optional(),
});
