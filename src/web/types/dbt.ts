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
