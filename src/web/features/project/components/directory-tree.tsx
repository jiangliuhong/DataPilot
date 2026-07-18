"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { directoryApi } from "@/web/api-client";
import type { DirectoryTreeNode } from "@/web/types/dbt";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";

interface DirectoryTreeProps {
  projectId: number;
  onSelect?: (dirId: number | null) => void;
  selectedDirId?: number | null;
}

function TreeNode({
  node,
  depth,
  onSelect,
  selectedDirId,
}: {
  node: DirectoryTreeNode;
  depth: number;
  onSelect?: (dirId: number | null) => void;
  selectedDirId?: number | null;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedDirId === node.id;

  return (
    <div>
      <Button
        variant="ghost"
        className={`flex items-center gap-1.5 w-full py-1 px-2 rounded text-sm h-auto font-normal ${
          isSelected ? "bg-default-100 text-foreground font-medium" : "text-default-600"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onPress={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect?.(node.id);
        }}
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
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedDirId={selectedDirId}
          />
        ))}
    </div>
  );
}

export default function DirectoryTree({
  projectId,
  onSelect,
  selectedDirId,
}: DirectoryTreeProps) {
  const [tree, setTree] = useState<DirectoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await directoryApi.getTree(projectId);
        setTree(result);
      } catch {
        // error handled silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-default-400">
        加载中...
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-default-400">
        暂无目录
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <Button
        variant="ghost"
        className={`flex items-center gap-1.5 w-full py-1 px-2 rounded text-sm h-auto font-normal ${
          selectedDirId === null ? "bg-default-100 font-medium" : "text-default-600"
        }`}
        onPress={() => onSelect?.(null)}
      >
        <Folder size={16} className="shrink-0 text-default-400" />
        <span>根目录</span>
      </Button>
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          onSelect={onSelect}
          selectedDirId={selectedDirId}
        />
      ))}
    </div>
  );
}
