import type {
  BackendProtocolV2,
  DeleteResult,
  EditResult,
  GlobResult,
  GrepResult,
  LsResult,
  ReadRawResult,
  ReadResult,
  WriteResult,
  FileInfo,
  GrepMatch,
} from "deepagents";
import micromatch from "micromatch";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import {
  basenameOf,
  dbToVirtualPath,
  inferFileType,
  inferMimeType,
  isRootPath,
  isTextMime,
  toIso,
  virtualToDbPath,
} from "./path-utils";

/**
 * 把单个 dbt project 的 DB 文件树暴露为 deepagents 的虚拟文件系统。
 *
 * - 根 `/` 绑定到单个 projectId（由 backend 工厂按 workspace.type 分发时注入）
 * - 所有 IO 走 repository（DB 为唯一数据源）
 * - 写操作的 filesUpdate 恒为 null：告知 deepagents 已外部持久化，不要回写 LangGraph state
 *
 * 虚拟路径模型：
 *   Agent 视角                  DB path 列
 *   /dbt_project.yml          ↔ dbt_project.yml
 *   /models/staging/          ↔ models/staging   (目录)
 *   /models/staging/orders.sql ↔ models/staging/orders.sql
 */
export class DbProjectBackend implements BackendProtocolV2 {
  constructor(private readonly projectId: number) {}

  // -------------------------------------------------------------------------
  // 读：ls / read / readRaw
  // -------------------------------------------------------------------------

  /** 非递归列出目录内容。目录条目 path 带尾随 /，is_dir=true。 */
  async ls(virtualPath: string): Promise<LsResult> {
    try {
      const dbPath = virtualToDbPath(virtualPath);

      // 根目录：parentId=null；否则查目录 id
      let parentId: number | null = null;
      if (dbPath !== "") {
        const dir = await directoryRepo.findByPath(this.projectId, dbPath);
        if (!dir) {
          return { error: `目录不存在: ${virtualPath}` };
        }
        parentId = dir.id;
      }

      // 子目录与文件分别查询：
      // - 子目录：findByParentId（接受 null 表示根）
      // - 文件：根目录文件 directoryId IS NULL（findAllByProjectId + 内存过滤）；
      //         子目录文件用 findByDirectoryId（精确查 directoryId=parentId）
      const [dirs, files] = await Promise.all([
        directoryRepo.findByParentId(this.projectId, parentId),
        parentId === null
          ? fileRepo
              .findAllByProjectId(this.projectId)
              .then((rows) => rows.filter((f) => f.directoryId === null))
          : fileRepo.findByDirectoryId(parentId),
      ]);

      const entries: FileInfo[] = [
        ...dirs.map((d) => ({
          path: `${dbToVirtualPath(d.path)}/`,
          is_dir: true,
          size: 0,
          modified_at: toIso(d.updatedAt),
        })),
        ...files.map((f) => ({
          path: dbToVirtualPath(f.path),
          is_dir: false,
          size: f.size,
          modified_at: toIso(f.updatedAt),
        })),
      ].sort((a, b) => a.path.localeCompare(b.path));

      return { files: entries };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "ls 失败",
      };
    }
  }

  /** 读文件内容，文本按行分页（与内置 FilesystemBackend 语义一致）。 */
  async read(
    filePath: string,
    offset = 0,
    limit = 500,
  ): Promise<ReadResult> {
    try {
      const dbPath = virtualToDbPath(filePath);
      if (dbPath === "") return { error: "路径是目录" };
      const file = await fileRepo.findByProjectAndPath(this.projectId, dbPath);
      if (!file) return { error: `文件不存在: ${filePath}` };

      const lines = file.content.split("\n");
      const paged = lines.slice(offset, offset + limit).join("\n");
      return {
        content: paged,
        mimeType: inferMimeType(file.name),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "read 失败",
      };
    }
  }

  /** 读原始文件数据（FileDataV2）。 */
  async readRaw(filePath: string): Promise<ReadRawResult> {
    try {
      const dbPath = virtualToDbPath(filePath);
      if (dbPath === "") return { error: "路径是目录" };
      const file = await fileRepo.findByProjectAndPath(this.projectId, dbPath);
      if (!file) return { error: `文件不存在: ${filePath}` };

      return {
        data: {
          content: file.content,
          mimeType: inferMimeType(file.name),
          created_at: toIso(file.createdAt),
          modified_at: toIso(file.updatedAt),
        },
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "readRaw 失败",
      };
    }
  }

  // -------------------------------------------------------------------------
  // 写：write / edit / delete（filesUpdate 恒为 null —— DB 已持久化）
  // -------------------------------------------------------------------------

  /** 创建或覆盖文件（自动 mkdir -p 父目录）。 */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      const dbPath = virtualToDbPath(filePath);
      if (dbPath === "") return { error: "路径是目录，无法写入文件" };

      const file = await fileRepo.upsertByPath({
        projectId: this.projectId,
        path: dbPath,
        content,
        fileType: inferFileType(dbPath),
      });

      return {
        path: dbToVirtualPath(file?.path ?? dbPath),
        filesUpdate: null, // ★ 外部（DB）已持久化
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "write 失败",
      };
    }
  }

  /**
   * 精确字符串替换（exact-string-replace）。
   *
   * 语义与 deepagents 内置 performStringReplacement 一致：
   *   - oldString 必须唯一匹配，否则报错（除非 replaceAll=true）
   *   - 0 次匹配 → error
   *   - 空文件 + 空 oldString → 写入 newString（occurrences=0）
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll = false,
  ): Promise<EditResult> {
    try {
      const dbPath = virtualToDbPath(filePath);
      if (dbPath === "") return { error: "路径是目录" };

      const file = await fileRepo.findByProjectAndPath(this.projectId, dbPath);
      if (!file) return { error: `文件不存在: ${filePath}` };

      const content = file.content;

      // 空文件 + 空 oldString → 初始化内容
      if (content === "" && oldString === "") {
        await fileRepo.updateByPath(this.projectId, dbPath, newString);
        return { path: dbToVirtualPath(dbPath), occurrences: 0, filesUpdate: null };
      }

      if (oldString === "") {
        return { error: "oldString 不能为空（文件非空）" };
      }

      const occurrences = countOccurrences(content, oldString);
      if (occurrences === 0) {
        return { error: `未找到匹配字符串: ${oldString.slice(0, 60)}` };
      }
      if (occurrences > 1 && !replaceAll) {
        return {
          error: `找到 ${occurrences} 处匹配，请提供更多上下文或使用 replace_all`,
        };
      }

      const updated = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      await fileRepo.updateByPath(this.projectId, dbPath, updated);
      return {
        path: dbToVirtualPath(dbPath),
        occurrences: replaceAll ? occurrences : 1,
        filesUpdate: null, // ★ DB 已持久化
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "edit 失败",
      };
    }
  }

  /** 软删除文件（设 deletedAt，符合 AGENTS.md 软删除规则）。 */
  async delete(filePath: string): Promise<DeleteResult> {
    try {
      const dbPath = virtualToDbPath(filePath);
      if (dbPath === "") return { error: "路径是目录，delete 仅支持文件" };
      const file = await fileRepo.findByProjectAndPath(this.projectId, dbPath);
      if (!file) return { error: `文件不存在: ${filePath}` };

      await fileRepo.softDeleteById(file.id);
      return { path: dbToVirtualPath(dbPath) };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "delete 失败",
      };
    }
  }

  // -------------------------------------------------------------------------
  // 搜索：glob / grep
  // -------------------------------------------------------------------------

  /** 按 glob 模式匹配文件（仅文件，不含目录）。 */
  async glob(pattern: string, basePath = "/"): Promise<GlobResult> {
    try {
      const baseDbPath = virtualToDbPath(basePath);
      const all = await fileRepo.findAllByProjectId(this.projectId);

      const files: FileInfo[] = all
        .filter((f) => {
          // 限定在 basePath 下
          if (baseDbPath !== "" && !f.path.startsWith(`${baseDbPath}/`)) {
            return false;
          }
          // micromatch 对相对路径匹配（去掉 base 前缀，让 **/*.sql 能匹配子目录）
          const relPath =
            baseDbPath === "" ? f.path : f.path.slice(baseDbPath.length + 1);
          return micromatch.isMatch(relPath, pattern, { dot: true });
        })
        .map((f) => ({
          path: dbToVirtualPath(f.path),
          is_dir: false,
          size: f.size,
          modified_at: toIso(f.updatedAt),
        }));

      return { files };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "glob 失败",
      };
    }
  }

  /** 字面量文本搜索（与内置 ripgrep -F 语义一致）。跳过二进制文件。 */
  async grep(
    pattern: string,
    basePath = "/",
    glob = null,
  ): Promise<GrepResult> {
    try {
      const baseDbPath = virtualToDbPath(basePath);
      const all = await fileRepo.findAllByProjectId(this.projectId);

      const matches: GrepMatch[] = [];
      for (const f of all) {
        // 限定在 basePath 下
        if (baseDbPath !== "" && !f.path.startsWith(`${baseDbPath}/`)) {
          continue;
        }
        // glob 过滤（按文件 basename 或相对路径）
        if (glob) {
          const relPath =
            baseDbPath === "" ? f.path : f.path.slice(baseDbPath.length + 1);
          if (!micromatch.isMatch(relPath, glob, { dot: true })) continue;
        }
        // 跳过二进制
        if (!isTextMime(inferMimeType(f.name))) continue;

        // 字面量逐行匹配（pattern 非空时）
        if (!pattern) continue;
        const lines = f.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(pattern)) {
            matches.push({
              path: dbToVirtualPath(f.path),
              line: i + 1, // 1-indexed
              text: lines[i],
            });
          }
        }
      }

      return { matches };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "grep 失败",
      };
    }
  }
}

/** 统计子串出现次数（字面量） */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}
