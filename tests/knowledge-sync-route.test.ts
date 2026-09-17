import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const routePath = resolve(import.meta.dirname, "../src/app/api/sync/knowledge/vaults/[id]/route.ts");

describe("knowledge sync route", () => {
  it("uses the dedicated token boundary instead of an admin session", () => {
    const route = readFileSync(routePath, "utf8");

    expect(route).toContain("verifyKnowledgeSyncToken");
    expect(route).toContain("knowledgeSyncPayloadSchema");
    expect(route).toContain("receiveTransportSync");
    expect(route).not.toContain("withAdminSession");
    expect(route).not.toContain("rootPath");
    expect(route).not.toContain("markdown");
  });
});
