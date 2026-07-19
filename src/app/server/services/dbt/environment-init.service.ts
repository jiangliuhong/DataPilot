/**
 * 运行环境 venv 初始化编排。
 *
 * 流程（见 design.md D6）：
 *   1. 校验环境存在；查当前 initializationStatus
 *   2. 若内存锁中已存在该环境 → 抛错（route 返回 409）
 *   3. 置 DB running、publish status:running
 *   4. setImmediate 异步执行工作函数，service 立即返回
 *   5. 工作函数：创建 venv → pip install → 成功置 initialized / 失败置 failed
 *   6. finally 释放内存锁
 *
 * 实时事件主题：environment:<id>:init
 *   - status: { status, step }
 *   - log:    { stream: "stdout"|"stderr", line }
 *   - done:   { status: "initialized"|"failed", error? }
 */
import path from "node:path";
import fs from "node:fs/promises";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import { spawnStreaming } from "@/app/server/lib/process";
import { publish } from "@/app/server/realtime";
import {
  getVenvRoot,
  getVenvBinDir,
  getPipIndexUrl,
  resolvePythonBin,
  DEFAULT_INIT_TIMEOUT_MS,
} from "@/app/server/configs/dbt/constants";

/** 初始化状态 */
export type InitializationStatus =
  | "pending"
  | "running"
  | "initialized"
  | "failed";

/** 模块级内存锁：正在初始化的环境 id 集合（保证同一环境并发唯一） */
const runningEnvIds = new Set<number>();

/** 主题命名 */
function topic(envId: number): string {
  return `environment:${envId}:init`;
}

/**
 * 环境名做文件系统安全化：保留 a-zA-Z0-9._-，其余替换为 _。
 */
function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "_";
}

/**
 * 解析某环境的 venv 路径。
 * 按环境名安全化命名。无论目录是否已存在均返回该路径——
 * runInitialization 会在每次创建 venv 前清理它。
 */
async function resolveVenvPath(envId: number, name: string): Promise<string> {
  const root = getVenvRoot();
  void envId; // 预留：未来若需基于 id 做冲突回退
  return path.join(root, sanitizeName(name));
}

/**
 * 把版本的 dependencies 拼成 pip install 参数。
 * version 为 "latest" 时不加约束，否则拼 name==version。
 */
function buildPipArgs(
  dependencies: { name: string; version: string }[],
): string[] {
  return dependencies.map((dep) =>
    dep.version === "latest" || !dep.version
      ? dep.name
      : `${dep.name}==${dep.version}`,
  );
}

/**
 * 异步工作函数：创建 venv + pip install，推进状态机并推送事件。
 * 所有错误被捕获，最终落库为 initialized 或 failed。
 */
async function runInitialization(envId: number): Promise<void> {
  const t = topic(envId);
  const pythonBin = resolvePythonBin();
  const pipIndexUrl = getPipIndexUrl();
  const timeoutMs = Number(process.env.DBT_INIT_TIMEOUT_MS) || DEFAULT_INIT_TIMEOUT_MS;

  try {
    // 重新查询环境与版本依赖
    const env = await environmentRepo.findById(envId);
    if (!env) {
      // 环境在运行期间被删除
      publish(t, "done", { status: "failed", error: "环境不存在" });
      return;
    }
    const version = await versionRepo.findById(env.versionId);
    if (!version) {
      throw new Error("关联的 dbt 版本不存在");
    }

    const venvPath = await resolveVenvPath(envId, env.name);
    const venvPython = path.join(venvPath, getVenvBinDir(), "python");

    // —— 步骤 1：创建虚拟环境 ——
    publish(t, "status", { status: "running", step: "creating-venv" });
    await fs.mkdir(path.dirname(venvPath), { recursive: true });
    // 重新初始化时先清理旧 venv 目录：在残留目录上重建 venv 会导致内部 ensurepip 失败
    await fs.rm(venvPath, { recursive: true, force: true });
    await spawnStreaming(pythonBin, ["-m", "venv", venvPath], {
      onLine: (stream, line) => publish(t, "log", { stream, line }),
    });

    // —— 步骤 2：安装依赖 ——
    publish(t, "status", { status: "running", step: "installing" });
    const deps = version.dependencies ?? [];
    if (deps.length > 0) {
      const args = ["-m", "pip", "install", ...buildPipArgs(deps)];
      await spawnStreaming(venvPython, args, {
        env: { ...process.env, PIP_INDEX_URL: pipIndexUrl },
        timeoutMs,
        onLine: (stream, line) => publish(t, "log", { stream, line }),
      });
    }

    // —— 成功 ——
    await environmentRepo.updateInitializationState(envId, {
      status: "initialized",
      venvPath,
      initializedAt: new Date(),
      lastErrorMessage: null,
    });
    publish(t, "done", { status: "initialized" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await environmentRepo.updateInitializationState(envId, {
      status: "failed",
      lastErrorMessage: message,
    });
    publish(t, "done", { status: "failed", error: message });
  } finally {
    runningEnvIds.delete(envId);
  }
}

/**
 * 触发某运行环境的初始化。
 *
 * - 环境不存在 → 抛 NotFoundError（route 返回 404）
 * - 正在初始化中（内存锁） → 抛 ConflictError（route 返回 409）
 * - 否则置 running、异步执行、立即返回
 */
export async function initializeEnvironment(
  envId: number,
): Promise<{ initializationStatus: InitializationStatus }> {
  const env = await environmentRepo.findById(envId);
  if (!env) {
    const err = new Error("运行环境不存在");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }

  if (runningEnvIds.has(envId)) {
    const err = new Error("该环境正在初始化中");
    (err as Error & { code?: string }).code = "CONFLICT";
    throw err;
  }

  // 加锁、置 running
  runningEnvIds.add(envId);
  await environmentRepo.updateInitializationState(envId, {
    status: "running",
    lastErrorMessage: null,
  });
  publish(topic(envId), "status", { status: "running", step: "starting" });

  // 异步执行，不 await
  setImmediate(() => {
    runInitialization(envId).catch((err) => {
      // runInitialization 内部已捕获所有错误；此处兜底
      console.error(`初始化环境 ${envId} 异常:`, err);
      runningEnvIds.delete(envId);
    });
  });

  return { initializationStatus: "running" };
}
