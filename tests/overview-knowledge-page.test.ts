import { expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/services/knowledge-vaults", () => ({ knowledgeVaultService: { list } }));

import AdminKnowledgePage from "../src/app/admin/(workspace)/knowledge/page";

it("passes overview vault and revision links into the knowledge workspace", async () => {
  list.mockResolvedValue([]);

  const page = await AdminKnowledgePage({ searchParams: Promise.resolve({ vault: "vault-1", revision: "revision-1" }) });

  expect(page.props.initialVaultId).toBe("vault-1");
  expect(page.props.initialRevisionId).toBe("revision-1");
});
