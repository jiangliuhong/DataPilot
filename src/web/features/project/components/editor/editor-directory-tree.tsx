"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Modal, useOverlayState } from "@heroui/react";
import { directoryApi, fileApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, FilePlus, FolderPlus, Trash2 } from "lucide-react";
import type { DirectoryTreeNode, ProjectFile } from "@/web/types/dbt";

interface EditorDirectoryTreeProps {
  projectId: number;
  onFileSelect: (file: ProjectFile) => void;
  onFileDelete?: (fileId: number) => void;
}

interface FileItem {
  id: number;
  name: string;
  fileType: string;
}

interface TreeNodeState {
  files: FileItem[];
  expanded: boolean;
  loaded: boolean;
}

interface DeleteConfirm {
  type: "file" | "directory";
  id: number;
  name: string;
}

function collectAllNodeIds(nodes: DirectoryTreeNode[]): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children) {
      ids.push(...collectAllNodeIds(node.children));
    }
  }
  return ids;
}

function buildInitialMap(nodes: DirectoryTreeNode[]): Map<number, TreeNodeState> {
  const map = new Map<number, TreeNodeState>();
  for (const id of collectAllNodeIds(nodes)) {
    map.set(id, { files: [], expanded: false, loaded: false });
  }
  return map;
}

export default function EditorDirectoryTree({
  projectId,
  onFileSelect,
  onFileDelete,
}: EditorDirectoryTreeProps) {
  const [tree, setTree] = useState<DirectoryTreeNode[]>([]);
  const [nodeStates, setNodeStates] = useState<Map<number, TreeNodeState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rootFiles, setRootFiles] = useState<FileItem[]>([]);
  const [treeKey, setTreeKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const deleteModalState = useOverlayState({
    isOpen: !!deleteConfirm,
    onOpenChange: (open) => {
      if (!open) setDeleteConfirm(null);
    },
  });

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const [treeResult, filesResult] = await Promise.all([
        directoryApi.getTree(projectId),
        fileApi.list(projectId, { directoryId: undefined, limit: 100 }),
      ]);
      setTree(treeResult);
      setNodeStates(buildInitialMap(treeResult));
      setRootFiles(
        filesResult.items.map((f) => ({
          id: f.id,
          name: f.name,
          fileType: f.fileType,
        })),
      );
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTree();
  }, [loadTree, treeKey]);

  const refresh = useCallback(() => {
    setTreeKey((k) => k + 1);
  }, []);

  const toggleDir = useCallback(
    async (nodeId: number) => {
      let needsLoad = false;

      setNodeStates((prev) => {
        const next = new Map(prev);
        const state = next.get(nodeId);
        if (!state) return prev;
        needsLoad = !state.loaded;
        next.set(nodeId, { ...state, expanded: !state.expanded });
        return next;
      });

      if (needsLoad) {
        try {
          const result = await fileApi.list(projectId, {
            directoryId: nodeId,
            limit: 100,
          });
          const files = result.items.map((f) => ({
            id: f.id,
            name: f.name,
            fileType: f.fileType,
          }));
          setNodeStates((prev) => {
            const next = new Map(prev);
            const state = next.get(nodeId);
            if (state) {
              next.set(nodeId, { ...state, files, loaded: true });
            }
            return next;
          });
        } catch {
          // handled silently
        }
      }
    },
    [projectId],
  );

  const handleFileClick = useCallback(
    async (fileItem: FileItem) => {
      try {
        const file = await fileApi.get(projectId, fileItem.id);
        onFileSelect(file);
      } catch {
        // handled silently
      }
    },
    [projectId, onFileSelect],
  );

  const handleCreateFile = useCallback(
    async (name: string, directoryId: number | null) => {
      try {
        const file = await fileApi.create(projectId, {
          name,
          content: "",
          directoryId,
        });
        showSuccess("文件创建成功");
        refresh();
        onFileSelect(file);
      } catch (err) {
        showError(err);
      }
    },
    [projectId, onFileSelect, refresh],
  );

  const handleCreateDirectory = useCallback(
    async (name: string, parentId: number | null) => {
      try {
        await directoryApi.create(projectId, { name, parentId });
        showSuccess("目录创建成功");
        refresh();
      } catch (err) {
        showError(err);
      }
    },
    [projectId, refresh],
  );

  const handleDeleteFile = useCallback(
    async (fileId: number) => {
      try {
        await fileApi.delete(projectId, fileId);
        showSuccess("文件删除成功");
        onFileDelete?.(fileId);
        refresh();
      } catch (err) {
        showError(err);
      }
    },
    [projectId, onFileDelete, refresh],
  );

  const confirmDeleteFile = useCallback(
    (file: FileItem) => {
      setDeleteConfirm({ type: "file", id: file.id, name: file.name });
    },
    [],
  );

  const handleDeleteDirectory = useCallback(
    async (dirId: number) => {
      try {
        await directoryApi.delete(projectId, dirId);
        showSuccess("目录删除成功");
        refresh();
      } catch (err) {
        showError(err);
      }
    },
    [projectId, refresh],
  );

  const confirmDeleteDirectory = useCallback(
    (node: DirectoryTreeNode) => {
      setDeleteConfirm({ type: "directory", id: node.id, name: node.name });
    },
    [],
  );

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "file") {
      await handleDeleteFile(deleteConfirm.id);
    } else {
      await handleDeleteDirectory(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const [toolbarInput, setToolbarInput] = useState<"file" | "dir" | null>(null);
  const toolbarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toolbarInput && toolbarInputRef.current) {
      toolbarInputRef.current.focus();
    }
  }, [toolbarInput]);

  const handleToolbarKeyDown = (type: "file" | "dir") => async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    if (e.key === "Enter" && value) {
      if (type === "file") {
        await handleCreateFile(value, null);
      } else {
        await handleCreateDirectory(value, null);
      }
      setToolbarInput(null);
    } else if (e.key === "Escape") {
      setToolbarInput(null);
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-default-400">加载中...</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-default-200 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-auto px-1.5 min-w-0"
          onPress={() => setToolbarInput("file")}
        >
          <FilePlus size={16} className="text-default-500" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-auto px-1.5 min-w-0"
          onPress={() => setToolbarInput("dir")}
        >
          <FolderPlus size={16} className="text-default-500" />
        </Button>
      </div>
      {toolbarInput && (
        <div className="px-2 pt-1.5 pb-0.5">
          <Input
            ref={toolbarInputRef}
            placeholder={toolbarInput === "file" ? "输入文件名，回车创建..." : "输入目录名，回车创建..."}
            onKeyDown={handleToolbarKeyDown(toolbarInput)}
            onBlur={() => setToolbarInput(null)}
            fullWidth
          />
        </div>
      )}
      <div className="overflow-y-auto flex-1 py-2">
        {tree.length === 0 && rootFiles.length === 0 ? (
          <div className="py-4 text-center text-sm text-default-400">暂无文件</div>
        ) : (
          <>
            {rootFiles.map((file) => (
              <FileButton
                key={file.id}
                file={file}
                depth={0}
                onClick={handleFileClick}
                onDelete={confirmDeleteFile}
              />
            ))}
            {tree.map((node) => (
              <DirNode
                key={node.id}
                node={node}
                depth={0}
                nodeStates={nodeStates}
                onToggleDir={toggleDir}
                onFileClick={handleFileClick}
                onCreateFile={handleCreateFile}
                onCreateDirectory={handleCreateDirectory}
                onDeleteFile={confirmDeleteFile}
                onDeleteDirectory={confirmDeleteDirectory}
              />
            ))}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal state={deleteModalState}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <h3 className="text-lg font-semibold">确认删除</h3>
              </Modal.Header>
              <Modal.Body>
                <p className="text-default-600">
                  {deleteConfirm?.type === "directory"
                    ? `确认删除目录 "${deleteConfirm?.name}" 及其所有内容？`
                    : `确认删除文件 "${deleteConfirm?.name}"？`}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteConfirm(null)}>
                  取消
                </Button>
                <Button variant="primary" onPress={handleConfirmDelete}>
                  删除
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function DirNode({
  node,
  depth,
  nodeStates,
  onToggleDir,
  onFileClick,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onDeleteDirectory,
}: {
  node: DirectoryTreeNode;
  depth: number;
  nodeStates: Map<number, TreeNodeState>;
  onToggleDir: (nodeId: number) => void;
  onFileClick: (file: FileItem) => void;
  onCreateFile: (name: string, directoryId: number | null) => void;
  onCreateDirectory: (name: string, parentId: number | null) => void;
  onDeleteFile: (file: FileItem) => void;
  onDeleteDirectory: (node: DirectoryTreeNode) => void;
}) {
  const [showInput, setShowInput] = useState<"file" | "dir" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const state = nodeStates.get(node.id);
  const expanded = state?.expanded ?? false;
  const files = state?.files ?? [];
  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const handleInputSubmit = (type: "file" | "dir") => async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    if (e.key === "Enter" && value) {
      if (type === "file") {
        await onCreateFile(value, node.id);
      } else {
        await onCreateDirectory(value, node.id);
      }
      setShowInput(null);
    } else if (e.key === "Escape") {
      setShowInput(null);
    }
  };

  return (
    <div>
      <div className="flex items-center group">
        <Button
          variant="ghost"
          className="flex items-center justify-start gap-1.5 flex-1 py-1 px-2 rounded text-sm h-auto font-normal text-default-600"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onPress={() => onToggleDir(node.id)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={14} className="shrink-0" />
            ) : (
              <ChevronRight size={14} className="shrink-0" />
            )
          ) : (
            <span className="w-[14px] shrink-0" />
          )}
          {expanded ? (
            <FolderOpen size={16} className="shrink-0 text-warning-500" />
          ) : (
            <Folder size={16} className="shrink-0 text-warning-500" />
          )}
          <span className="truncate">{node.name}</span>
        </Button>
        <div className="hidden group-hover:flex items-center gap-0.5 pr-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-auto px-1 min-w-0 h-6"
            onPress={() => setShowInput("file")}
          >
            <FilePlus size={12} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-auto px-1 min-w-0 h-6"
            onPress={() => setShowInput("dir")}
          >
            <FolderPlus size={12} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-auto px-1 min-w-0 h-6 text-danger-500"
            onPress={() => onDeleteDirectory(node)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
      {expanded && (
        <>
          {showInput && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-0.5 pr-2">
              <Input
                ref={inputRef}
                placeholder={showInput === "file" ? "输入文件名..." : "输入目录名..."}
                onKeyDown={handleInputSubmit(showInput)}
                onBlur={() => setShowInput(null)}
                fullWidth
              />
            </div>
          )}
          {files.map((file) => (
            <FileButton
              key={file.id}
              file={file}
              depth={depth + 1}
              onClick={onFileClick}
              onDelete={onDeleteFile}
            />
          ))}
          {node.children?.map((child) => (
            <DirNode
              key={child.id}
              node={child}
              depth={depth + 1}
              nodeStates={nodeStates}
              onToggleDir={onToggleDir}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onCreateDirectory={onCreateDirectory}
              onDeleteFile={onDeleteFile}
              onDeleteDirectory={onDeleteDirectory}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FileButton({
  file,
  depth,
  onClick,
  onDelete,
}: {
  file: FileItem;
  depth: number;
  onClick: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
}) {
  return (
    <div className="flex items-center group">
      <Button
        variant="ghost"
        className="flex items-center justify-start gap-1.5 flex-1 py-1 px-2 rounded text-sm h-auto font-normal text-default-600"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onPress={() => onClick(file)}
      >
        <span className="w-[14px] shrink-0" />
        <FileText size={16} className="shrink-0 text-primary-400" />
        <span className="truncate">{file.name}</span>
      </Button>
      {onDelete && (
        <div className="hidden group-hover:flex items-center pr-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-auto px-1 min-w-0 h-6 text-danger-500"
            onPress={() => onDelete?.(file)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      )}
    </div>
  );
}
