"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";
import { projectApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";

interface ImportExportProps {
  projectId: number;
}

export default function ImportExport({ projectId }: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      showError(new Error("仅支持 ZIP 格式文件"));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showError(new Error("文件大小超过限制 (50MB)"));
      return;
    }

    setImporting(true);
    try {
      const result = await projectApi.importProject(projectId, file);
      showSuccess(
        `导入成功：${result.directories} 个目录，${result.files} 个文件`,
      );
    } catch (err) {
      showError(err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await projectApi.exportProject(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_${projectId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("导出成功");
    } catch (err) {
      showError(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleImport}
      />
      <Button
        size="sm"
        variant="ghost"
        onPress={() => fileInputRef.current?.click()}
       
      >
        导入 ZIP
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onPress={handleExport}
       
      >
        导出 ZIP
      </Button>
    </div>
  );
}
