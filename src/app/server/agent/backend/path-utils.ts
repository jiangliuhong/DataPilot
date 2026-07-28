import path from "node:path";

/**
 * 虚拟路径 ↔ DB path 转换 + 文件类型/MIME 推断工具。
 *
 * deepagents 内置 fs 工具传给 backend 的路径是「虚拟绝对路径」
 * （以 / 开头，POSIX 风格，如 `/models/staging/orders.sql`）。
 * 本项目的 DB path 列是「无前导 / 的相对路径」（如 `models/staging/orders.sql`）。
 * 这组函数负责两者之间的无损转换。
 */

/**
 * 虚拟路径 → DB path。
 *
 * `/` → ""（项目根）
 * `/models/staging/` → "models/staging"
 * `/models/staging/orders.sql` → "models/staging/orders.sql"
 */
export function virtualToDbPath(virtualPath: string): string {
  // posix 规范化，去前导 / 与尾随 /
  return path.posix.normalize(virtualPath).replace(/^\/+|\/+$/g, "");
}

/**
 * DB path → 虚拟路径（带前导 /）。
 *
 * "" → "/"
 * "models/staging" → "/models/staging"
 */
export function dbToVirtualPath(dbPath: string): string {
  const normalized = dbPath.replace(/^\/+|\/+$/g, "");
  return normalized === "" ? "/" : `/${normalized}`;
}

/**
 * 判断虚拟路径是否表示项目根。
 */
export function isRootPath(virtualPath: string): boolean {
  return virtualToDbPath(virtualPath) === "";
}

/**
 * 从 DB path 或文件名提取 basename（含扩展名）。
 * "models/staging/orders.sql" → "orders.sql"
 */
export function basenameOf(dbPath: string): string {
  return path.posix.basename(dbPath);
}

/**
 * 按文件扩展名推断 fileType（与 dbt_files.file_type 列语义一致）。
 *
 * 常见 dbt 文件类型：sql / yaml(yml) / md / json / python / csv。
 * 未知扩展名回退为 "text"。
 */
export function inferFileType(filePath: string): string {
  const ext = path.posix.extname(filePath).slice(1).toLowerCase();
  switch (ext) {
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "md":
      return "md";
    case "json":
      return "json";
    case "py":
      return "python";
    case "csv":
      return "csv";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    default:
      return ext || "text";
  }
}

/**
 * 按文件扩展名推断 MIME 类型（deepagents read_file 工具用，影响 multimodal 处理）。
 * 仅区分文本与常见二进制；dbt 项目几乎全是文本文件。
 */
export function inferMimeType(filePath: string): string {
  const ext = path.posix.extname(filePath).slice(1).toLowerCase();
  switch (ext) {
    case "sql":
    case "yml":
    case "yaml":
    case "md":
    case "csv":
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "html":
      return "text/html";
    case "js":
      return "text/javascript";
    case "css":
      return "text/css";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return "text/plain";
  }
}

/** 判断 MIME 是否为文本类型（grep 跳过二进制文件的依据） */
export function isTextMime(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "text/javascript"
  );
}

/** ISO 时间戳格式化（兼容 Date / number / string） */
export function toIso(ts: unknown): string {
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === "number" || typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
}
