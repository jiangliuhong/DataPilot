import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/app/server/configs/dbt/constants";

/** 适配器包结构 */
const adapterPackageSchema = z.object({
  name: z.string().min(1, "适配器包名称不能为空"),
  version: z.string().min(1, "适配器包版本不能为空"),
  supportedDatabases: z
    .array(z.string().min(1))
    .min(1, "至少支持一种数据库类型"),
});

/** Python 依赖结构 */
const dependencySchema = z.object({
  name: z.string().min(1, "依赖包名称不能为空"),
  version: z.string().min(1, "依赖包版本不能为空"),
});

/** 创建版本 */
export const createVersionSchema = z.object({
  name: z.string().min(1, "版本名称不能为空").max(255),
  version: z.string().min(1, "版本号不能为空").max(50),
  adapterPackages: z.array(adapterPackageSchema).min(1, "至少需要一个适配器包"),
  dependencies: z.array(dependencySchema).min(1, "至少需要一个依赖包"),
});

/** 更新版本 */
export const updateVersionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  version: z.string().min(1).max(50).optional(),
  adapterPackages: z.array(adapterPackageSchema).min(1).optional(),
  dependencies: z.array(dependencySchema).min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/** 版本 ID 参数 */
export const versionIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的版本 ID"),
});

/** 版本列表查询参数 */
export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  version: z.string().max(50).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
