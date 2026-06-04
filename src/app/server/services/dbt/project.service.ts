import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";

export const createProject = projectRepo.createProject;

export const getProject = projectRepo.findById;

export const listProjects = projectRepo.findList;

export const updateProject = projectRepo.updateById;

/** 软删除项目，级联软删除所有目录和文件 */
export async function deleteProject(id: number) {
  const project = await projectRepo.findById(id);
  if (!project) return null;

  // 级联软删除：目录 → 文件 → 项目
  await fileRepo.softDeleteByProjectId(id);
  await directoryRepo.softDeleteByProjectId(id);
  await projectRepo.softDeleteById(id);

  return project;
}
