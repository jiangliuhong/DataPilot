import { createHmac, timingSafeEqual } from "crypto";

const ALG = "HS256";

/** JWT payload：用户标识 + 过期时间（秒级 Unix 时间戳） */
export interface JwtPayload {
  sub: number; // userId
  username: string;
  exp: number; // 过期时间（秒）
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天

function getSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET 环境变量未设置或长度不足，需至少 32 字符。",
    );
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  );
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/**
 * 签发 HS256 JWT。
 *
 * @param payload 不含 exp 的业务字段
 * @param ttlSeconds 有效期，默认 7 天
 */
export function signToken(
  payload: Pick<JwtPayload, "sub" | "username">,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const header = base64UrlEncode(
    JSON.stringify({ alg: ALG, typ: "JWT" }),
  );
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, exp } satisfies JwtPayload),
  );
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

/**
 * 校验并解析 JWT。
 *
 * 校验项：
 * - 算法必须为 HS256（防 `alg=none` 攻击）
 * - 签名一致（常量时间比较）
 * - 未过期
 *
 * 任意一项不通过均返回 null。
 */
export function verifyToken(token: string | undefined | null): JwtPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  // 1. 校验算法头，拒绝 alg=none 等绕过
  let headerJson: { alg?: string; typ?: string };
  try {
    headerJson = JSON.parse(base64UrlDecode(header).toString("utf8"));
  } catch {
    return null;
  }
  if (headerJson.alg !== ALG) return null;

  // 2. 校验签名（常量时间）
  const expected = sign(`${header}.${body}`);
  let actualBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    actualBuf = base64UrlDecode(signature);
    expectedBuf = base64UrlDecode(expected);
  } catch {
    return null;
  }
  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  // 3. 解析 payload + 校验过期
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}
