import { db } from "@/app/db";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";

/** 目录树节点类型 */
export interface DirectoryTreeNode {
  id: number;
  name: string;
  path: string;
  children: DirectoryTreeNode[];
}

/** 创建目录（自动计算 path 和 depth） */
export async function createDirectory(data: {
  projectId: number;
  name: string;
  parentId?: number | null;
}) {
  // 检查同父目录下是否存在同名目录
  const parentId = data.parentId ?? null;
  const exists = await directoryRepo.existsByName(data.projectId, data.name, parentId);
  if (exists) {
    throw new Error("Directory already exists in this location");
  }

  let path: string;
  let depth: number;

  if (data.parentId) {
    const parent = await directoryRepo.findById(data.parentId);
    if (!parent) {
      throw new Error("Parent directory not found");
    }
    path = `${parent.path}/${data.name}`;
    depth = parent.depth + 1;
  } else {
    path = data.name;
    depth = 0;
  }

  return directoryRepo.create({
    projectId: data.projectId,
    parentId: data.parentId ?? null,
    name: data.name,
    path,
    depth,
  });
}

/** 列出项目目录 */
export const listDirectories = directoryRepo.findByProjectId;

/** 列出指定父目录下的子目录 */
export const listDirectoriesByParent = directoryRepo.findByParentId;

/** 构建完整目录树 */
export async function getDirectoryTree(projectId: number): Promise<DirectoryTreeNode[]> {
  const allDirs = await directoryRepo.findByProjectId(projectId);

  const nodeMap = new Map<number, DirectoryTreeNode>();
  const roots: DirectoryTreeNode[] = [];

  // 先创建所有节点
  for (const dir of allDirs) {
    nodeMap.set(dir.id, { id: dir.id, name: dir.name, path: dir.path, children: [] });
  }

  // 构建树形关系
  for (const dir of allDirs) {
    const node = nodeMap.get(dir.id)!;
    if (dir.parentId && nodeMap.has(dir.parentId)) {
      nodeMap.get(dir.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** 重命名目录（级联更新 path） */
export async function renameDirectory(
  projectId: number,
  directoryId: number,
  newName: string,
) {
  const dir = await directoryRepo.findById(directoryId);
  if (!dir) throw new Error("Directory not found");

  const oldPath = dir.path;
  const parentPath = dir.parentId
    ? (await directoryRepo.findById(dir.parentId))?.path
    : null;
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  // 事务中更新当前目录和所有子目录/文件的 path
  await db.transaction(async () => {
    await directoryRepo.updateById(directoryId, { name: newName, path: newPath });

    // 级联更新子目录 path
    const descendants = await directoryRepo.findByPathPrefix(projectId, `${oldPath}/`);
    for (const child of descendants) {
      const childNewPath = newPath + child.path.slice(oldPath.length);
      await directoryRepo.updateById(child.id, { path: childNewPath });
    }

    // 级联更新子目录下文件的 path（通过 path 前缀匹配）
    const filesToUpdate = await fileRepo.findAllByProjectId(projectId);
    for (const file of filesToUpdate) {
      if (file.path.startsWith(`${oldPath}/`)) {
        const fileNewPath = newPath + file.path.slice(oldPath.length);
        await fileRepo.updateById(file.id, { path: fileNewPath });
      }
    }
  });

  return directoryRepo.findById(directoryId);
}

/** 移动目录（含循环检测） */
export async function moveDirectory(
  projectId: number,
  directoryId: number,
  newParentId: number | null,
) {
  // 循环检测：不能移动到自身或后代
  if (newParentId) {
    if (newParentId === directoryId) {
      throw new Error("Cannot move directory to itself");
    }
    // 检查 newParentId 是否是 directoryId 的后代
    const descendants = await directoryRepo.findByPathPrefix(projectId, `${(await directoryRepo.findById(directoryId))!.path}/`);
    const descendantIds = new Set(descendants.map((d) => d.id));
    if (descendantIds.has(newParentId)) {
      throw new Error("Cannot move directory to itself or its descendant");
    }
  }

  const dir = await directoryRepo.findById(directoryId);
  if (!dir) throw new Error("Directory not found");

  const oldPath = dir.path;
  let newPath: string;
  let newDepth: number;

  if (newParentId) {
    const newParent = await directoryRepo.findById(newParentId);
    if (!newParent) throw new Error("Target parent directory not found");
    newPath = `${newParent.path}/${dir.name}`;
    newDepth = newParent.depth + 1;
  } else {
    newPath = dir.name;
    newDepth = 0;
  }

  await db.transaction(async () => {
    await directoryRepo.updateById(directoryId, {
      parentId: newParentId,
      path: newPath,
      depth: newDepth,
    });

    // 级联更新子目录
    const descendants = await directoryRepo.findByPathPrefix(projectId, `${oldPath}/`);
    for (const child of descendants) {
      const childNewPath = newPath + child.path.slice(oldPath.length);
      const depthDiff = newDepth - dir.depth;
      await directoryRepo.updateById(child.id, {
        path: childNewPath,
        depth: child.depth + depthDiff,
      });
    }

    // 级联更新文件 path
    const filesToUpdate = await fileRepo.findAllByProjectId(projectId);
    for (const file of filesToUpdate) {
      if (file.path.startsWith(`${oldPath}/`)) {
        const fileNewPath = newPath + file.path.slice(oldPath.length);
        await fileRepo.updateById(file.id, { path: fileNewPath });
      }
    }
  });

  return directoryRepo.findById(directoryId);
}

/** 删除目录（级联递归软删除子目录和文件） */
export async function deleteDirectory(projectId: number, directoryId: number) {
  const dir = await directoryRepo.findById(directoryId);
  if (!dir) throw new Error("Directory not found");

  await db.transaction(async () => {
    // 软删除该目录及所有子目录
    await directoryRepo.softDeleteByPathPrefix(projectId, dir.path);
    await directoryRepo.softDeleteById(directoryId);

    // 软删除该目录及子目录下的所有文件
    await fileRepo.softDeleteByPathPrefix(projectId, `${dir.path}/`);
  });
}
