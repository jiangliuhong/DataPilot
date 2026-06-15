// Relations facade.
//
// Relations are purely declarative — they reference table symbols — so they
// must come from the same dialect folder as the active schema to stay wired
// to the correct table objects. Importing this file registers the active
// dialect's relations (side effect) and re-exports their symbols.
//
// Both dialect modules are imported with *static* paths so bundlers can
// analyze them; one set is selected at runtime.

import * as mysqlRelations from "./mysql";
import * as sqliteRelations from "./sqlite";

// Relations reference dialect-specific table objects, so the MySQL and SQLite
// relation modules are structurally incompatible; cast to pick one at runtime.
const active = (
  process.env.DB_DRIVER === "sqlite" ? sqliteRelations : mysqlRelations
) as typeof mysqlRelations;

// Re-export every relation symbol from the active dialect.
export const dbtProjectsRelations = active.dbtProjectsRelations;
export const dbtDirectoriesRelations = active.dbtDirectoriesRelations;
export const dbtFilesRelations = active.dbtFilesRelations;
export const dbtVersionsRelations = active.dbtVersionsRelations;
export const dbtDatabaseConnectionsRelations =
  active.dbtDatabaseConnectionsRelations;
export const dbtRuntimeEnvironmentsRelations =
  active.dbtRuntimeEnvironmentsRelations;
export const dbtProjectEnvironmentsRelations =
  active.dbtProjectEnvironmentsRelations;
