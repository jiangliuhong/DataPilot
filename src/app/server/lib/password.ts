import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
// scrypt 参数（Node 推荐量级，内存困难型）
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

/**
 * 将明文密码哈希为可存储的字符串。
 *
 * 格式：`saltHex:hashHex`，salt 为随机 16 字节，hash 由 scrypt 生成。
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(plain, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * 校验明文密码是否匹配已存储的哈希。
 *
 * 使用 `timingSafeEqual` 做常量时间比较，避免时序侧信道。
 * 存储格式非法时直接返回 false。
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
