import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";

/** 创建文件（自动计算 path、fileType、size） */
export async function createFile(data: {
  projectId: number;
  directoryId?: number | null;
  name: string;
  content: string;
  fileType: string;
}) {
  // 计算 path
  let path: string;
  if (data.directoryId) {
    const dir = await directoryRepo.findById(data.directoryId);
    if (!dir) throw new Error("Directory not found");
    path = `${dir.path}/${data.name}`;
  } else {
    path = data.name;
  }

  return fileRepo.create({
    projectId: data.projectId,
    directoryId: data.directoryId ?? null,
    name: data.name,
    path,
    content: data.content,
    fileType: data.fileType,
    size: Buffer.byteLength(data.content, "utf-8"),
  });
}

/** 获取文件详情 */
export const getFile = fileRepo.findById;

/** 文件列表（分页 + 过滤） */
export async function listFiles(options: {
  projectId: number;
  limit: number;
  offset: number;
  fileType?: string;
  directoryId?: number;
}) {
  return fileRepo.findByProjectId(options);
}

/** 更新文件（content/name/directoryId 变更时重新计算 path 和 size） */
export async function updateFile(
  fileId: number,
  data: {
    name?: string;
    content?: string;
    fileType?: string;
    directoryId?: number | null;
  },
) {
  const existing = await fileRepo.findById(fileId);
  if (!existing) throw new Error("File not found");

  const updates: Record<string, unknown> = {};

  // 如果内容变更，重新计算 size
  if (data.content !== undefined) {
    updates.content = data.content;
    updates.size = Buffer.byteLength(data.content, "utf-8");
  }

  // 如果名称或目录变更，重新计算 path
  if (data.name !== undefined || data.directoryId !== undefined) {
    const newName = data.name ?? existing.name;
    const newDirectoryId = data.directoryId !== undefined ? data.directoryId : existing.directoryId;

    let newPath: string;
    if (newDirectoryId) {
      const dir = await directoryRepo.findById(newDirectoryId);
      if (!dir) throw new Error("Target directory not found");
      newPath = `${dir.path}/${newName}`;
    } else {
      newPath = newName;
    }

    updates.name = newName;
    updates.directoryId = newDirectoryId;
    updates.path = newPath;
  }

  if (data.fileType !== undefined) {
    updates.fileType = data.fileType;
  }

  return fileRepo.updateById(fileId, updates);
}

/** 删除文件 */
export async function deleteFile(fileId: number) {
  const file = await fileRepo.findById(fileId);
  if (!file) throw new Error("File not found");
  await fileRepo.softDeleteById(fileId);
  return file;
}
