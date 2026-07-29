/**
 * dbt parse 预检。
 *
 * 见 openspec（harden-dbt-construction-flow / dbt-construction-validation:
 * "dbt parse pre-check before task run"）：在真正执行 dbt 命令前，
 * 对已物化的工作区跑一次 `dbt parse`（秒级），把 SQL/YAML/ref 语法错误前置。
 * parse 失败则抛错（由调用方将 run 置为 failed），避免浪费完整 run 的资源。
 *
 * 复用 task-execution 的 spawnStreaming 与 venv，不引入额外 IO。
 */
import path from "node:path";
import { spawnStreaming } from "@/app/server/lib/process";
import { getVenvBinDir } from "@/app/server/configs/dbt/constants";

/** parse 预检默认超时（毫秒），3 分钟。parse 通常秒级，留足裕量。 */
const DEFAULT_PARSE_TIMEOUT_MS = 3 * 60 * 1000;

export interface ParseResult {
  ok: boolean;
  /** parse 进程退出码（失败时也可能有） */
  exitCode?: number;
  /** 失败原因（含 dbt 末尾输出摘要），成功时为 undefined */
  error?: string;
}

/**
 * 对已物化的工作区执行 `dbt parse`。
 *
 * @param venvPath 运行环境的 venv 根路径
 * @param workspaceDir 已物化的运行工作区（含 dbt_project.yml / profiles.yml）
 * @returns parse 结果；失败时 ok=false 且 error 携带 dbt 输出摘要
 */
export async function parseProject(
  venvPath: string,
  workspaceDir: string,
): Promise<ParseResult> {
  const command = path.join(venvPath, getVenvBinDir(), "dbt");
  // 把 venv 的 bin 目录注入 PATH，确保 dbt 能找到 python 解释器
  const venvBin = path.dirname(command);
  const childEnv = {
    ...process.env,
    PATH: `${venvBin}:${process.env.PATH ?? ""}`,
  };

  try {
    await spawnStreaming(
      command,
      ["parse", "--profiles-dir", workspaceDir, "--project-dir", workspaceDir, "--no-use-colors"],
      {
        cwd: workspaceDir,
        env: childEnv,
        timeoutMs: DEFAULT_PARSE_TIMEOUT_MS,
      },
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `dbt parse 失败：${message}` };
  }
}
