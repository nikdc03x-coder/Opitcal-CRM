
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Location of our PostgreSQL database schema.
  schema: "prisma/schema.prisma",

  // Location of migration files and seed script.
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  // Read database credentials from .env.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
