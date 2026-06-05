import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import * as connectionRepo from "@/app/server/repositories/dbt/connection.repository";
import * as projectEnvRepo from "@/app/server/repositories/dbt/project-environment.repository";

/** 适配器兼容性校验 */
function validateAdapterCompatibility(
  adapterPackages: { name: string; version: string; supportedDatabases: string[] }[],
  databaseType: string,
): void {
  const supported = adapterPackages.some((pkg) =>
    pkg.supportedDatabases.includes(databaseType),
  );
  if (!supported) {
    throw new Error(
      `该版本的适配器包不支持 ${databaseType} 数据库类型`,
    );
  }
}

/** 创建运行环境（含适配器校验） */
export async function createEnvironment(data: {
  name: string;
  versionId: number;
  connectionId: number;
}) {
  // 校验版本存在
  const version = await versionRepo.findById(data.versionId);
  if (!version) {
    throw new Error("版本不存在");
  }

  // 校验连接存在
  const connection = await connectionRepo.findById(data.connectionId);
  if (!connection) {
    throw new Error("数据库连接不存在");
  }

  // 适配器兼容性校验
  validateAdapterCompatibility(
    version.adapterPackages ?? [],
    connection.databaseType,
  );

  return environmentRepo.createEnvironment(data);
}

export const getEnvironment = environmentRepo.findById;
export const listEnvironments = environmentRepo.findList;

/** 更新运行环境（含适配器重校验） */
export async function updateEnvironment(
  id: number,
  data: { name?: string; versionId?: number; connectionId?: number; status?: "active" | "inactive" },
) {
  const environment = await environmentRepo.findById(id);
  if (!environment) return null;

  const newVersionId = data.versionId ?? environment.versionId;
  const newConnectionId = data.connectionId ?? environment.connectionId;

  // 仅当版本或连接发生变化时重新校验
  if (data.versionId || data.connectionId) {
    const version = await versionRepo.findById(newVersionId);
    if (!version) {
      throw new Error("版本不存在");
    }

    const connection = await connectionRepo.findById(newConnectionId);
    if (!connection) {
      throw new Error("数据库连接不存在");
    }

    validateAdapterCompatibility(
      version.adapterPackages ?? [],
      connection.databaseType,
    );
  }

  return environmentRepo.updateById(id, data);
}

/** 删除运行环境（含引用检查） */
export async function deleteEnvironment(id: number) {
  const environment = await environmentRepo.findById(id);
  if (!environment) return null;

  const hasRef = await projectEnvRepo.existsByEnvironmentId(id);
  if (hasRef) {
    throw new Error("该环境已被项目绑定，无法删除");
  }

  await environmentRepo.softDeleteById(id);
  return environment;
}
