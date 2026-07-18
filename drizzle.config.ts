import { defineConfig } from "drizzle-kit";

const DB_DRIVER = process.env.DB_DRIVER ?? "mysql";
const outFolder =
  DB_DRIVER === "sqlite"
    ? "./src/app/db/migrations/sqlite"
    : "./src/app/db/migrations/mysql";

export default defineConfig(
  DB_DRIVER === "sqlite"
    ? {
        schema: "./src/app/db/schema/index.ts",
        out: outFolder,
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL ?? "./data.db",
        },
      }
    : {
        schema: "./src/app/db/schema/index.ts",
        out: outFolder,
        dialect: "mysql",
        dbCredentials: {
          url: process.env.DATABASE_URL!,
        },
      },
);
