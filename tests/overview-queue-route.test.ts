import { expect, it, vi } from "vitest";

const queue = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/services/overview-queue", () => ({ getOverviewQueue: queue }));
vi.mock("../src/lib/services/auth-guard", () => ({ withAdminSession: (run: () => Promise<Response>) => run() }));

import { GET } from "../src/app/api/admin/overview-queue/route";

it("serves the actionable overview queue through the admin route", async () => {
  const data = { todayActions: [], overdueKeyResults: [], pendingReviews: [], pendingPublications: [] };
  queue.mockResolvedValue(data);

  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(data);
});
