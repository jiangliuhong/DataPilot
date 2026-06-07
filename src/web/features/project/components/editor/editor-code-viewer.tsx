"use client";

import dynamic from "next/dynamic";
import type { EditorTab } from "../../hooks/use-editor-state";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-default-400">
      加载编辑器...
    </div>
  ),
});

const LANGUAGE_MAP: Record<string, string> = {
  sql: "sql",
  yml: "yaml",
  yaml: "yaml",
  py: "python",
  md: "markdown",
  json: "json",
  csv: "plaintext",
  txt: "plaintext",
};

interface EditorCodeViewerProps {
  tab: EditorTab;
  onChange: (value: string) => void;
}

export default function EditorCodeViewer({ tab, onChange }: EditorCodeViewerProps) {
  const language = LANGUAGE_MAP[tab.fileType] ?? "plaintext";

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={tab.content}
      theme="vs"
      onChange={(value) => onChange(value ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        padding: { top: 8 },
      }}
    />
  );
}
