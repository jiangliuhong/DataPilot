import { relations } from "drizzle-orm";
import { dbtProjects } from "../schema/dbt-project";
import { dbtDirectories } from "../schema/dbt-directory";
import { dbtFiles } from "../schema/dbt-file";

/** dbt_projects → dbt_directories 一对多 */
export const dbtProjectsRelations = relations(dbtProjects, ({ many }) => ({
  directories: many(dbtDirectories),
  files: many(dbtFiles),
}));

/** dbt_directories 自引用 + 关联文件 */
export const dbtDirectoriesRelations = relations(dbtDirectories, ({ one, many }) => ({
  project: one(dbtProjects, {
    fields: [dbtDirectories.projectId],
    references: [dbtProjects.id],
  }),
  parent: one(dbtDirectories, {
    fields: [dbtDirectories.parentId],
    references: [dbtDirectories.id],
    relationName: "directoryChildren",
  }),
  children: many(dbtDirectories, {
    relationName: "directoryChildren",
  }),
  files: many(dbtFiles),
}));

/** dbt_files → dbt_directories + dbt_projects */
export const dbtFilesRelations = relations(dbtFiles, ({ one }) => ({
  project: one(dbtProjects, {
    fields: [dbtFiles.projectId],
    references: [dbtProjects.id],
  }),
  directory: one(dbtDirectories, {
    fields: [dbtFiles.directoryId],
    references: [dbtDirectories.id],
  }),
}));
