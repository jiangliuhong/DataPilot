import { ZodError } from "zod";

/** 统一 API 错误响应 */
export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Zod 校验错误中的字段名 → 中文展示名映射。
 * 覆盖本项目所有 schema 用到的字段；未命中的字段原样返回。
 */
const FIELD_LABELS: Record<string, string> = {
  // 通用
  id: "ID",
  name: "名称",
  description: "描述",
  limit: "每页数量",
  offset: "偏移量",
  status: "状态",
  // 任务
  projectId: "项目",
  environmentId: "运行环境",
  command: "命令",
  select: "--select",
  exclude: "--exclude",
  fullRefresh: "--full-refresh",
  vars: "--vars",
  target: "--target",
  scheduleCron: "调度表达式",
  scheduleStatus: "调度状态",
  // 项目环境绑定
  environmentAlias: "环境别名",
  // 数据库连接
  databaseType: "数据库类型",
  host: "主机",
  port: "端口",
  databaseName: "数据库名",
  schemaName: "Schema",
  username: "用户名",
  encryptedPassword: "密码",
  password: "密码",
  extraConfig: "额外配置",
  // 版本
  version: "版本号",
  adapterPackages: "适配器包",
  dependencies: "依赖包",
  supportedDatabases: "支持的数据库",
  // 运行环境
  versionId: "版本",
  connectionId: "数据库连接",
  venvPath: "venv 路径",
  // 运行记录
  taskId: "任务",
  runId: "运行记录",
  exitCode: "退出码",
  errorMessage: "错误信息",
  // 大模型配置
  provider: "协议供应商",
  model: "模型",
  apiKey: "API Key",
  baseUrl: "Base URL",
  temperature: "温度",
  maxTokens: "最大 Tokens",
  topP: "Top P",
  isDefault: "设为生效",
};

/** 把 Zod issue 的英文字段路径翻译成中文标签 */
function localizeFieldPath(path: PropertyKey[]): string {
  if (path.length === 0) return "";
  return path
    .map((seg) => {
      if (typeof seg === "string") return FIELD_LABELS[seg] ?? seg;
      // 数字下标翻译为可读的序号（从 1 开始）
      return `第 ${Number(seg) + 1} 项`;
    })
    .join(".");
}

/**
 * 把 Zod 校验的 issue 消息本地化为中文。
 * 覆盖最常见的 Zod 默认英文文案；未命中的原样返回。
 */
function localizeZodMessage(message: string): string {
  const map: Array<[RegExp, string]> = [
    [/^Invalid input: expected number, received undefined$/,
      "为必填项，且必须是数字"],
    [/^Invalid input: expected string, received undefined$/,
      "为必填项，且必须是文本"],
    [/^Invalid input: expected number.*$/, "必须是数字"],
    [/^Invalid input: expected string.*$/, "必须是文本"],
    [/^Invalid input: expected .*$/, "格式不正确"],
    [/^Invalid enum value.*$/, "取值不合法"],
    [/^Expected .* received undefined$/, "为必填项"],
    [/^Too small: expected .*$/, "数值过小"],
    [/^Too big: expected .*$/, "数值过大"],
    [/^String must contain at least \d+ character\(s\)$/, "长度不足"],
    [/^String must contain at most \d+ character\(s\)$/, "长度超出限制"],
  ];
  for (const [re, replacement] of map) {
    if (re.test(message)) return replacement;
  }
  return message;
}

/** 404 Not Found */
export function notFound(message = "Resource not found") {
  return apiError(message, 404);
}

/** 400 Bad Request */
export function badRequest(message: string) {
  return apiError(message, 400);
}

/** 409 Conflict */
export function conflict(message: string) {
  return apiError(message, 409);
}

/** 413 Payload Too Large */
export function payloadTooLarge(message: string) {
  return apiError(message, 413);
}

/** 500 Internal Server Error */
export function serverError(message = "Internal server error") {
  return apiError(message, 500);
}

/** 处理 Zod 验证错误：字段名翻译为中文，消息本地化 */
export function handleValidationError(error: ZodError) {
  const messages = error.issues.map((i) => {
    const label = localizeFieldPath(i.path);
    const msg = localizeZodMessage(i.message);
    return label ? `${label}${msg}` : msg;
  });
  return apiError(messages.join("; "), 400);
}

/** 安全执行 service 方法，捕获异常并返回统一错误响应 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
): Promise<Response> {
  try {
    const result = await fn();
    if (result === null) {
      return notFound();
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error);
    }
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes("not found") || msg.includes("not Found")) {
        return notFound(msg);
      }
      if (msg.includes("already exists")) {
        return conflict(msg);
      }
      if (msg.includes("exceeds limit")) {
        return payloadTooLarge(msg);
      }
      if (msg.includes("Cannot move")) {
        return badRequest(msg);
      }
      if (msg.includes("Unsupported") || msg.includes("不支持")) {
        return badRequest(msg);
      }
      return badRequest(msg);
    }
    return serverError();
  }
}
