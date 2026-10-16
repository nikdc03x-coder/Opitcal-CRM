import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { databasePoolConfig } from "./databaseConfig";

// One lazy pool for the process, shared by API services and maintenance scripts.
// Prisma owns this adapter's pool and closes it on $disconnect().
const adapter = new PrismaPg(databasePoolConfig(), {
  onPoolError: () => console.error("The Neon connection pool reported an idle connection error."),
});
export const prisma = new PrismaClient({ adapter });
