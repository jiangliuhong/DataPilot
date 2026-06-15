import { relations } from "drizzle-orm";
import { dbtProjects } from "../schema/sqlite/dbt-project";
import { dbtDirectories } from "../schema/sqlite/dbt-directory";
import { dbtFiles } from "../schema/sqlite/dbt-file";
import { dbtVersions } from "../schema/sqlite/dbt-version";
import { dbtDatabaseConnections } from "../schema/sqlite/dbt-database-connection";
import { dbtRuntimeEnvironments } from "../schema/sqlite/dbt-runtime-environment";
import { dbtProjectEnvironments } from "../schema/sqlite/dbt-project-environment";

/** dbt_projects → dbt_directories 一对多 + 项目环境绑定 */
export const dbtProjectsRelations = relations(dbtProjects, ({ many }) => ({
  directories: many(dbtDirectories),
  files: many(dbtFiles),
  projectEnvironments: many(dbtProjectEnvironments),
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

/** dbt_versions → dbt_runtime_environments 一对多 */
export const dbtVersionsRelations = relations(dbtVersions, ({ many }) => ({
  environments: many(dbtRuntimeEnvironments),
}));

/** dbt_database_connections → dbt_runtime_environments 一对多 */
export const dbtDatabaseConnectionsRelations = relations(
  dbtDatabaseConnections,
  ({ many }) => ({
    environments: many(dbtRuntimeEnvironments),
  }),
);

/** dbt_runtime_environments → dbt_versions + dbt_database_connections + 项目绑定 */
export const dbtRuntimeEnvironmentsRelations = relations(
  dbtRuntimeEnvironments,
  ({ one, many }) => ({
    version: one(dbtVersions, {
      fields: [dbtRuntimeEnvironments.versionId],
      references: [dbtVersions.id],
    }),
    connection: one(dbtDatabaseConnections, {
      fields: [dbtRuntimeEnvironments.connectionId],
      references: [dbtDatabaseConnections.id],
    }),
    projectEnvironments: many(dbtProjectEnvironments),
  }),
);

/** dbt_project_environments → dbt_projects + dbt_runtime_environments */
export const dbtProjectEnvironmentsRelations = relations(
  dbtProjectEnvironments,
  ({ one }) => ({
    project: one(dbtProjects, {
      fields: [dbtProjectEnvironments.projectId],
      references: [dbtProjects.id],
    }),
    environment: one(dbtRuntimeEnvironments, {
      fields: [dbtProjectEnvironments.environmentId],
      references: [dbtRuntimeEnvironments.id],
    }),
  }),
);
