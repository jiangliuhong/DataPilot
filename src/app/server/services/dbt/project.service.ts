import { db } from "@/app/db";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";
import * as fileRepo from "@/app/server/repositories/dbt/file.repository";
import type { NewDbtProject } from "@/app/db/schema";

/** 创建项目（含名称唯一性校验；唯一性判定在 service 层，route 不直接访问 repository） */
export async function createProject(data: NewDbtProject) {
  const existing = await projectRepo.findByName(data.name);
  if (existing) {
    throw new Error("Project name already exists");
  }
  return projectRepo.createProject(data);
}

export const getProject = projectRepo.findById;

export const listProjects = projectRepo.findList;

export const updateProject = projectRepo.updateById;

/** 软删除项目，在单个事务中级联软删除所有文件和目录（files → directories → project） */
export async function deleteProject(id: number) {
  const project = await projectRepo.findById(id);
  if (!project) return null;

  await db.transaction(async (tx) => {
    // 级联软删除：文件 → 目录 → 项目（任一步失败整体回滚，不留孤儿状态）
    await fileRepo.softDeleteByProjectId(id, tx);
    await directoryRepo.softDeleteByProjectId(id, tx);
    await projectRepo.softDeleteById(id, tx);
  });

  return project;
}
