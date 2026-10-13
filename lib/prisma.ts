import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function intFromEnv(name: string, fallback: number, min: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
}

export function databasePoolConfig() {
  // IMPORTANT: For this MariaDB adapter, connectionLimit 0 results in no connections at all.
  const connectionLimit = intFromEnv("DATABASE_CONNECTION_LIMIT", 10, 1);
  return {
    host: process.env.DATABASE_HOST,
    port: intFromEnv("DATABASE_PORT", 3306, 1),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit,
    // The mariadb driver defaults minimumIdle to connectionLimit, which opens and holds every
    // connection of the pool at startup. Keep only a few warm and open the rest on demand.
    minimumIdle: Math.min(intFromEnv("DATABASE_MIN_IDLE", 1, 0), connectionLimit),
    // Seconds before connections above minimumIdle are closed.
    idleTimeout: intFromEnv("DATABASE_IDLE_TIMEOUT", 60, 1),
  };
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaMariaDb(databasePoolConfig()) });
}

// Cached in production too: every extra PrismaClient opens its own connection pool.
export const prisma = (globalThis.prismaGlobal ??= createPrismaClient());

export default prisma;
