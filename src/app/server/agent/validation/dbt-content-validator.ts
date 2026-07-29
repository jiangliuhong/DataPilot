/**
 * AI 写入 dbt 文件的内容校验。
 *
 * 见 openspec（harden-dbt-construction-flow / dbt-file-management:
 * "AI-written file content is validated before persistence"）：AI 经
 * DbProjectBackend 写/改文件时，落库前按 dbt 文件类型约定做结构化校验，
 * 失败则把结构化错误回执给 agent 自我修正（不落库、不阻塞在人工审批）。
 *
 * - YAML(.yml/.yaml)：用 yaml 包解析做语法校验 + Zod 校验 dbt schema
 *   结构（models/sources 列表项必须有 name）。
 * - SQL(.sql)：Jinja `{{ }}` / `{% %}` 闭合检查 + 裸表名启发式（提示用 ref()/source()）。
 *
 * 注：此处只覆盖明确错误，不做主观质量判断，避免 agent 反复重写死循环。
 */
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export interface ValidationResult {
  ok: boolean;
  /** 失败原因（可读中文，供 agent 理解并修正） */
  error?: string;
}

/** dbt schema.yml 中单个 model/source 项的最小结构（必须有 name） */
const namedEntrySchema = z.object({
  name: z.string().min(1),
}).passthrough();

/** dbt schema.yml 顶层结构：models / sources 是可选的命名条目列表 */
const dbtSchemaYmlSchema = z.object({
  version: z.optional(z.unknown()),
  models: z.optional(z.array(namedEntrySchema)),
  sources: z.optional(z.array(namedEntrySchema)),
}).passthrough();

/** Jinja 表达式 `{{ ... }}` 与语句 `{% ... %}` 的成对闭合检查 */
function checkJinjaBalance(content: string): string | null {
  const openExpr = (content.match(/{{/g) ?? []).length;
  const closeExpr = (content.match(/}}/g) ?? []).length;
  if (openExpr !== closeExpr) {
    return `Jinja 表达式定界符不配对：{{ 出现 ${openExpr} 次，}} 出现 ${closeExpr} 次`;
  }
  const openStmt = (content.match(/{%/g) ?? []).length;
  const closeStmt = (content.match(/%}/g) ?? []).length;
  if (openStmt !== closeStmt) {
    return `Jinja 语句定界符不配对：{% 出现 ${openStmt} 次，%} 出现 ${closeStmt} 次`;
  }
  return null;
}

/**
 * 启发式检查：在 model 文件中出现「裸 FROM/JOIN <表名>」而非 ref()/source()。
 * 仅作提示性返回（不强制阻断），命中时返回建议信息，否则 null。
 * 这里保守处理：仅当出现 `from <word>.<word>` 或 `join <word>` 且同行无 ref(/source( 时提示。
 */
function checkRawTableReference(content: string): string | null {
  const lines = content.split("\n");
  const hits: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!/(?:from|join)\s+[a-z_][\w]*\.[a-z_][\w]*/.test(lower)) continue;
    if (/ref\(|source\(/.test(lower)) continue;
    hits.push(line.trim());
    if (hits.length >= 3) break;
  }
  if (hits.length === 0) return null;
  return `疑似使用了裸表名而非 ref()/source()，dbt 规范建议用 {{ ref('model') }} 或 {{ source('name','table') }}，示例：\n${hits.join("\n")}`;
}

/** 校验 dbt schema YAML 内容（语法 + models/sources 的 name 必填） */
function validateSchemaYml(content: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    return {
      ok: false,
      error: `YAML 语法错误：${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (parsed === null || parsed === undefined || typeof parsed !== "object") {
    return { ok: false, error: "YAML 顶层必须是一个映射对象（models/sources）" };
  }
  const result = dbtSchemaYmlSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `dbt schema 结构校验失败：${issues}` };
  }
  return { ok: true };
}

/** 校验 dbt_project.yml：必须可解析且含 profile 字段 */
function validateDbtProjectYml(content: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    return {
      ok: false,
      error: `dbt_project.yml 语法错误：${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, error: "dbt_project.yml 顶层必须是一个映射对象" };
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.profile || typeof obj.profile !== "string") {
    return { ok: false, error: "dbt_project.yml 缺少必填的 profile 字段（字符串）" };
  }
  return { ok: true };
}

/**
 * 按路径（DB path，如 "models/staging/orders.sql"）分发校验。
 * 非托管类型（非 sql/yml/yaml）直接放行。
 */
export function validateDbtContent(filePath: string, content: string): ValidationResult {
  const ext = filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();

  if (ext === "yml" || ext === "yaml") {
    const baseName = filePath.split("/").pop() ?? filePath;
    if (baseName === "dbt_project.yml") {
      return validateDbtProjectYml(content);
    }
    return validateSchemaYml(content);
  }

  if (ext === "sql") {
    const jinjaErr = checkJinjaBalance(content);
    if (jinjaErr) return { ok: false, error: jinjaErr };
    // 裸表名检查：dbt model 中 from/join schema.table 应改用 ref()/source()
    const rawRefErr = checkRawTableReference(content);
    if (rawRefErr) return { ok: false, error: rawRefErr };
    return { ok: true };
  }

  return { ok: true };
}
