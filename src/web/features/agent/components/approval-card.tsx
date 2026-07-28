"use client";

import { useState } from "react";
import { ShieldAlert, Check, X, ChevronDown } from "lucide-react";
import type { ApprovalInterrupt, ResumeDecision } from "@/web/types/agent";

interface ApprovalCardProps {
  interrupts: ApprovalInterrupt[];
  /** 提交决策（approve/edit/reject），由 useAgentChat.resume 调用 */
  onResolve: (decisions: ResumeDecision[]) => void;
  /** 是否正在提交（resume 请求进行中） */
  resolving?: boolean;
}

/**
 * HITL 写操作审批卡片。
 *
 * Agent 调用 write_file/edit_file 等写工具时，后端 interruptOn 拦截，
 * 前端收到 approval_request 事件后渲染本卡片，暂停流式等待用户决策。
 *
 * 默认展示待审批的工具调用详情（路径、内容预览），三按钮：
 * - 通过：approve
 * - 拒绝：reject（可附说明，agent 会据此调整）
 * - 编辑：edit（暂未实现完整编辑 UI，首版仅 approve/reject）
 */
export default function ApprovalCard({
  interrupts,
  onResolve,
  resolving,
}: ApprovalCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectMsg, setRejectMsg] = useState("");

  if (interrupts.length === 0) return null;

  const handleApprove = () => {
    onResolve(interrupts.map(() => ({ type: "approve" })));
  };

  const handleReject = () => {
    onResolve(
      interrupts.map(() => ({
        type: "reject",
        ...(rejectMsg.trim() ? { message: rejectMsg.trim() } : {}),
      })),
    );
  };

  return (
    <div className="rounded-lg border-2 border-warning-300 bg-warning-50 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert size={16} className="text-warning-600" />
        <span className="font-semibold text-warning-800">
          需要审批的写操作
        </span>
      </div>

      <div className="space-y-2">
        {interrupts.map((iv, idx) => (
          <InterruptDetail key={iv.interruptId || idx} interrupt={iv} />
        ))}
      </div>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="w-full rounded-md border border-default-300 bg-white px-2 py-1.5 text-xs"
            rows={2}
            placeholder="拒绝原因（可选，会反馈给 Agent）"
            value={rejectMsg}
            onChange={(e) => setRejectMsg(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1 text-xs text-default-500 hover:bg-default-100"
              onClick={() => {
                setRejecting(false);
                setRejectMsg("");
              }}
              disabled={resolving}
            >
              取消
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md bg-danger-500 px-3 py-1 text-xs text-white hover:bg-danger-600 disabled:opacity-50"
              onClick={handleReject}
              disabled={resolving}
            >
              <X size={13} />
              确认拒绝
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-danger-300 px-3 py-1 text-xs text-danger-600 hover:bg-danger-50 disabled:opacity-50"
            onClick={() => setRejecting(true)}
            disabled={resolving}
          >
            <X size={13} />
            拒绝
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-success-500 px-3 py-1 text-xs text-white hover:bg-success-600 disabled:opacity-50"
            onClick={handleApprove}
            disabled={resolving}
          >
            <Check size={13} />
            {resolving ? "处理中…" : "通过"}
          </button>
        </div>
      )}
    </div>
  );
}

/** 单个中断详情：工具名 + 路径 + 内容预览（可展开） */
function InterruptDetail({ interrupt }: { interrupt: ApprovalInterrupt }) {
  const [expanded, setExpanded] = useState(false);

  const args = interrupt.args ?? {};
  const filePath =
    (args.file_path as string) || (args.path as string) || "(未知路径)";
  const content =
    (args.content as string) ||
    (args.new_string as string) ||
    "";

  const contentPreview =
    content.length > 300 ? `${content.slice(0, 300)}…` : content;

  return (
    <div className="rounded-md border border-warning-200 bg-white/60 p-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-warning-100 px-1.5 py-0.5 text-xs font-medium text-warning-700">
          {interrupt.actionName}
        </span>
        <code className="flex-1 truncate text-xs text-default-700">
          {filePath}
        </code>
        {content && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-default-400 hover:text-default-600"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {content && expanded && (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-xs">
          {contentPreview}
        </pre>
      )}
    </div>
  );
}
