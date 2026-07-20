/** dbt 域业务常量配置 */

import { execFileSync } from "node:child_process";
import path from "node:path";

/** ZIP 导入文件大小上限（字节），默认 50MB */
export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024;

/** 支持的文件扩展名列表 */
export const SUPPORTED_FILE_TYPES = [
  "sql",
  "yml",
  "yaml",
  "md",
  "py",
  "csv",
  "json",
  "txt",
] as const;

/** 导入时跳过的系统级配置文件 */
export const SKIP_IMPORT_FILES = [
  "dbt_project.yml",
  "packages.yml",
] as const;

/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
export const MAX_PAGE_SIZE = 100;

/** 数据库类型到 dbt 适配器包名的静态映射表 */
export const DB_TYPE_ADAPTER_MAP = {
  mysql5: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  mysql8: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  starrocks: { adapterPackage: "dbt-starrocks", minAdapterVersion: "1.0.0" },
  postgresql: { adapterPackage: "dbt-postgres", minAdapterVersion: "1.0.0" },
} as const;

/** 支持的数据库类型列表 */
export const SUPPORTED_DATABASE_TYPES = Object.keys(DB_TYPE_ADAPTER_MAP) as (
  | keyof typeof DB_TYPE_ADAPTER_MAP
)[];

// ===== 运行环境 venv 初始化相关配置 =====

/** pip 安装默认超时时间（毫秒），默认 10 分钟 */
export const DEFAULT_INIT_TIMEOUT_MS = 600_000;

/** 默认 pip 镜像源（清华 TUNA，加速国内安装） */
export const DEFAULT_PIP_INDEX_URL = "https://pypi.tuna.tsinghua.edu.cn/simple";

/**
 * 解析 venv 根目录。
 * 优先读取 DBT_VENV_ROOT 环境变量，未设置时默认使用进程当前工作目录下的 venvs/。
 * 返回绝对路径。
 */
export function getVenvRoot(): string {
  const configured = process.env.DBT_VENV_ROOT;
  return path.resolve(configured || path.join(process.cwd(), "venvs"));
}

/**
 * 解析任务运行工作区根目录。
 * 优先读取 DBT_TASK_WORKSPACE_ROOT 环境变量，未设置时默认使用进程当前工作目录下的 task-workspaces/。
 * 每次任务运行会在该目录下按 `<projectId>/<runId>/` 隔离实例化。
 * 返回绝对路径。
 */
export function getTaskWorkspaceRoot(): string {
  const configured = process.env.DBT_TASK_WORKSPACE_ROOT;
  return path.resolve(configured || path.join(process.cwd(), "task-workspaces"));
}

/**
 * 读取 pip 镜像源。
 * 优先读取 DBT_PIP_INDEX_URL 环境变量，未设置时使用默认清华 TUNA 镜像。
 */
export function getPipIndexUrl(): string {
  return process.env.DBT_PIP_INDEX_URL || DEFAULT_PIP_INDEX_URL;
}

/** 检测给定可执行文件在 PATH 中是否存在 */
function isExecutableAvailable(cmd: string): boolean {
  try {
    execFileSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析创建虚拟环境所用的 Python 解释器。
 * 顺序：DBT_PYTHON_BIN 环境变量 → python3 → python。
 */
export function resolvePythonBin(): string {
  const configured = process.env.DBT_PYTHON_BIN;
  if (configured) return configured;
  if (isExecutableAvailable("python3")) return "python3";
  if (isExecutableAvailable("python")) return "python";
  throw new Error(
    "未找到可用的 Python 解释器，请通过 DBT_PYTHON_BIN 环境变量指定",
  );
}

/**
 * 根据平台返回 venv 内可执行文件的相对目录。
 * Linux/macOS 为 bin，Windows 为 Scripts。
 */
export function getVenvBinDir(): string {
  return process.platform === "win32" ? "Scripts" : "bin";
}
