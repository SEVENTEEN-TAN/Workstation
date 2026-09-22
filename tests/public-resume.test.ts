import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { createPublicResumeService } from "../src/lib/services/public-resume";

const projectRoot = resolve(import.meta.dirname, "..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("public resume aggregation", () => {
  it("returns published career evidence and only public download availability", async () => {
    const draftContent = structuredClone(bootstrapSiteContent);
    draftContent.en.meta.title = "Draft homepage preview";
    const data = await createPublicResumeService({
      loadSiteContent: async () => draftContent,
      loadExperiences: async () => [{
        id: "experience-public",
        visibility: "PUBLIC",
        startedAt: new Date("2024-01-01T00:00:00.000Z"),
        endedAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-02-01T00:00:00.000Z"),
      } as never],
      loadProjects: async () => [{
        id: "project-public",
        visibility: "PUBLIC",
        startedAt: null,
        completedAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-02-01T00:00:00.000Z"),
      } as never],
      loadSkills: async () => [{ id: "skill-public" } as never],
      loadActivities: async () => [{
        id: "activity-public",
        visibility: "PUBLIC",
        occurredAt: new Date("2024-03-01T00:00:00.000Z"),
        createdAt: new Date("2024-03-01T00:00:00.000Z"),
        updatedAt: new Date("2024-03-02T00:00:00.000Z"),
      } as never],
      loadResumeFiles: async () => [
        { locale: "ZH", visibility: "PUBLIC", storagePath: "secret-path", sha256: "secret-hash" } as never,
        { locale: "EN", visibility: "PRIVATE", storagePath: "private-path", sha256: "private-hash" } as never,
      ],
    }).getData();

    expect(data).not.toBeNull();
    expect(data?.content).toBe(draftContent);
    expect(data?.content.en.meta.title).toBe("Draft homepage preview");
    expect(data?.downloads).toEqual({ zh: true, en: false });
    expect(data?.experiences[0]).toMatchObject({ id: "experience-public", startedAt: "2024-01-01T00:00:00.000Z" });
    expect(data?.projects[0]).toMatchObject({ id: "project-public", updatedAt: "2024-02-01T00:00:00.000Z" });
    expect(data?.activities[0]).toMatchObject({ id: "activity-public", occurredAt: "2024-03-01T00:00:00.000Z" });
    expect(JSON.stringify(data)).not.toContain("secret-path");
    expect(JSON.stringify(data)).not.toContain("secret-hash");
    expect(JSON.stringify(data)).not.toContain("private-path");
  });

  it("returns null when the site has no published snapshot", async () => {
    let downstreamLoads = 0;
    const data = await createPublicResumeService({
      loadSiteContent: async () => null,
      loadExperiences: async () => { downstreamLoads += 1; return []; },
      loadProjects: async () => { downstreamLoads += 1; return []; },
      loadSkills: async () => { downstreamLoads += 1; return []; },
      loadActivities: async () => { downstreamLoads += 1; return []; },
      loadResumeFiles: async () => { downstreamLoads += 1; return []; },
    }).getData();

    expect(data).toBeNull();
    expect(downstreamLoads).toBe(0);
  });
});

describe("printable resume contracts", () => {
  it("provides a dynamic public page, locale toolbar, print action, and isolated print CSS", () => {
    const page = readProjectFile("src/app/resume/page.tsx");
    const toolbar = readProjectFile("src/components/public/ResumeToolbar.tsx");
    const printable = readProjectFile("src/components/public/PrintableResume.tsx");
    const styles = readProjectFile("src/app/resume/resume.module.css");

    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("getPublicResumeData");
    expect(toolbar).toContain("window.print()");
    expect(toolbar).toContain("seventeen-locale");
    expect(printable).toContain("ResumeToolbar");
    expect(styles).toContain("@media print");
    expect(styles).toMatch(/@media print[\s\S]*\.resumeToolbar\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media print[\s\S]*:global\(body\)[\s\S]*background:\s*#ffffff/);
    expect(`${toolbar}\n${printable}`).not.toContain("/api/admin/");
  });
});
