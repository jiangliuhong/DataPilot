import JSZip from "jszip";
import { db } from "@/app/db";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import {
  MAX_IMPORT_FILE_SIZE,
  SKIP_IMPORT_FILES,
} from "@/app/server/configs/dbt/constants";

/** 导入结果 */
export interface ImportResult {
  directories: number;
  files: number;
}

/** 导入 ZIP 到项目 */
export async function importProject(projectId: number, zipBuffer: Buffer): Promise<ImportResult> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error("Project not found");

  // 校验文件大小
  if (zipBuffer.length > MAX_IMPORT_FILE_SIZE) {
    throw new Error("File size exceeds limit (50MB)");
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const result: ImportResult = { directories: 0, files: 0 };

  // 收集所有目录路径和文件
  const dirPaths = new Set<string>();
  const fileEntries: { path: string; content: string }[] = [];

  // 跳过的文件名集合
  const skipSet = new Set<string>(SKIP_IMPORT_FILES);

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    // 跳过隐藏文件和 mac 元数据
    if (relativePath.startsWith("__MACOSX") || relativePath.startsWith(".")) continue;

    if (zipEntry.dir) {
      // 目录条目（去除末尾斜杠）
      const cleanPath = relativePath.replace(/\/$/, "");
      if (cleanPath) dirPaths.add(cleanPath);
    } else {
      // 跳过系统级配置文件
      const fileName = relativePath.split("/").pop() ?? "";
      if (skipSet.has(fileName)) continue;

      const content = await zipEntry.async("string");
      fileEntries.push({ path: relativePath, content });
    }
  }

  // 事务中执行导入
  await db.transaction(async () => {
    // 按路径深度排序，确保父目录先创建
    const sortedDirs = Array.from(dirPaths).sort(
      (a, b) => a.split("/").length - b.split("/").length,
    );

    // 创建目录
    for (const dirPath of sortedDirs) {
      const segments = dirPath.split("/");
      const name = segments[segments.length - 1];
      const parentSegments = segments.slice(0, -1);
      const depth = parentSegments.length;
      const parentId: number | null = null; // 先不关联 parentId，后续通过 path 查找

      // 查找父目录 ID
      let resolvedParentId: number | null = null;
      if (parentSegments.length > 0) {
        const parentPath = parentSegments.join("/");
        const parentDirs = await directoryRepo.findByPathPrefix(projectId, parentPath);
        const parent = parentDirs.find((d) => d.path === parentPath);
        if (parent) resolvedParentId = parent.id;
      }

      await directoryRepo.create({
        projectId,
        parentId: resolvedParentId,
        name,
        path: dirPath,
        depth,
      });
      result.directories++;
    }

    // 创建文件
    for (const fileEntry of fileEntries) {
      const segments = fileEntry.path.split("/");
      const fileName = segments[segments.length - 1];
      const dirSegments = segments.slice(0, -1);

      // 查找所属目录
      let directoryId: number | null = null;
      if (dirSegments.length > 0) {
        const dirPath = dirSegments.join("/");
        const dirs = await directoryRepo.findByPathPrefix(projectId, dirPath);
        const dir = dirs.find((d) => d.path === dirPath);
        if (dir) directoryId = dir.id;
      }

      // 检测文件类型
      const dotIndex = fileName.lastIndexOf(".");
      const ext = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : "txt";
      const fileType = ext === "yaml" ? "yml" : ext;

      await fileRepo.create({
        projectId,
        directoryId,
        name: fileName,
        path: fileEntry.path,
        content: fileEntry.content,
        fileType,
        size: Buffer.byteLength(fileEntry.content, "utf-8"),
      });
      result.files++;
    }
  });

  return result;
}

/** 导出项目为 ZIP */
export async function exportProject(projectId: number): Promise<Buffer> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error("Project not found");

  const directories = await directoryRepo.findByProjectId(projectId);
  const files = await fileRepo.findAllByProjectId(projectId);

  const zip = new JSZip();

  // 创建空目录结构
  for (const dir of directories) {
    zip.folder(dir.path);
  }

  // 写入文件
  for (const file of files) {
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
