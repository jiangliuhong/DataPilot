import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";

export const createVersion = versionRepo.createVersion;
export const getVersion = versionRepo.findById;
export const listVersions = versionRepo.findList;
export const updateVersion = versionRepo.updateById;

/** 删除版本（含引用检查） */
export async function deleteVersion(id: number) {
  const version = await versionRepo.findById(id);
  if (!version) return null;

  const hasRef = await environmentRepo.existsByVersionId(id);
  if (hasRef) {
    throw new Error("该版本已被运行环境引用，无法删除");
  }

  await versionRepo.softDeleteById(id);
  return version;
}
