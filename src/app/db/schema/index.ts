// Schema facade: selects the active dialect's schema at module load time.
//
// MySQL is the *canonical* type for the rest of the app (repositories,
// services). At runtime the exported objects are whichever dialect is active
// (controlled by DB_DRIVER), cast to the MySQL-canonical types. This keeps
// every consumer unchanged while supporting both drivers.
//
//   DB_DRIVER=mysql  (default) → schema/mysql
//   DB_DRIVER=sqlite            → schema/sqlite
//
// NOTE: drizzle-kit also reads this file for migration generation, so the
// dialect switch in drizzle.config.ts must agree with DB_DRIVER.
//
// The two dialect modules are imported with *static* paths (bundlers like
// Turbopack/webpack can analyze these), then one is selected at runtime.

import type * as mysqlSchema from "./mysql";
import * as mysql from "./mysql";
import * as sqlite from "./sqlite";

// The active dialect's table objects. Cast to `any` because the MySQL and
// SQLite table types are structurally incompatible (different base classes),
// even though at runtime both expose the same Drizzle query API. Down below we
// re-assert the MySQL-canonical types for consumers.
const activeSchema = (
  (process.env.DB_DRIVER ?? "mysql") === "sqlite" ? sqlite : mysql
) as unknown as typeof mysqlSchema;

// Re-export every table symbol, typed as the MySQL-canonical table.
export const dbtProjects = activeSchema.dbtProjects;
export const dbtDirectories = activeSchema.dbtDirectories;
export const dbtFiles = activeSchema.dbtFiles;
export const dbtVersions = activeSchema.dbtVersions;
export const dbtDatabaseConnections = activeSchema.dbtDatabaseConnections;
export const dbtRuntimeEnvironments = activeSchema.dbtRuntimeEnvironments;
export const dbtProjectEnvironments = activeSchema.dbtProjectEnvironments;
export const users = activeSchema.users;

// Canonical types (always MySQL-shaped, regardless of active dialect).
export type {
  NewDbtProject,
  DbtProject,
  NewDbtDirectory,
  DbtDirectory,
  NewDbtFile,
  DbtFile,
  NewDbtVersion,
  DbtVersion,
  NewDbtDatabaseConnection,
  DbtDatabaseConnection,
  NewDbtRuntimeEnvironment,
  DbtRuntimeEnvironment,
  NewDbtProjectEnvironment,
  DbtProjectEnvironment,
  NewUser,
  User,
} from "./mysql";
