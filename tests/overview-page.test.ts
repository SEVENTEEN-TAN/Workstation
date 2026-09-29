import { expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  dashboard: vi.fn(),
  audit: vi.fn(),
  queue: vi.fn(),
}));

vi.mock("../src/lib/services/okr", () => ({ okrService: { getDashboard: services.dashboard } }));
vi.mock("../src/lib/services/audit-logs", () => ({ auditLogService: { list: services.audit } }));
vi.mock("../src/lib/services/overview-queue", () => ({ getOverviewQueue: services.queue }));

import AdminOverviewPage from "../src/app/admin/(workspace)/overview/page";

it("loads the actionable queue into the initial overview page", async () => {
  const dashboard = { cycleCount: 0, objectives: [] };
  const queue = { todayActions: [{ id: "a", label: "今日行动", detail: "目标", href: "/admin/okr" }], overdueKeyResults: [], pendingReviews: [], pendingPublications: [] };
  services.dashboard.mockResolvedValue(dashboard);
  services.audit.mockResolvedValue([]);
  services.queue.mockResolvedValue(queue);

  const page = await AdminOverviewPage();

  expect(page.props.initialDashboard).toBe(dashboard);
  expect(page.props.initialQueue).toBe(queue);
});
