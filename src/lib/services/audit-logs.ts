import { getDatabase } from "../db";

export type AdminAuditEntry = {
  userId: string;
  method: string;
  path: string;
  targetId: string | null;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditLogRecord = AdminAuditEntry & {
  id: string;
  createdAt: Date;
};

export type AuditLogData = Omit<AuditLogRecord, "createdAt"> & {
  createdAt: string;
};

export type AuditLogRepository = {
  create(input: AdminAuditEntry): Promise<unknown>;
  list(limit: number): Promise<AuditLogRecord[]>;
};

function defaultRepository(): AuditLogRepository {
  return {
    async create(input) {
      return (await getDatabase()).auditLog.create({ data: input });
    },
    async list(limit) {
      return (await getDatabase()).auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },
  };
}

export function createAuditLogService(repository: AuditLogRepository = defaultRepository()) {
  return {
    record: (input: AdminAuditEntry) => repository.create(input),
    async list(limit = 100): Promise<AuditLogData[]> {
      const requestedLimit = Math.trunc(limit);
      const normalizedLimit = requestedLimit > 0 ? requestedLimit : 100;
      const boundedLimit = Math.min(normalizedLimit, 200);
      return (await repository.list(boundedLimit)).map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      }));
    },
  };
}

export const auditLogService = createAuditLogService();
