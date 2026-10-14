
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Get the database URL from environment variables.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Prisma 7 uses a PostgreSQL driver adapter.
// This provides the connection between Prisma and Neon.
const adapter = new PrismaPg({ connectionString });

// Export one shared database client for our services.
export const prisma = new PrismaClient({ adapter });
