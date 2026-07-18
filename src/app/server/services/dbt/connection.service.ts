import * as connectionRepo from "@/app/server/repositories/dbt/connection.repository";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import { encrypt } from "@/app/server/lib/crypto";
import type { DbtDatabaseConnection, NewDbtDatabaseConnection } from "@/app/db/schema";

/** 脱敏：移除 encryptedPassword，附加 hasPassword */
function sanitize(
  connection: DbtDatabaseConnection | null,
) {
  if (!connection) return null;
  const { encryptedPassword, ...rest } = connection;
  return {
    ...rest,
    hasPassword: !!encryptedPassword,
  };
}

/** 创建连接的输入类型（用 password 替代 encryptedPassword） */
type CreateConnectionInput = Omit<
  NewDbtDatabaseConnection,
  "encryptedPassword"
> & {
  password: string;
};

/** 创建数据库连接（加密密码） */
export async function createConnection(data: CreateConnectionInput) {
  const { password, ...rest } = data;
  const encryptedPassword = encrypt(password);
  return connectionRepo.createConnection({ ...rest, encryptedPassword });
}

/** 查询连接详情（脱敏） */
export async function getConnection(id: number) {
  const connection = await connectionRepo.findById(id);
  return sanitize(connection);
}

/** 查询连接列表（脱敏） */
export async function listConnections(
  options: Parameters<typeof connectionRepo.findList>[0],
) {
  const result = await connectionRepo.findList(options);
  return {
    ...result,
    items: result.items.map((item) => sanitize(item)) as NonNullable<
      ReturnType<typeof sanitize>
    >[],
  };
}

/** 更新连接的输入类型 */
type UpdateConnectionInput = Omit<
  Parameters<typeof connectionRepo.updateById>[1],
  "encryptedPassword"
> & {
  password?: string;
};

/** 更新连接（含密码重新加密） */
export async function updateConnection(
  id: number,
  data: UpdateConnectionInput,
) {
  const { password, ...rest } = data;

  if (password) {
    const encryptedPassword = encrypt(password);
    return connectionRepo.updateById(id, { ...rest, encryptedPassword });
  }

  return connectionRepo.updateById(id, rest);
}

/** 删除连接（含引用检查） */
export async function deleteConnection(id: number) {
  const connection = await connectionRepo.findById(id);
  if (!connection) return null;

  const hasRef = await environmentRepo.existsByConnectionId(id);
  if (hasRef) {
    throw new Error("该连接已被运行环境引用，无法删除");
  }

  await connectionRepo.softDeleteById(id);
  return sanitize(connection);
}
