import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/app/server/configs/dbt/constants";

/** 创建运行环境 */
export const createEnvironmentSchema = z.object({
  name: z.string().min(1, "环境名称不能为空").max(255),
  versionId: z.number().int().positive("无效的版本 ID"),
  connectionId: z.number().int().positive("无效的连接 ID"),
});

/** 更新运行环境 */
export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  versionId: z.number().int().positive().optional(),
  connectionId: z.number().int().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/** 环境 ID 参数 */
export const environmentIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的环境 ID"),
});

/** 初始化触发参数（复用 environmentIdSchema 校验 path id，无 body） */
export const initializeEnvironmentSchema = environmentIdSchema;

/** 环境列表查询参数 */
export const listEnvironmentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "inactive"]).optional(),
});
