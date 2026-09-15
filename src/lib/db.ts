import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaReady?: Promise<void>;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

async function enableSqlitePragmas(): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getDatabase(): Promise<PrismaClient> {
  const ready = globalForPrisma.prismaReady ?? enableSqlitePragmas();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prismaReady = ready;
  await ready;
  return prisma;
}
