import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/app/server/configs/dbt/constants";

const databaseTypeSchema = z.enum(["mysql5", "mysql8", "starrocks", "postgresql"]);

/** 创建数据库连接 */
export const createConnectionSchema = z.object({
  name: z.string().min(1, "连接名称不能为空").max(255),
  databaseType: databaseTypeSchema,
  host: z.string().min(1, "主机地址不能为空").max(255),
  port: z.number().int().min(1, "端口不能小于 1").max(65535, "端口不能大于 65535"),
  databaseName: z.string().min(1, "数据库名称不能为空").max(255),
  schemaName: z.string().max(255).optional(),
  username: z.string().min(1, "用户名不能为空").max(255),
  password: z.string().min(1, "密码不能为空"),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
});

/** 更新数据库连接 */
export const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  databaseType: databaseTypeSchema.optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  databaseName: z.string().min(1).max(255).optional(),
  schemaName: z.string().max(255).optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).optional(),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/** 连接 ID 参数 */
export const connectionIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的连接 ID"),
});

/** 连接列表查询参数 */
export const listConnectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  databaseType: databaseTypeSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
