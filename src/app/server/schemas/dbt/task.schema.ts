import { z } from "zod";

/** dbt 任务命令枚举（后端支持全集；前端第一阶段锁定 run） */
export const taskCommandSchema = z.enum([
  "run",
  "build",
  "test",
  "compile",
  "seed",
  "snapshot",
]);

/** 任务运行状态枚举 */
export const taskRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);

/** 校验 vars 是合法的 JSON 对象字符串 */
const varsSchema = z
  .string()
  .max(65535)
  .refine(
    (s) => {
      try {
        const parsed = JSON.parse(s);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    },
    { message: "vars 必须是合法的 JSON 对象字符串" },
  );

/** 创建任务 */
export const createTaskSchema = z.object({
  projectId: z.number().int().positive("无效的项目 ID"),
  environmentId: z.number().int().positive("无效的环境 ID"),
  name: z.string().min(1, "任务名称不能为空").max(255),
  description: z.string().max(65535).optional(),
  command: taskCommandSchema,
  select: z.string().max(2000).optional(),
  exclude: z.string().max(2000).optional(),
  fullRefresh: z.boolean().optional(),
  vars: varsSchema.optional(),
  target: z.string().max(255).optional(),
});

/** 更新任务（全部 optional；projectId 不可变） */
export const updateTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(65535).optional(),
  environmentId: z.number().int().positive("无效的环境 ID").optional(),
  command: taskCommandSchema.optional(),
  select: z.string().max(2000).optional(),
  exclude: z.string().max(2000).optional(),
  fullRefresh: z.boolean().optional(),
  vars: varsSchema.optional(),
  target: z.string().max(255).optional(),
});

/** 任务 ID 参数 */
export const taskIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的任务 ID"),
});

/** 任务运行记录 ID 参数 */
export const taskRunIdSchema = z.object({
  runId: z.coerce.number().int().positive("无效的运行 ID"),
});

/** 任务列表查询参数 */
export const listTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  projectId: z.coerce.number().int().positive().optional(),
  environmentId: z.coerce.number().int().positive().optional(),
  command: taskCommandSchema.optional(),
});

/** 任务运行记录列表查询参数 */
export const listTaskRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: taskRunStatusSchema.optional(),
});
