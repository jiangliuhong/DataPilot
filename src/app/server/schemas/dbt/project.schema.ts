import { z } from "zod";

/** 创建项目 */
export const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(255),
  description: z.string().max(65535).optional(),
});

/** 更新项目 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(65535).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

/** 项目 ID 参数 */
export const projectIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的项目 ID"),
});

/** 项目列表查询参数 */
export const listProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "archived"]).optional(),
});
