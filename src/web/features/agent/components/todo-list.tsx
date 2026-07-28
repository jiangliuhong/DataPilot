"use client";

import { ListTodo, Circle, Loader2, CheckCircle2 } from "lucide-react";
import type { AgentTodo } from "@/web/types/agent";

/** 任务清单（deepagents write_todos 的实时投影） */
export default function TodoList({ todos }: { todos: AgentTodo[] }) {
  if (!todos || todos.length === 0) return null;

  return (
    <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <ListTodo size={14} className="text-primary-500" />
        <span className="font-medium text-default-700">任务清单</span>
      </div>
      <ul className="space-y-1.5">
        {todos.map((todo, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <TodoIcon status={todo.status} />
            <span
              className={
                todo.status === "completed"
                  ? "text-default-400 line-through"
                  : "text-default-700"
              }
            >
              {todo.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodoIcon({ status }: { status: AgentTodo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-500" />;
    case "in_progress":
      return (
        <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-primary-500" />
      );
    case "pending":
    default:
      return <Circle size={14} className="mt-0.5 shrink-0 text-default-300" />;
  }
}
