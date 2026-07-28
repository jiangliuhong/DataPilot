"use client";

import { Users, Loader2, CheckCircle2 } from "lucide-react";
import type { SubagentState } from "../hooks/use-agent-chat";

/** 子 agent 委派区段（折叠展示子 agent 的工作状态） */
export default function SubagentPanel({
  subagents,
}: {
  subagents: SubagentState[];
}) {
  if (!subagents || subagents.length === 0) return null;

  return (
    <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <Users size={14} className="text-secondary-500" />
        <span className="font-medium text-default-700">子任务委派</span>
      </div>
      <ul className="space-y-1.5">
        {subagents.map((sa, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {sa.status === "done" ? (
              <CheckCircle2 size={14} className="shrink-0 text-success-500" />
            ) : (
              <Loader2 size={14} className="shrink-0 animate-spin text-primary-500" />
            )}
            <span className="text-default-700">{sa.name}</span>
            <span className="text-default-400">
              {sa.status === "done" ? "已完成" : "执行中…"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
