import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { createAuditLogService } from "../src/lib/services/audit-logs";
import { withAdminSession, type AdminAuditEntry } from "../src/lib/services/auth-guard";

const projectRoot = resolve(import.meta.dirname, "..");

function collectRouteFiles(directory: string, result: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collectRouteFiles(path, result);
    } else if (entry === "route.ts") {
      result.push(path);
    }
  }
  return result;
}

function findWithAdminSessionCalls(node: ts.Node, result: ts.CallExpression[] = []): ts.CallExpression[] {
  if (ts.isCallExpression(node) && node.expression.getText() === "withAdminSession") {
    result.push(node);
  }
  for (const child of node.getChildren()) findWithAdminSessionCalls(child, result);
  return result;
}

describe("admin audit logging", () => {
  it("records successful non-GET metadata without query strings or request bodies", async () => {
    const entries: AdminAuditEntry[] = [];
    const request = new Request("https://workstation.test/api/admin/projects/project-1?token=url-secret", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "user-agent": "Workstation test browser",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify({ apiKey: "body-secret" }),
    });

    const response = await withAdminSession(
      async (session) => {
        expect(session.userId).toBe("user-1");
        return Response.json({ ok: true });
      },
      request,
      {
        loadSession: () => Promise.resolve({ userId: "user-1" }),
        audit: (entry) => {
          entries.push(entry);
          return Promise.resolve();
        },
      },
    );

    expect(response.status).toBe(200);
    expect(entries).toEqual([{
      userId: "user-1",
      method: "PATCH",
      path: "/api/admin/projects/project-1",
      targetId: "project-1",
      statusCode: 200,
      ipAddress: "203.0.113.10",
      userAgent: "Workstation test browser",
    }]);
    expect(JSON.stringify(entries)).not.toContain("url-secret");
    expect(JSON.stringify(entries)).not.toContain("body-secret");
  });

  it("does not record GET requests or unauthenticated requests", async () => {
    const entries: AdminAuditEntry[] = [];
    const audit = vi.fn((entry: AdminAuditEntry) => {
      entries.push(entry);
      return Promise.resolve();
    });
    const options = {
      loadSession: () => Promise.resolve({ userId: "user-1" } as const),
      audit,
    };

    await withAdminSession(
      async () => new Response(null, { status: 204 }),
      new Request("https://workstation.test/api/admin/projects"),
      options,
    );
    await withAdminSession(
      async () => new Response(null, { status: 204 }),
      new Request("https://workstation.test/api/admin/projects", { method: "DELETE" }),
      { ...options, loadSession: () => Promise.resolve(null) },
    );

    expect(audit).not.toHaveBeenCalled();
    expect(entries).toEqual([]);
  });

  it("records Response failures and unexpected failures with their outcome", async () => {
    const entries: AdminAuditEntry[] = [];
    const record = (entry: AdminAuditEntry) => {
      entries.push(entry);
      return Promise.resolve();
    };
    const loadSession = () => Promise.resolve({ userId: "user-1" } as const);

    const failure = await withAdminSession(
      async () => Response.json({ error: "NOT_FOUND" }, { status: 404 }),
      new Request("https://workstation.test/api/admin/projects/project-1", { method: "DELETE" }),
      { loadSession, audit: record },
    );
    await expect(withAdminSession(
      async () => {
        throw new Error("operation failed");
      },
      new Request("https://workstation.test/api/admin/site/publish", { method: "POST" }),
      { loadSession, audit: record },
    )).rejects.toThrow("operation failed");

    expect(failure.status).toBe(404);
    expect(entries.map((entry) => ({ path: entry.path, statusCode: entry.statusCode }))).toEqual([
      { path: "/api/admin/projects/project-1", statusCode: 404 },
      { path: "/api/admin/site/publish", statusCode: 500 },
    ]);
  });

  it("keeps audit persistence failures from masking the administrator action", async () => {
    const audit = vi.fn(() => Promise.reject(new Error("audit database unavailable")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await withAdminSession(
      async () => Response.json({ ok: true }),
      new Request("https://workstation.test/api/admin/okr/cycles", { method: "POST" }),
      { loadSession: () => Promise.resolve({ userId: "user-1" }), audit },
    );

    expect(response.status).toBe(200);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("Failed to record admin audit log", expect.any(Error));
  });
});

describe("admin route audit contracts", () => {
  it("passes every non-GET admin route request to the audit-capable session guard", () => {
    const routeFiles = collectRouteFiles(join(projectRoot, "src/app/api/admin"));
    expect(routeFiles.length).toBeGreaterThan(0);

    const missing: string[] = [];
    const untypedRequests: string[] = [];
    for (const path of routeFiles) {
      const source = readFileSync(path, "utf8");
      const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const handlers = sourceFile.statements.filter(ts.isFunctionDeclaration).filter((statement) => {
        const name = statement.name?.text;
        return Boolean(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
          && (name === "POST" || name === "PATCH" || name === "PUT" || name === "DELETE");
      });

      for (const handler of handlers) {
      const requestParameter = handler?.parameters[0];
      if (
        !requestParameter
        || requestParameter.name.getText(sourceFile) !== "request"
        || requestParameter.type?.getText(sourceFile) !== "Request"
      ) {
        untypedRequests.push(`${relative(projectRoot, path)} ${handler?.name?.text}`);
      }

        const call = handler && findWithAdminSessionCalls(handler)[0];
        const secondArgument = call?.arguments[1];
        if (!secondArgument || secondArgument.getText(sourceFile) !== "request") {
          missing.push(`${relative(projectRoot, path)} ${handler?.name?.text}`);
        }
      }
    }

    expect(missing).toEqual([]);
    expect(untypedRequests).toEqual([]);
  });

  it("bounds recent audit log reads", async () => {
    const limits: number[] = [];
    const service = createAuditLogService({
      async create() {
        throw new Error("not used");
      },
      async list(limit) {
        limits.push(limit);
        return [];
      },
    });

    await service.list(999);
    await service.list(0);
    await service.list(-3);

    expect(limits).toEqual([200, 100, 100]);
  });

  it("exposes recent audit metadata through the admin API", () => {
    const route = readFileSync(join(projectRoot, "src/app/api/admin/audit/route.ts"), "utf8");

    expect(route).toContain("withAdminSession");
    expect(route).toContain("auditLogService.list()");
  });
});
