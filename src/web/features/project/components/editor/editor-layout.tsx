"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { projectApi, fileApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import { useEditorState } from "../../hooks/use-editor-state";
import EditorToolbar from "./editor-toolbar";
import EditorDirectoryTree from "./editor-directory-tree";
import EditorTabs from "./editor-tabs";
import EditorCodeViewer from "./editor-code-viewer";
import type { Project, ProjectFile } from "@/web/types/dbt";

interface EditorLayoutProps {
  projectId: number;
}

export default function EditorLayout({ projectId }: EditorLayoutProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmTab, setConfirmTab] = useState<{
    fileId: number;
    name: string;
  } | null>(null);

  const confirmModalState = useOverlayState({
    isOpen: !!confirmTab,
    onOpenChange: (open) => {
      if (!open) setConfirmTab(null);
    },
  });

  const {
    tabs,
    activeFileId,
    activeTab,
    hasDirty,
    openTab,
    closeTab,
    setActive,
    updateContent,
    markSaved,
  } = useEditorState();

  useEffect(() => {
    const load = async () => {
      try {
        const p = await projectApi.get(projectId);
        setProject(p);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleFileSelect = useCallback(
    (file: ProjectFile) => {
      openTab(file);
    },
    [openTab],
  );

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.dirty) return;
    setSaving(true);
    try {
      await fileApi.update(projectId, activeTab.fileId, {
        content: activeTab.content,
      });
      markSaved(activeTab.fileId);
      showSuccess("保存成功");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }, [activeTab, projectId, markSaved]);

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleCloseTab = useCallback(
    (fileId: number) => {
      const tab = tabs.find((t) => t.fileId === fileId);
      if (tab?.dirty) {
        setConfirmTab({ fileId, name: tab.name });
      } else {
        closeTab(fileId);
      }
    },
    [tabs, closeTab],
  );

  const handleConfirmSave = async () => {
    if (!confirmTab) return;
    const tab = tabs.find((t) => t.fileId === confirmTab.fileId);
    if (tab) {
      try {
        await fileApi.update(projectId, tab.fileId, { content: tab.content });
        markSaved(tab.fileId);
      } catch (err) {
        showError(err);
        setConfirmTab(null);
        return;
      }
    }
    closeTab(confirmTab.fileId);
    setConfirmTab(null);
  };

  const handleConfirmDiscard = () => {
    if (confirmTab) {
      closeTab(confirmTab.fileId);
    }
    setConfirmTab(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-default-400">加载中...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-default-400">项目不存在</p>
        <a href="/" className="text-sm text-primary-500 underline">
          返回 DataPilot
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <EditorToolbar
        projectName={project?.name ?? ""}
        hasDirty={hasDirty}
        saving={saving}
        onSave={handleSave}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: directory tree */}
        <div className="w-[260px] shrink-0 border-r border-default-200 overflow-hidden">
          <EditorDirectoryTree
            projectId={projectId}
            onFileSelect={handleFileSelect}
            onFileDelete={closeTab}
          />
        </div>

        {/* Right panel: tabs + editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs
            tabs={tabs}
            activeFileId={activeFileId}
            onSelect={setActive}
            onClose={handleCloseTab}
          />
          <div className="flex-1 overflow-hidden">
            {activeTab ? (
              <EditorCodeViewer
                tab={activeTab}
                onChange={(value) =>
                  updateContent(activeTab.fileId, value)
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-default-400">
                  从左侧目录树选择文件开始编辑
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close unsaved tab confirmation */}
      <Modal state={confirmModalState}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <h3 className="text-lg font-semibold">未保存的修改</h3>
              </Modal.Header>
              <Modal.Body>
                <p className="text-default-600">
                  文件 &quot;{confirmTab?.name}&quot; 有未保存的修改，是否保存？
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setConfirmTab(null)}>
                  取消
                </Button>
                <Button variant="outline" onPress={handleConfirmDiscard}>
                  不保存
                </Button>
                <Button variant="primary" onPress={handleConfirmSave}>
                  保存
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
