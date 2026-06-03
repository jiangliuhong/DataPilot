import { drizzle as drizzleMySQL } from "drizzle-orm/mysql2";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import * as mysql from "mysql2/promise";
import BetterSqlite3 = require("better-sqlite3");

import * as schema from "./schema";

const DB_DRIVER = process.env.DB_DRIVER ?? "mysql";

function createMySQLClient() {
  const connection = mysql.createPool(process.env.DATABASE_URL!);
  return drizzleMySQL(connection, { schema, mode: "default" });
}

function createSQLiteClient() {
  const sqlite = new BetterSqlite3(process.env.DATABASE_URL ?? "./data.db");
  return drizzleSQLite(sqlite, { schema });
}

export const db = DB_DRIVER === "sqlite" ? createSQLiteClient() : createMySQLClient();

export type Database = typeof db;
