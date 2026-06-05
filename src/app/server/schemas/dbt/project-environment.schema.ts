import { z } from "zod";

/** 绑定环境到项目 */
export const bindEnvironmentSchema = z.object({
  environmentId: z.number().int().positive("无效的环境 ID"),
  environmentAlias: z.string().max(255).optional(),
});

/** 项目 ID 参数 */
export const projectIdParamSchema = z.object({
  id: z.coerce.number().int().positive("无效的项目 ID"),
});

/** 解绑参数（项目 ID + 环境 ID） */
export const unbindEnvironmentSchema = z.object({
  id: z.coerce.number().int().positive("无效的项目 ID"),
  envId: z.coerce.number().int().positive("无效的环境 ID"),
});
