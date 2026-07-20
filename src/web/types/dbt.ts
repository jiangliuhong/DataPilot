export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: "active" | "archived";
}

export interface Directory {
  id: number;
  projectId: number;
  parentId: number | null;
  name: string;
  path: string;
  depth: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DirectoryTreeNode {
  id: number;
  name: string;
  path: string;
  children: DirectoryTreeNode[];
}

export interface CreateDirectoryInput {
  name: string;
  parentId?: number | null;
}

export interface UpdateDirectoryInput {
  name?: string;
  parentId?: number | null;
}

export interface ProjectFile {
  id: number;
  projectId: number;
  directoryId: number | null;
  name: string;
  path: string;
  content?: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFileInput {
  name: string;
  content?: string;
  directoryId?: number | null;
}

export interface UpdateFileInput {
  name?: string;
  content?: string;
  directoryId?: number | null;
}

export interface AdapterPackage {
  name: string;
  version: string;
  supportedDatabases: string[];
}

export interface Dependency {
  name: string;
  version: string;
}

export interface Version {
  id: number;
  name: string;
  version: string;
  adapterPackages: AdapterPackage[];
  dependencies: Dependency[];
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateVersionInput {
  name: string;
  version: string;
  adapterPackages: AdapterPackage[];
  dependencies: Dependency[];
}

export interface UpdateVersionInput {
  name?: string;
  version?: string;
  adapterPackages?: AdapterPackage[];
  dependencies?: Dependency[];
  status?: "active" | "inactive";
}

export interface Connection {
  id: number;
  name: string;
  databaseType: "mysql5" | "mysql8" | "starrocks" | "postgresql";
  host: string;
  port: number;
  databaseName: string;
  schemaName: string | null;
  username: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateConnectionInput {
  name: string;
  databaseType: "mysql5" | "mysql8" | "starrocks" | "postgresql";
  host: string;
  port: number;
  databaseName: string;
  schemaName?: string;
  username: string;
  password: string;
  extraConfig?: Record<string, string>;
}

export interface UpdateConnectionInput {
  name?: string;
  databaseType?: "mysql5" | "mysql8" | "starrocks" | "postgresql";
  host?: string;
  port?: number;
  databaseName?: string;
  schemaName?: string;
  username?: string;
  password?: string;
  extraConfig?: Record<string, string>;
  status?: "active" | "inactive";
}

export interface Environment {
  id: number;
  name: string;
  versionId: number;
  connectionId: number;
  status: "active" | "inactive";
  initializationStatus: "pending" | "running" | "initialized" | "failed";
  venvPath: string | null;
  initializedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateEnvironmentInput {
  name: string;
  versionId: number;
  connectionId: number;
}

export interface UpdateEnvironmentInput {
  name?: string;
  versionId?: number;
  connectionId?: number;
  status?: "active" | "inactive";
}

export interface ProjectEnvironment {
  id: number;
  projectId: number;
  environmentId: number;
  environmentAlias: string | null;
  createdAt: string;
  updatedAt: string;
  // 关联摘要（JOIN 查询返回，供 UI 展示）
  environmentName?: string;
  environmentStatus?: "active" | "inactive";
  versionId?: number;
  connectionId?: number;
  versionName?: string;
  version?: string;
  connectionName?: string;
  databaseType?: "mysql5" | "mysql8" | "starrocks" | "postgresql";
}

export interface BindEnvironmentInput {
  environmentId: number;
  environmentAlias?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

// ===== 任务调度 =====

/** dbt 任务命令枚举（后端支持全集；前端第一阶段锁定 run） */
export type TaskCommand =
  | "run"
  | "build"
  | "test"
  | "compile"
  | "seed"
  | "snapshot";

/** 任务运行状态枚举 */
export type TaskRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

/** 任务（含环境与连接摘要，列表/详情返回） */
export interface Task {
  id: number;
  projectId: number;
  environmentId: number;
  name: string;
  description: string | null;
  command: TaskCommand;
  select: string | null;
  exclude: string | null;
  fullRefresh: boolean;
  vars: string | null;
  target: string | null;
  scheduleCron: string | null;
  scheduleStatus: "disabled" | "enabled";
  createdAt: string;
  updatedAt: string;
  // 关联摘要（JOIN 查询返回）
  environmentName: string;
  environmentStatus: "active" | "inactive";
  initializationStatus: "pending" | "running" | "initialized" | "failed";
  connectionId: number;
  connectionName: string;
  databaseType: "mysql5" | "mysql8" | "starrocks" | "postgresql";
}

/** 创建任务入参 */
export interface CreateTaskInput {
  projectId: number;
  environmentId: number;
  name: string;
  description?: string;
  command: TaskCommand;
  select?: string;
  exclude?: string;
  fullRefresh?: boolean;
  vars?: string;
  target?: string;
}

/** 更新任务入参（全部 optional；projectId 不可变） */
export interface UpdateTaskInput {
  name?: string;
  description?: string;
  environmentId?: number;
  command?: TaskCommand;
  select?: string;
  exclude?: string;
  fullRefresh?: boolean;
  vars?: string;
  target?: string;
}

/** 任务运行记录 */
export interface TaskRun {
  id: number;
  taskId: number;
  status: TaskRunStatus;
  exitCode: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 触发运行返回 */
export interface RunTaskResult {
  runId: number;
  status: "queued";
}
