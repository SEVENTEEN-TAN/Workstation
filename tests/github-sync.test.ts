import { describe, expect, it } from "vitest";

import {
  githubConfigSchema,
  normalizeGitHubEvent,
  normalizeGitHubRepository,
} from "../src/lib/services/github-sync";

describe("GitHub sync validation", () => {
  it("normalizes configuration and removes duplicate repository selections", () => {
    expect(githubConfigSchema.parse({
      username: "  SEVENTEEN-TAN  ",
      enabled: true,
      selectedRepositories: ["SEVENTEEN-TAN/Workstation", "SEVENTEEN-TAN/Workstation"],
    })).toEqual({
      username: "SEVENTEEN-TAN",
      enabled: true,
      selectedRepositories: ["SEVENTEEN-TAN/Workstation"],
    });
  });

  it.each(["-invalid", "invalid-", "invalid--name", "name with spaces"])(
    "rejects an invalid GitHub username: %s",
    (username) => {
      expect(githubConfigSchema.safeParse({ username, enabled: true, selectedRepositories: [] }).success).toBe(false);
    },
  );
});

describe("GitHub sync normalization", () => {
  const syncedAt = new Date("2026-09-18T02:00:00.000Z");

  it("maps repository evidence and applies the administrator selection", () => {
    expect(normalizeGitHubRepository({
      id: 123,
      name: "Workstation",
      full_name: "SEVENTEEN-TAN/Workstation",
      description: "Personal workstation",
      html_url: "https://github.com/SEVENTEEN-TAN/Workstation",
      homepage: "https://sqtan.com",
      language: "TypeScript",
      topics: ["nextjs", "portfolio"],
      stargazers_count: 8,
      forks_count: 2,
      fork: false,
      archived: false,
      pushed_at: "2026-09-17T12:00:00.000Z",
    }, new Set(["SEVENTEEN-TAN/Workstation"]), syncedAt)).toEqual({
      githubId: "123",
      fullName: "SEVENTEEN-TAN/Workstation",
      name: "Workstation",
      description: "Personal workstation",
      htmlUrl: "https://github.com/SEVENTEEN-TAN/Workstation",
      homepageUrl: "https://sqtan.com",
      primaryLanguage: "TypeScript",
      topics: ["nextjs", "portfolio"],
      stars: 8,
      forks: 2,
      isFork: false,
      isArchived: false,
      selected: true,
      pushedAt: new Date("2026-09-17T12:00:00.000Z"),
      syncedAt,
    });
  });

  it("maps a public event without retaining its payload", () => {
    expect(normalizeGitHubEvent({
      id: "event-1",
      type: "PushEvent",
      repo: { name: "SEVENTEEN-TAN/Workstation" },
      created_at: "2026-09-18T01:00:00.000Z",
      payload: { commits: [{ sha: "private-detail" }] },
    }, syncedAt)).toEqual({
      githubId: "event-1",
      type: "PushEvent",
      repository: "SEVENTEEN-TAN/Workstation",
      url: "https://github.com/SEVENTEEN-TAN/Workstation",
      occurredAt: new Date("2026-09-18T01:00:00.000Z"),
      syncedAt,
    });
  });
});
