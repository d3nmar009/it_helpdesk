import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient() {
  const raw = process.env.DATABASE_CONNECTION_LIMIT;
  const parsed = raw ? Number(raw) : 20;
  // IMPORTANT: For this MariaDB adapter, 0 results in pool limit=0 (no connections).
  // Use a positive number; override via DATABASE_CONNECTION_LIMIT.
  const connectionLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;

  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export default prisma;