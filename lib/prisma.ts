
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("Missing DATABASE_URL environment variable");

// Force verify-full to silence the pg SSL deprecation warning and keep strong security.
const connectionString = rawUrl.includes("sslmode=")
  ? rawUrl.replace(/sslmode=[^&]+/, "sslmode=verify-full")
  : rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=verify-full";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis:       90_000,
  connectionTimeoutMillis:  5_000,
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Avoid multiple instances in dev (hot reloading)
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;