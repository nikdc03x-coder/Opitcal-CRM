import "dotenv/config";
import { defineConfig } from "prisma/config";
import { migrationUrl } from "./src/config/databaseConfig";

export default defineConfig({
  // Location of our PostgreSQL database schema.
  schema: "src/models/schema.prisma",

  // Location of migration files and seed script.
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  // Read database credentials from .env.
  datasource: {
    url: migrationUrl(),
  },
});
