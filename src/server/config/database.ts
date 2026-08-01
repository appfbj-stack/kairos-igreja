import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../../generated/prisma/client";

// Para trocar de SQLite → PostgreSQL:
// 1. npm install @prisma/adapter-pg
// 2. Alterar provider no schema.prisma para "postgresql"
// 3. Alterar DATABASE_URL no .env
// 4. Trocar adapter:
//    import { PrismaPg } from "@prisma/adapter-pg"
//    new PrismaPg({ url: process.env.DATABASE_URL })
// 5. Rodar: npx prisma migrate deploy

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL || "file:./data/kairos.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;