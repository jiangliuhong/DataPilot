import { createDeepAgent } from "deepagents";
import { MemorySaver } from "@langchain/langgraph";
import type { AgentWorkspace } from "@/app/db/schema";
import { createOpenAILLM } from "./llm/providers/openai";
import { createBackend } from "./backend";
import { buildDomainTools } from "./tools";

/**
 * Agent checkpointer：持久化执行态，HITL resume 必需。
 *
 * 首版用 MemorySaver（进程内）。多实例/生产部署需换持久化 store（如 Redis）。
 * 同一 conversation 的多次 invoke（含 resume）必须命中同一 thread_id，
 * MemorySaver 在单进程内可保证；多进程部署需共享 store。
 *
 * 模块级单例：所有 agent 共享一个 checkpointer，按 thread_id 隔离执行态。
 */
const checkpointer = new MemorySaver();

/**
 * 装配一个绑定到指定 workspace 的 deepagents 实例。
 *
 * - model 传 ChatOpenAI 实例（支持自定义 OPENAI_BASE_URL，兼容国产模型）
 * - backend 按 workspace.type 分发（dbt_project → DbProjectBackend）
 * - permissions 限定虚拟根 /**（backend 已锁 projectId，根即项目根）
 * - interruptOn 拦截写操作，强制人工 approve/edit/reject
 *
 * @param workspace 工作空间（决定 backend 与业务工具集）
 * @param userId    当前用户（业务工具可能用于数据隔离）
 */
export function createProjectAgent(workspace: AgentWorkspace, userId: number) {
  return createDeepAgent({
    // 传实例而非字符串：字符串形式不支持自定义 base_url
    model: createOpenAILLM(),

    // 文件系统：DB 桥接，agent 以本 workspace 关联的项目为根
    backend: createBackend(workspace),

    // 权限：backend 已绑定 projectId，虚拟根即项目根，全放开即可
    permissions: [{ operations: ["read", "write"], paths: ["/**"], mode: "allow" }],

    // 写操作必须人工审批（HITL）
    interruptOn: {
      write_file: {
        allowedDecisions: ["approve", "edit", "reject"],
        description: "创建或覆盖文件，请审查内容后决定",
      },
      edit_file: {
        allowedDecisions: ["approve", "edit", "reject"],
        description: "编辑文件，请审查改动后决定",
      },
    },

    // HITL 必需：持久化执行态以支持 resume
    checkpointer,

    // 系统指令：定义角色 + 工作空间上下文
    systemPrompt: buildSystemPrompt(workspace),

    // 业务工具（文件工具由 deepagents 内置，通过 backend 接管）
    tools: buildDomainTools(workspace, userId),

    // 子 agent：复杂任务可委派，隔离上下文
    subagents: [
      {
        name: "reviewer",
        description: "审查 SQL 质量与 dbt 规范，检查模型定义、引用、命名",
        systemPrompt:
          "你是严格的 dbt 代码审查员。审查 SQL/YAML 的规范性、性能与可维护性，给出具体改进建议。",
      },
    ],
  });
}

/**
 * 按 workspace 类型生成系统提示词。
 */
function buildSystemPrompt(workspace: AgentWorkspace): string {
  const base = `你是 DataPilot 的 AI 工程助手。你可以读写当前工作空间的文件、规划任务、委派子任务。

核心原则：
- 修改文件前先用 read_file / grep 确认现状，不要臆测
- 复杂任务先用 write_todos 拆解步骤
- 写文件（write_file / edit_file）需要用户确认，会在审批后执行
- 一次只做一件事，逐步推进
- 用中文回答`;

  switch (workspace.type) {
    case "dbt_project":
      return `${base}

当前工作空间是一个 dbt 项目（#${workspace.refId} ${workspace.name}）。你正在直接操作该项目的文件树（虚拟根 / 即项目根）。生成的 SQL/YAML 必须符合 dbt 规范：
- 模型用 ref() / source() 引用
- 命名遵循 staging → intermediate → marts 分层
- YAML schema 文件与模型对应`;
    default:
      return base;
  }
}

/** 获取 checkpointer 单例（供 resume 端点复用同一执行态存储） */
export function getCheckpointer() {
  return checkpointer;
}
