import { relations } from "drizzle-orm";
import { dbtProjects } from "../schema/mysql/dbt-project";
import { dbtDirectories } from "../schema/mysql/dbt-directory";
import { dbtFiles } from "../schema/mysql/dbt-file";
import { dbtVersions } from "../schema/mysql/dbt-version";
import { dbtDatabaseConnections } from "../schema/mysql/dbt-database-connection";
import { dbtRuntimeEnvironments } from "../schema/mysql/dbt-runtime-environment";
import { dbtProjectEnvironments } from "../schema/mysql/dbt-project-environment";
import { dbtTasks } from "../schema/mysql/dbt-task";
import { dbtTaskRuns } from "../schema/mysql/dbt-task-run";
import { users } from "../schema/mysql/user";
import { agentConversations } from "../schema/mysql/agent-conversation";
import { agentMessages } from "../schema/mysql/agent-message";
import { agentWorkspaces } from "../schema/mysql/agent-workspace";

/** dbt_projects → dbt_directories 一对多 + 项目环境绑定 + 任务 */
export const dbtProjectsRelations = relations(dbtProjects, ({ many }) => ({
  directories: many(dbtDirectories),
  files: many(dbtFiles),
  projectEnvironments: many(dbtProjectEnvironments),
  tasks: many(dbtTasks),
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

/** dbt_runtime_environments → dbt_versions + dbt_database_connections + 项目绑定 + 任务 */
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
    tasks: many(dbtTasks),
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

/** dbt_tasks → dbt_projects + dbt_runtime_environments + 运行记录一对多 */
export const dbtTasksRelations = relations(dbtTasks, ({ one, many }) => ({
  project: one(dbtProjects, {
    fields: [dbtTasks.projectId],
    references: [dbtProjects.id],
  }),
  environment: one(dbtRuntimeEnvironments, {
    fields: [dbtTasks.environmentId],
    references: [dbtRuntimeEnvironments.id],
  }),
  runs: many(dbtTaskRuns),
}));

/** dbt_task_runs → dbt_tasks */
export const dbtTaskRunsRelations = relations(dbtTaskRuns, ({ one }) => ({
  task: one(dbtTasks, {
    fields: [dbtTaskRuns.taskId],
    references: [dbtTasks.id],
  }),
}));

/** agent_workspaces → users + agent_conversations 一对多 */
export const agentWorkspacesRelations = relations(
  agentWorkspaces,
  ({ one, many }) => ({
    user: one(users, {
      fields: [agentWorkspaces.userId],
      references: [users.id],
    }),
    conversations: many(agentConversations),
  }),
);

/** agent_conversations → users + agent_workspaces + agent_messages 一对多 */
export const agentConversationsRelations = relations(
  agentConversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [agentConversations.userId],
      references: [users.id],
    }),
    workspace: one(agentWorkspaces, {
      fields: [agentConversations.workspaceId],
      references: [agentWorkspaces.id],
    }),
    messages: many(agentMessages),
  }),
);

/** agent_messages → agent_conversations */
export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  conversation: one(agentConversations, {
    fields: [agentMessages.conversationId],
    references: [agentConversations.id],
  }),
}));
