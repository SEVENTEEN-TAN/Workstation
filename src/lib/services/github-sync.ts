import { z } from "zod";

import { getDatabase } from "../db";

const usernamePattern = /^(?!.*--)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const githubConfigSchema = z.object({
  username: z.string().trim().regex(usernamePattern),
  enabled: z.boolean().default(true),
  selectedRepositories: z.array(z.string().trim().regex(repositoryPattern)).max(100).transform((items) => [...new Set(items)]),
});

const repositorySchema = z.object({
  id: z.number().int().nonnegative(), name: z.string(), full_name: z.string(), description: z.string().nullable(), html_url: z.string().url(),
  homepage: z.string().nullable(), language: z.string().nullable(), topics: z.array(z.string()), stargazers_count: z.number().int().nonnegative(),
  forks_count: z.number().int().nonnegative(), fork: z.boolean(), archived: z.boolean(), pushed_at: z.string().datetime().nullable(),
});
const eventSchema = z.object({ id: z.string(), type: z.string(), repo: z.object({ name: z.string() }), created_at: z.string().datetime() });

type Fetcher = (request: Request) => Promise<Response>;

async function githubJson(path: string, fetcher: Fetcher) {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "personal-workstation" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetcher(new Request(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(15_000) }));
  if (!response.ok) throw new Error("GitHub sync failed");
  return response.json();
}

export function normalizeGitHubRepository(input: unknown, selected: ReadonlySet<string>, syncedAt: Date) {
  const repo = repositorySchema.parse(input);
  return {
    githubId: String(repo.id), fullName: repo.full_name, name: repo.name, description: repo.description, htmlUrl: repo.html_url,
    homepageUrl: repo.homepage || null, primaryLanguage: repo.language, topics: repo.topics, stars: repo.stargazers_count,
    forks: repo.forks_count, isFork: repo.fork, isArchived: repo.archived, selected: selected.has(repo.full_name),
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null, syncedAt,
  };
}

export function normalizeGitHubEvent(input: unknown, syncedAt: Date) {
  const event = eventSchema.parse(input);
  return { githubId: event.id, type: event.type, repository: event.repo.name, url: `https://github.com/${event.repo.name}`, occurredAt: new Date(event.created_at), syncedAt };
}

export async function getGitHubSyncState() {
  const database = await getDatabase();
  const [config, repositories, events] = await Promise.all([
    database.gitHubSyncConfig.findUnique({ where: { id: "github" } }),
    database.gitHubRepositorySnapshot.findMany({ orderBy: [{ selected: "desc" }, { pushedAt: "desc" }] }),
    database.gitHubContributionEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 100 }),
  ]);
  return { config, repositories, events };
}

export async function configureGitHubSync(input: unknown) {
  const value = githubConfigSchema.parse(input);
  const database = await getDatabase();
  return database.$transaction(async (transaction) => {
    const config = await transaction.gitHubSyncConfig.upsert({
      where: { id: "github" },
      update: value,
      create: { id: "github", ...value },
    });
    await transaction.gitHubRepositorySnapshot.updateMany({ data: { selected: false } });
    if (value.selectedRepositories.length) {
      await transaction.gitHubRepositorySnapshot.updateMany({
        where: { fullName: { in: value.selectedRepositories } },
        data: { selected: true },
      });
    }
    return config;
  });
}

export async function syncGitHub(fetcher: Fetcher = (request) => fetch(request)) {
  const database = await getDatabase();
  const config = await database.gitHubSyncConfig.findUnique({ where: { id: "github" } });
  if (!config?.enabled) throw new Error("GitHub sync is not configured");
  const selected = new Set(Array.isArray(config.selectedRepositories) ? config.selectedRepositories.filter((item): item is string => typeof item === "string") : []);
  try {
    const [repositoriesRaw, eventsRaw] = await Promise.all([
      githubJson(`/users/${encodeURIComponent(config.username)}/repos?per_page=100&sort=pushed`, fetcher),
      githubJson(`/users/${encodeURIComponent(config.username)}/events/public?per_page=100`, fetcher),
    ]);
    const syncedAt = new Date();
    const repositories = z.array(z.unknown()).parse(repositoriesRaw).map((repo) => normalizeGitHubRepository(repo, selected, syncedAt));
    const events = z.array(z.unknown()).parse(eventsRaw).map((event) => normalizeGitHubEvent(event, syncedAt));
    await database.$transaction(async (transaction) => {
      await transaction.gitHubRepositorySnapshot.updateMany({ data: { selected: false } });
      for (const repo of repositories) await transaction.gitHubRepositorySnapshot.upsert({ where: { githubId: repo.githubId }, update: repo, create: repo });
      for (const event of events) await transaction.gitHubContributionEvent.upsert({ where: { githubId: event.githubId }, update: event, create: event });
      await transaction.gitHubSyncConfig.update({ where: { id: "github" }, data: { lastSyncStatus: "SUCCESS", lastSyncedAt: syncedAt, lastSyncError: null } });
    });
    return getGitHubSyncState();
  } catch (error) {
    await database.gitHubSyncConfig.update({ where: { id: "github" }, data: { lastSyncStatus: "FAILED", lastSyncError: "GitHub sync failed" } }).catch(() => undefined);
    throw error;
  }
}
