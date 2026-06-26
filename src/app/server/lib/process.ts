/**
 * 子进程流式执行封装。
 *
 * 基于 child_process.spawn，逐行收集 stdout/stderr 并通过回调实时推送，
 * 支持超时杀进程与非 0 退出/超时 reject。
 *
 * 用于 venv 初始化过程中执行 `python -m venv` 与 `python -m pip install`，
 * 并把输出实时推送给前端（经事件总线 / WebSocket）。
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export type OutputStream = "stdout" | "stderr";

export interface SpawnStreamingOptions {
  /** 子进程工作目录 */
  cwd?: string;
  /** 额外环境变量（会与 process.env 合并） */
  env?: NodeJS.ProcessEnv;
  /** 超时（毫秒），超时后杀进程并 reject */
  timeoutMs?: number;
  /** 每读到一行输出时回调（区分 stdout/stderr） */
  onLine?: (stream: OutputStream, line: string) => void;
}

export interface SpawnResult {
  /** 子进程退出码 */
  code: number;
}

/**
 * 执行命令并流式收集输出。
 *
 * - 退出码为 0：resolve({ code: 0 })
 * - 退出码非 0：reject，错误信息含最后若干行输出摘要
 * - 超时：杀进程并 reject，错误信息标注超时
 */
export function spawnStreaming(
  command: string,
  args: string[],
  options: SpawnStreamingOptions = {},
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const { cwd, env, timeoutMs, onLine } = options;

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
    });

    // 收集末尾输出，用于失败时的错误摘要
    const tail: string[] = [];
    const MAX_TAIL = 20;

    const handleLine = (stream: OutputStream, line: string) => {
      tail.push(`[${stream}] ${line}`);
      if (tail.length > MAX_TAIL) tail.shift();
      onLine?.(stream, line);
    };

    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on("line", (line) => handleLine("stdout", line));
    }
    if (child.stderr) {
      const rl = createInterface({ input: child.stderr });
      rl.on("line", (line) => handleLine("stderr", line));
    }

    let timedOut = false;
    const timer =
      timeoutMs != null
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, timeoutMs)
        : null;

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`无法启动进程 ${command}: ${err.message}`));
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(
          new Error(
            `进程超时（${timeoutMs}ms）被终止。末尾输出:\n${tail.join("\n")}`,
          ),
        );
        return;
      }
      if (code === 0) {
        resolve({ code });
      } else {
        reject(
          new Error(
            `进程退出码 ${code}。末尾输出:\n${tail.join("\n")}`,
          ),
        );
      }
    });
  });
}
