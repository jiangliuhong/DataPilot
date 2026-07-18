"use client";

import { useState } from "react";
import { Wrench, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import type { ToolCallState } from "../hooks/use-agent-chat";

const OUTPUT_PREVIEW_LENGTH = 500;

/** 工具调用步骤卡片（工具名、入参折叠、进行中/完成状态、结果摘要展开） */
export default function ToolCallCard({ toolCall }: { toolCall: ToolCallState }) {
  const [expanded, setExpanded] = useState(false);
  const done = toolCall.status === "done";

  const inputStr = JSON.stringify(toolCall.input, null, 2);
  const outputStr =
    toolCall.output !== undefined ? JSON.stringify(toolCall.output, null, 2) : "";
  const outputPreview =
    outputStr.length > OUTPUT_PREVIEW_LENGTH
      ? `${outputStr.slice(0, OUTPUT_PREVIEW_LENGTH)}…`
      : outputStr;

  return (
    <div className="rounded-lg border border-default-200 bg-default-50 text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {done ? (
          <CheckCircle2 size={14} className="text-success-500 shrink-0" />
        ) : (
          <Loader2 size={14} className="text-primary-500 shrink-0 animate-spin" />
        )}
        <Wrench size={13} className="text-default-400 shrink-0" />
        <span className="font-medium">{toolCall.name}</span>
        <span className="text-default-400">
          {done ? "已完成" : "调用中…"}
        </span>
        <ChevronDown
          size={14}
          className={`ml-auto text-default-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-default-200 px-3 py-2">
          <div>
            <p className="mb-1 text-xs text-default-400">入参</p>
            <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
              {inputStr}
            </pre>
          </div>
          {done && (
            <div>
              <p className="mb-1 text-xs text-default-400">返回结果</p>
              <pre className="max-h-60 overflow-auto rounded bg-white p-2 text-xs">
                {outputPreview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
