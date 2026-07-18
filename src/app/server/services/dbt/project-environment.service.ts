import * as projectEnvRepo from "@/app/server/repositories/dbt/project-environment.repository";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/app/server/configs/dbt/constants";

/** 查询项目绑定的环境列表 */
export async function listProjectEnvironments(options: {
  projectId: number;
  limit?: number;
  offset?: number;
}) {
  const project = await projectRepo.findById(options.projectId);
  if (!project) {
    throw new Error("项目不存在");
  }

  return projectEnvRepo.findListByProjectId({
    projectId: options.projectId,
    limit: Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    offset: options.offset ?? 0,
  });
}

/** 绑定环境到项目 */
export async function bindEnvironment(data: {
  projectId: number;
  environmentId: number;
  environmentAlias?: string;
}) {
  // 校验项目存在
  const project = await projectRepo.findById(data.projectId);
  if (!project) {
    throw new Error("项目不存在");
  }

  // 校验环境存在
  const environment = await environmentRepo.findById(data.environmentId);
  if (!environment) {
    throw new Error("运行环境不存在");
  }

  // 绑定去重
  const existing = await projectEnvRepo.findBinding(
    data.projectId,
    data.environmentId,
  );
  if (existing) {
    throw new Error("绑定关系已存在");
  }

  return projectEnvRepo.createBinding(data);
}

/** 解绑环境 */
export async function unbindEnvironment(projectId: number, environmentId: number) {
  const binding = await projectEnvRepo.findBinding(projectId, environmentId);
  if (!binding) {
    throw new Error("绑定关系不存在");
  }

  await projectEnvRepo.softDeleteById(binding.id);
  return { success: true };
}
