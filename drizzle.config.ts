import { defineConfig } from "drizzle-kit";

const DB_DRIVER = process.env.DB_DRIVER ?? "mysql";

export default defineConfig(
  DB_DRIVER === "sqlite"
    ? {
        schema: "./src/app/db/schema/index.ts",
        out: "./src/app/db/migrations",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL ?? "./data.db",
        },
      }
    : {
        schema: "./src/app/db/schema/index.ts",
        out: "./src/app/db/migrations",
        dialect: "mysql",
        dbCredentials: {
          url: process.env.DATABASE_URL!,
        },
      },
);
