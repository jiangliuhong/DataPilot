/**
 * 任务 CRUD 编排与运行记录查询。
 *
 * 见 design.md D5 / D8：
 *   - createTask：校验环境已绑定项目 + 项目内 name 唯一 + 适配器兼容性
 *   - listTaskRuns：内部惰性调用 reconcileStaleRuns（O3）
 */
import * as taskRepo from "@/app/server/repositories/dbt/task.repository";
import * as taskRunRepo from "@/app/server/repositories/dbt/task-run.repository";
import * as projectEnvRepo from "@/app/server/repositories/dbt/project-environment.repository";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import * as connectionRepo from "@/app/server/repositories/dbt/connection.repository";
import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import {
  createTaskSchema,
  updateTaskSchema,
} from "@/app/server/schemas/dbt/task.schema";
import type { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/app/server/configs/dbt/constants";

/** 由 Zod schema 推导的输入类型，避免手写类型与 schema 漂移（S6） */
type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** 僵尸运行记录修正阈值：超过此时间仍为 running 视为进程崩溃。
 * 默认 1 小时——比 dbt 单次运行的合理上限（含超时 2h 的一半）更激进，
 * 以便进程崩溃后用户能尽快重跑（review round 1 修复 C2）。
 */
const STALE_RUN_THRESHOLD_MS = 60 * 60 * 1000; // 1h

/** 适配器兼容性校验（复用 environment.service 的逻辑，任务层面再做一次以防御环境后续换连接） */
function validateAdapterCompatibility(
  adapterPackages: { name: string; version: string; supportedDatabases: string[] }[],
  databaseType: string,
): void {
  const supported = adapterPackages.some((pkg) =>
    pkg.supportedDatabases.includes(databaseType),
  );
  if (!supported) {
    throw new Error(`该版本的适配器包不支持 ${databaseType} 数据库类型`);
  }
}

/** 创建任务（含项目绑定校验、name 唯一校验、适配器兼容性校验） */
export async function createTask(data: CreateTaskInput) {
  // 校验环境已绑定到该项目（防止跨项目绑定）
  const binding = await projectEnvRepo.findBinding(data.projectId, data.environmentId);
  if (!binding) {
    throw new Error("该运行环境未绑定到指定项目");
  }

  // 校验项目内 name 唯一
  const existing = await taskRepo.findByNameInProject(data.projectId, data.name);
  if (existing) {
    throw new Error("任务名称在项目内已存在");
  }

  // 适配器兼容性校验（D8）
  const environment = await environmentRepo.findById(data.environmentId);
  if (!environment) {
    throw new Error("运行环境不存在");
  }
  const version = await versionRepo.findById(environment.versionId);
  if (!version) {
    throw new Error("dbt 版本不存在");
  }
  const connection = await connectionRepo.findById(environment.connectionId);
  if (!connection) {
    throw new Error("数据库连接不存在");
  }
  validateAdapterCompatibility(
    version.adapterPackages ?? [],
    connection.databaseType,
  );

  return taskRepo.createTask(data);
}

/** 查询任务详情 */
export const getTask = taskRepo.findById;

/** 任务列表 */
export async function listTasks(options: {
  limit?: number;
  offset?: number;
  projectId?: number;
  environmentId?: number;
  command?: string;
}) {
  return taskRepo.findList({
    limit: Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    offset: options.offset ?? 0,
    projectId: options.projectId,
    environmentId: options.environmentId,
    command: options.command,
  });
}

/** 更新任务（变更 environmentId 时重校验绑定与兼容性；变更 name 时重校验唯一） */
export async function updateTask(
  id: number,
  data: UpdateTaskInput,
) {
  const task = await taskRepo.findById(id);
  if (!task) return null;

  // name 唯一性重校验
  if (data.name && data.name !== task.name) {
    const existing = await taskRepo.findByNameInProject(task.projectId, data.name);
    if (existing) {
      throw new Error("任务名称在项目内已存在");
    }
  }

  // 环境变更时重校验绑定 + 适配器兼容性
  const newEnvironmentId = data.environmentId ?? task.environmentId;
  if (data.environmentId && data.environmentId !== task.environmentId) {
    const binding = await projectEnvRepo.findBinding(task.projectId, newEnvironmentId);
    if (!binding) {
      throw new Error("该运行环境未绑定到指定项目");
    }
    const environment = await environmentRepo.findById(newEnvironmentId);
    if (!environment) {
      throw new Error("运行环境不存在");
    }
    const version = await versionRepo.findById(environment.versionId);
    if (!version) {
      throw new Error("dbt 版本不存在");
    }
    const connection = await connectionRepo.findById(environment.connectionId);
    if (!connection) {
      throw new Error("数据库连接不存在");
    }
    validateAdapterCompatibility(
      version.adapterPackages ?? [],
      connection.databaseType,
    );
  }

  return taskRepo.updateById(id, data);
}

/** 软删除任务 */
export async function deleteTask(id: number) {
  const task = await taskRepo.findById(id);
  if (!task) return null;
  await taskRepo.softDeleteById(id);
  return task;
}

/**
 * 修正僵尸运行记录：超过阈值仍为 queued/running 的视为进程崩溃，置为 failed。
 * 在 listTaskRuns 入口处惰性调用（O3），并在 task-execution.service 模块加载时主动调用一次。
 *
 * 同时覆盖卡在 queued 的行——若进程在 createRun(queued) 与 updateRun(running) 之间
 * 崩溃，行会停在 queued 且 startedAt=null，按 createdAt 判定年龄才能被清理
 * （否则 findActiveRunOfTask 会永久阻塞该任务）。
 */
export async function reconcileStaleRuns(): Promise<number> {
  const threshold = new Date(Date.now() - STALE_RUN_THRESHOLD_MS);
  const stale = await taskRunRepo.findStaleActive(threshold);
  if (stale.length === 0) return 0;
  await taskRunRepo.updateStatusByIds(
    stale.map((r) => r.id),
    {
      status: "failed",
      errorMessage: "进程中断（运行超时未完成）",
      finishedAt: new Date(),
    },
  );
  return stale.length;
}

/** 查询任务运行记录列表（先惰性修正僵尸记录） */
export async function listTaskRuns(options: {
  taskId: number;
  limit?: number;
  offset?: number;
  status?: "queued" | "running" | "succeeded" | "failed" | "canceled";
}) {
  await reconcileStaleRuns();
  return taskRunRepo.findRunsByTask({
    taskId: options.taskId,
    limit: Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    offset: options.offset ?? 0,
    status: options.status,
  });
}

/** 查询单条运行记录 */
export const getRun = taskRunRepo.findRunById;
