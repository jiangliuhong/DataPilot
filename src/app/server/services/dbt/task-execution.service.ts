/**
 * dbt 任务执行编排。
 *
 * 见 design.md D2 / D3 / D4：
 *   1. 校验任务存在、未软删、环境 active 且 initialized、连接存在
 *   2. 查重：runningTaskIds.has(taskId) → CONFLICT
 *   3. 插入 queued 运行记录 → 加锁 → 置 running + publish status
 *   4. setImmediate 异步执行工作函数，service 立即返回
 *   5. 工作函数：materialize workspace → spawnStreaming dbt → 终态落库 + publish done
 *   6. finally 清理 workspace + 释放锁
 *
 * 实时事件主题：task:<runId>:run
 *   - status: { status: "running", step }
 *   - log:    { stream: "stdout"|"stderr", line }
 *   - done:   { status: "succeeded"|"failed", error? }（每个 run 仅发布一次）
 *
 * 并发与恢复（review round 1 修复）：
 *   - 加锁采用 "先占内存锁，后查 DB" 的顺序，借助 Node 单线程事件循环，
 *     两个并发请求不会都通过 has() 检查后再竞争 add()。
 *   - 内存锁进程重启会丢失，因此降低 stale 阈值（默认 1h），并在模块加载时
 *     主动 reconcile 一次，防止崩溃后任务长时间无法重跑。
 *   - workspaceDir 在 worker 入口即按 <root>/<projectId>/<runId> 解析，
 *     保证 materializeWorkspace 抛错时 finally 也能清理。
 *   - done 事件用 settled 标志保证每个 run 仅发布一次。
 */
import path from "node:path";
import * as taskRepo from "@/app/server/repositories/dbt/task.repository";
import * as taskRunRepo from "@/app/server/repositories/dbt/task-run.repository";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import * as connectionRepo from "@/app/server/repositories/dbt/connection.repository";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import { spawnStreaming } from "@/app/server/lib/process";
import { publish } from "@/app/server/realtime";
import {
  getVenvBinDir,
  getTaskWorkspaceRoot,
} from "@/app/server/configs/dbt/constants";
import {
  materializeWorkspace,
  cleanupWorkspace,
} from "./task-workspace.service";
import { reconcileStaleRuns } from "./task.service";
import type { DbtTask } from "@/app/db/schema";

/** 默认 dbt 运行超时（毫秒），2 小时。可通过 DBT_RUN_TIMEOUT_MS 覆盖。 */
const DEFAULT_RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** errorMessage 落库 / 推送时的最大长度，避免 20 行 stderr 尾巴塞满字段。 */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/** 模块级内存锁：正在运行的任务 id 集合（保证同一 task 并发唯一） */
const runningTaskIds = new Set<number>();

/** 主题命名 */
function topic(runId: number): string {
  return `task:${runId}:run`;
}

/** 截断错误信息，超长时尾部省略号提示 */
function truncateError(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 3)}...`;
}

/**
 * 拼 dbt 命令（D4）。
 *
 * - command = <venvPath>/<binDir>/dbt
 * - args = [task.command, --select?, --exclude?, --full-refresh?, --vars?, --profiles-dir, --project-dir, --no-use-colors]
 * - 注意：D3.1 / R14 决定 profile 是单 target default，故 task.target 第一阶段忽略（不拼进 args）
 */
export function buildDbtCommand(
  task: Pick<DbtTask, "command" | "select" | "exclude" | "fullRefresh" | "vars">,
  venvPath: string,
  workspaceDir: string,
): { command: string; args: string[] } {
  const command = path.join(venvPath, getVenvBinDir(), "dbt");
  const args: string[] = [task.command];

  if (task.select) args.push("--select", task.select);
  if (task.exclude) args.push("--exclude", task.exclude);
  if (task.fullRefresh) args.push("--full-refresh");
  if (task.vars) args.push("--vars", task.vars);

  args.push("--profiles-dir", workspaceDir);
  args.push("--project-dir", workspaceDir);
  args.push("--no-use-colors");

  return { command, args };
}

/**
 * 异步工作函数：实例化工作区 → 执行 dbt → 终态落库 + publish done。
 *
 * done 事件保证每个 run 仅发布一次（用 settled 标志）；
 * workspaceDir 入口即解析，finally 一定清理（即便 materialize 抛错）。
 */
async function runExecution(runId: number, taskId: number): Promise<void> {
  const t = topic(runId);
  // 提前解析 workspaceDir，确保 finally 能清理（即便 materializeWorkspace 抛错）
  let workspaceDir: string | null = null;
  let settled = false;

  try {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      throw new Error("任务不存在");
    }
    workspaceDir = path.join(
      getTaskWorkspaceRoot(),
      String(task.projectId),
      String(runId),
    );

    const environment = await environmentRepo.findById(task.environmentId);
    if (!environment || !environment.venvPath) {
      throw new Error("运行环境不存在或未初始化");
    }
    const connection = await connectionRepo.findById(environment.connectionId);
    if (!connection) {
      throw new Error("数据库连接不存在");
    }
    const project = await projectRepo.findById(task.projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    // 实例化工作区
    publish(t, "status", { status: "running", step: "preparing-workspace" });
    await materializeWorkspace({
      projectId: task.projectId,
      runId,
      projectName: project.name,
      connection,
    });

    // 执行 dbt
    publish(t, "status", { status: "running", step: "executing-dbt" });
    const { command, args } = buildDbtCommand(task, environment.venvPath, workspaceDir);
    // 把 venv 的 bin 目录注入 PATH，确保 dbt 能找到 python 解释器
    const venvBin = path.dirname(command);
    const childEnv = {
      ...process.env,
      PATH: `${venvBin}:${process.env.PATH ?? ""}`,
    };

    const timeoutMs =
      Number(process.env.DBT_RUN_TIMEOUT_MS) || DEFAULT_RUN_TIMEOUT_MS;

    const result = await spawnStreaming(command, args, {
      cwd: workspaceDir,
      env: childEnv,
      timeoutMs,
      onLine: (stream, line) => publish(t, "log", { stream, line }),
    });

    // 成功终态
    settled = true;
    await taskRunRepo.updateRun(runId, {
      status: "succeeded",
      exitCode: result.code,
      finishedAt: new Date(),
    });
    publish(t, "done", { status: "succeeded" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!settled) {
      settled = true;
      try {
        await taskRunRepo.updateRun(runId, {
          status: "failed",
          errorMessage: truncateError(message),
          finishedAt: new Date(),
        });
      } catch (updateErr) {
        // 终态落库失败不阻塞 done 推送；记录日志即可
        console.error(`运行 ${runId} 落库失败状态失败:`, updateErr);
      }
      publish(t, "done", { status: "failed", error: truncateError(message) });
    } else {
      // 已发出 succeeded 的 done，仅记录异常（不再二次推送 / 翻转状态）
      console.error(`运行 ${runId} 成功落库后出现异常（已忽略）:`, err);
    }
  } finally {
    // 立即清理工作区（O1 决策）。workspaceDir 已在入口解析，
    // 即便 materializeWorkspace 抛错也能清理已创建的目录。
    if (workspaceDir) {
      await cleanupWorkspace(workspaceDir);
    }
    runningTaskIds.delete(taskId);
  }
}

/**
 * 触发某任务的执行。
 *
 * - 任务不存在 / 已软删 → NOT_FOUND
 * - 环境未 initialized → BAD_REQUEST
 * - 同任务已有活跃运行（内存锁 或 DB） → CONFLICT
 * - 否则插入 queued 运行记录 → 加锁 → 异步执行 → 立即返回
 *
 * 并发控制：先占内存锁（同步 add），再查 DB 活跃运行。借助 Node 单线程
 * 事件循环，两个并发请求不会同时通过 has() 后再各自 add()。
 */
export async function runTask(
  taskId: number,
): Promise<{ runId: number; status: "queued" }> {
  // 先占内存锁（同步操作，Node 单线程下不会被其他 await 打断）
  if (runningTaskIds.has(taskId)) {
    const err = new Error("该任务正在运行中");
    (err as Error & { code?: string }).code = "CONFLICT";
    throw err;
  }
  runningTaskIds.add(taskId);

  try {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      const err = new Error("任务不存在");
      (err as Error & { code?: string }).code = "NOT_FOUND";
      throw err;
    }

    // DB 活跃运行检测（queued/running）。与内存锁互为冗余，防御进程重启场景。
    const activeRun = await taskRunRepo.findActiveRunOfTask(taskId);
    if (activeRun) {
      const err = new Error("该任务正在运行中");
      (err as Error & { code?: string }).code = "CONFLICT";
      throw err;
    }

    // 前置校验
    const environment = await environmentRepo.findById(task.environmentId);
    if (!environment) {
      const err = new Error("运行环境不存在");
      (err as Error & { code?: string }).code = "NOT_FOUND";
      throw err;
    }
    if (environment.status !== "active") {
      const err = new Error("运行环境未启用");
      (err as Error & { code?: string }).code = "BAD_REQUEST";
      throw err;
    }
    if (environment.initializationStatus !== "initialized") {
      const err = new Error("运行环境尚未初始化完成");
      (err as Error & { code?: string }).code = "BAD_REQUEST";
      throw err;
    }
    const connection = await connectionRepo.findById(environment.connectionId);
    if (!connection) {
      const err = new Error("数据库连接不存在");
      (err as Error & { code?: string }).code = "NOT_FOUND";
      throw err;
    }

    // 插入 queued 运行记录（startedAt 留空，待真正进入 running 时回填）
    const run = await taskRunRepo.createRun({
      taskId,
      status: "queued",
    });
    if (!run) {
      throw new Error("创建运行记录失败");
    }
    const runId = run.id;

    // 置 running 并回填 startedAt
    await taskRunRepo.updateRun(runId, {
      status: "running",
      startedAt: new Date(),
    });
    publish(topic(runId), "status", { status: "running", step: "starting" });

    // 异步执行，不 await
    setImmediate(() => {
      runExecution(runId, taskId).catch((err) => {
        // runExecution 内部已捕获所有错误；此处兜底
        console.error(`执行任务 ${taskId}（运行 ${runId}）异常:`, err);
        runningTaskIds.delete(taskId);
      });
    });

    return { runId, status: "queued" };
  } catch (err) {
    // 前置校验失败：释放内存锁
    runningTaskIds.delete(taskId);
    throw err;
  }
}

/**
 * 模块加载时主动 reconcile 一次僵尸运行记录。
 *
 * 进程重启后内存锁丢失，但 DB 中可能仍有 status=running 的孤儿记录。
 * 此处主动清理，避免任务长时间无法重跑（review round 1 修复 C2）。
 */
void reconcileStaleRuns().catch((err) => {
  console.error("模块加载时清理僵尸运行记录失败:", err);
});
