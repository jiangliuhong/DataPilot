import { request, buildQuery } from "./request";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskRun,
  TaskRunStatus,
  TaskCommand,
  RunTaskResult,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

/** 任务列表查询参数 */
export type ListTasksParams = PaginationParams & {
  projectId?: number;
  environmentId?: number;
  command?: TaskCommand;
};

/** 任务运行记录列表查询参数 */
export type ListTaskRunsParams = PaginationParams & {
  status?: TaskRunStatus;
};

export const taskApi = {
  /** 任务列表 */
  list(params?: ListTasksParams) {
    const query: Record<string, string | number | boolean | undefined | null> = {
      limit: params?.limit,
      offset: params?.offset,
      projectId: params?.projectId,
      environmentId: params?.environmentId,
      command: params?.command,
    };
    return request<PaginatedResponse<Task>>(`/tasks${buildQuery(query)}`);
  },

  /** 任务详情 */
  get(id: number) {
    return request<Task>(`/tasks/${id}`);
  },

  /** 创建任务 */
  create(data: CreateTaskInput) {
    return request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** 更新任务 */
  update(id: number, data: UpdateTaskInput) {
    return request<Task>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /** 软删除任务 */
  delete(id: number) {
    return request<{ success: boolean }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  },

  /** 触发任务执行（立即返回 runId，执行异步进行） */
  run(id: number) {
    return request<RunTaskResult>(`/tasks/${id}/run`, {
      method: "POST",
    });
  },

  /** 任务运行记录列表 */
  listRuns(taskId: number, params?: ListTaskRunsParams) {
    const query: Record<string, string | number | boolean | undefined | null> = {
      limit: params?.limit,
      offset: params?.offset,
      status: params?.status,
    };
    return request<PaginatedResponse<TaskRun>>(
      `/tasks/${taskId}/runs${buildQuery(query)}`,
    );
  },

  /** 单条运行记录详情 */
  getRun(runId: number) {
    return request<TaskRun>(`/task-runs/${runId}`);
  },
};
