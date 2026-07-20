/**
 * 任务运行工作区实例化与 dbt profile 生成。
 *
 * 见 design.md D3 / D3.1 / D8：
 *   - 每次运行从 DB 全量导出项目文件到 <workspaceRoot>/<projectId>/<runId>/
 *   - 生成单 target `default` 的 profiles.yml，连接字段来自 task.environment.connection
 *   - profile 名 = 项目名 slug 化
 *   - 运行结束由 task-execution.service 在 finally 中清理
 *
 * 安全加固（review round 1 修复）：
 *   - 文件路径做 containment 校验，防止 file.path 含 ../ 越界（W3）
 *   - extraConfig 键做白名单 + deny-list，防止覆盖 type/host/password（W4）
 *   - decrypt 失败抛友好错误信息（W5）
 *   - 工作区目录与敏感文件使用 0700/0600 权限（W9）
 *   - materializeWorkspace 内部 try/catch，失败时清理已建目录（C4）
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { DbtDatabaseConnection } from "@/app/db/schema";
import { getTaskWorkspaceRoot, DB_TYPE_ADAPTER_MAP } from "@/app/server/configs/dbt/constants";
import { decrypt } from "@/app/server/lib/crypto";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";

/** 工作区目录权限（仅属主可读写执行） */
const WORKSPACE_DIR_MODE = 0o700;
/** profiles.yml 文件权限（仅属主可读写，含明文密码） */
const PROFILE_FILE_MODE = 0o600;

/**
 * extraConfig 允许的键白名单（dbt adapter 通用可选参数）。
 * 安全敏感键（type/host/port/user/password/dbname/schema）由显式字段写入，
 * extraConfig 不得覆盖它们。
 */
const EXTRA_CONFIG_ALLOWED_KEYS = new Set([
  "threads",
  "ssl",
  "sslmode",
  "keepalives_idle",
  "connect_timeout",
  "search_path",
  "role",
  "session_state",
  "use_sidecar_proxy",
]);

/** 项目名 slug 化：小写、非 [a-z0-9_-] 替换为 -、去首尾 -、空回退 datapilot */
export function slugifyProfileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "datapilot";
}

/**
 * 把 databaseType 映射为 dbt profiles.yml 的 `type:` 字段。
 * - postgresql → postgres
 * - mysql5/mysql8 → mysql
 * - starrocks → starrocks
 */
function dbtAdapterType(databaseType: keyof typeof DB_TYPE_ADAPTER_MAP): string {
  switch (databaseType) {
    case "postgresql":
      return "postgres";
    case "mysql5":
    case "mysql8":
      return "mysql";
    case "starrocks":
      return "starrocks";
    default:
      return databaseType;
  }
}

/**
 * connection.schemaName 为空时按 adapter 类型给合理默认。
 */
function defaultSchema(
  databaseType: keyof typeof DB_TYPE_ADAPTER_MAP,
  schemaName: string | null | undefined,
  databaseName: string,
): string {
  if (schemaName) return schemaName;
  switch (databaseType) {
    case "postgresql":
      return "public";
    case "mysql5":
    case "mysql8":
    case "starrocks":
      return databaseName;
    default:
      return schemaName ?? "public";
  }
}

/** 简单 YAML 标量转义：含特殊字符时加引号 */
function yamlScalar(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "~";
  if (typeof value === "string") {
    if (value === "" || /[:#\n\r"'{}\[\],&*?|>!%@`]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  return String(value);
}

/**
 * 解密连接密码，失败时抛出友好错误（而非裸 Node crypto 错误）。
 */
function decryptPassword(encryptedPassword: string): string {
  try {
    return decrypt(encryptedPassword);
  } catch {
    throw new Error(
      "数据库连接密码解密失败，请检查 DBT_ENCRYPTION_KEY 配置或重新录入连接密码",
    );
  }
}

/**
 * 生成单 target `default` 的 profiles.yml 内容（D3.1）。
 *
 * 连接字段来源：task.environment.connection（D8，不引入项目级连接绑定）。
 * password 由 encryptedPassword 解密得到。
 * extraConfig 仅允许白名单键，防止覆盖 type/host/password（W4）。
 */
export function generateProfilesYml(params: {
  projectName: string;
  connection: DbtDatabaseConnection;
}): string {
  const { projectName, connection } = params;
  const profileName = slugifyProfileName(projectName);
  const databaseType = connection.databaseType as keyof typeof DB_TYPE_ADAPTER_MAP;
  const adapterType = dbtAdapterType(databaseType);
  const password = decryptPassword(connection.encryptedPassword);
  const schema = defaultSchema(databaseType, connection.schemaName, connection.databaseName);

  const lines: string[] = [
    `${profileName}:`,
    `  target: default`,
    `  outputs:`,
    `    default:`,
    `      type: ${yamlScalar(adapterType)}`,
    `      host: ${yamlScalar(connection.host)}`,
    `      port: ${connection.port}`,
    `      user: ${yamlScalar(connection.username)}`,
    `      password: ${yamlScalar(password)}`,
    `      dbname: ${yamlScalar(connection.databaseName)}`,
    `      schema: ${yamlScalar(schema)}`,
  ];

  // extraConfig 仅展开白名单键（防止覆盖 type/host/password 等敏感字段）
  if (connection.extraConfig && typeof connection.extraConfig === "object") {
    for (const [k, v] of Object.entries(connection.extraConfig)) {
      if (!EXTRA_CONFIG_ALLOWED_KEYS.has(k)) continue;
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
      lines.push(`      ${k}: ${yamlScalar(v)}`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * 生成最小化 dbt_project.yml，profile 字段与 profiles.yml 的 key 一致。
 * 若项目中已显式管理 dbt_project.yml（在 dbt_files 中存在），调用方应跳过生成。
 */
export function generateDbtProjectYml(params: { projectName: string }): string {
  const { projectName } = params;
  const profileName = slugifyProfileName(projectName);
  return [
    `name: ${yamlScalar(slugifyProfileName(projectName).replace(/-/g, "_"))}`,
    `version: "1.0.0"`,
    `config-version: 2`,
    `profile: ${yamlScalar(profileName)}`,
    `model-paths: ["models"]`,
    `seed-paths: ["seeds"]`,
    `macro-paths: ["macros"]`,
    `target-path: "target"`,
    `clean-targets: ["target", "dbt_packages"]`,
  ].join("\n") + "\n";
}

/**
 * 校验文件路径不会逃出工作区目录（防止 file.path 含 ../ 越界）。
 * 拒绝绝对路径与 .. 上溯。
 */
function assertPathContained(workspaceDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`非法文件路径（绝对路径不允许）: ${relativePath}`);
  }
  const resolved = path.resolve(workspaceDir, relativePath);
  const prefix = workspaceDir.endsWith(path.sep) ? workspaceDir : workspaceDir + path.sep;
  if (resolved !== workspaceDir && !resolved.startsWith(prefix)) {
    throw new Error(`非法文件路径（越出工作区目录）: ${relativePath}`);
  }
  return resolved;
}

/**
 * 实例化运行工作区：导出文件 + 生成配置。返回工作区绝对路径。
 *
 * 内部 try/catch：任何步骤失败时清理已建目录（C4），
 * 避免遗留孤儿目录占磁盘。
 */
export async function materializeWorkspace(params: {
  projectId: number;
  runId: number;
  projectName: string;
  connection: DbtDatabaseConnection;
}): Promise<string> {
  const { projectId, runId, projectName, connection } = params;
  const root = getTaskWorkspaceRoot();
  const workspaceDir = path.join(root, String(projectId), String(runId));

  // 清理可能残留的同名目录（防御性；正常情况下不会发生）
  await fs.rm(workspaceDir, { recursive: true, force: true });
  await fs.mkdir(workspaceDir, { recursive: true, mode: WORKSPACE_DIR_MODE });

  try {
    // 1. 导出所有文件（按 path 相对路径写出，自动创建中间目录）
    //    路径做 containment 校验，防止 file.path 含 ../ 越界（W3）
    const files = await fileRepo.findAllByProjectId(projectId);
    for (const file of files) {
      const filePath = assertPathContained(workspaceDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, "utf8");
    }

    // 2. 生成 profiles.yml（始终生成，单 target）。文件权限 0600（含明文密码，W9）
    const profilesYml = generateProfilesYml({ projectName, connection });
    await fs.writeFile(
      path.join(workspaceDir, "profiles.yml"),
      profilesYml,
      { encoding: "utf8", mode: PROFILE_FILE_MODE },
    );

    // 3. 生成 dbt_project.yml（仅当项目中未显式管理时）
    const hasProjectYml = files.some(
      (f) => f.path === "dbt_project.yml" || f.path === "./dbt_project.yml",
    );
    if (!hasProjectYml) {
      const projectYml = generateDbtProjectYml({ projectName });
      await fs.writeFile(path.join(workspaceDir, "dbt_project.yml"), projectYml, "utf8");
    }

    // 目录数据当前用于校验/未来扩展；这里主动查询一次确保目录树健康（不阻塞）
    await directoryRepo.findByProjectId(projectId);

    return workspaceDir;
  } catch (err) {
    // 任何步骤失败：清理已建目录，避免孤儿（C4）
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    } catch {
      // 清理失败不阻塞原错误抛出
    }
    throw err;
  }
}

/** 清理工作区目录（运行终态后调用）。失败仅记日志，不影响终态落库。 */
export async function cleanupWorkspace(workspaceDir: string): Promise<void> {
  try {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`清理工作区 ${workspaceDir} 失败:`, err);
  }
}
