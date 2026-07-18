"use client";

import { use } from "react";
import EditorLayout from "@/web/features/project/components/editor/editor-layout";

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);

  if (isNaN(projectId)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-default-400">无效的项目 ID</p>
      </div>
    );
  }

  return <EditorLayout projectId={projectId} />;
}
