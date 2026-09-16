import { describe, expect, it } from "vitest";

import {
  createResumeFileService,
  parseResumeLocale,
  parseResumeVisibility,
  validateResumePdf,
  type ResumeFileRecord,
  type ResumeStoredFile,
} from "../src/lib/services/resume-files";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function pdf(name = "resume.pdf") {
  return new File([pdfBytes], name, { type: "application/pdf" });
}

function record(overrides: Partial<ResumeFileRecord> = {}): ResumeFileRecord {
  return {
    id: "resume-zh",
    locale: "ZH",
    originalFilename: "old.pdf",
    storagePath: "C:/uploads/resumes/old.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
    sha256: "old-hash",
    visibility: "PUBLIC",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

function repository(initial: ResumeFileRecord[] = []) {
  const records = [...initial];
  const events: string[] = [];
  return {
    records,
    events,
    source: {
      async listFiles() { return [...records]; },
      async findByLocale(locale: "ZH" | "EN") { return records.find((item) => item.locale === locale) ?? null; },
      async findById(id: string) { return records.find((item) => item.id === id) ?? null; },
      async createFile(value: Omit<ResumeFileRecord, "id" | "createdAt" | "updatedAt">) {
        events.push(`create:${value.locale}`);
        const created = record({ ...value, id: `resume-${value.locale.toLowerCase()}` });
        records.push(created);
        return created;
      },
      async updateFile(id: string, value: Partial<ResumeFileRecord>) {
        events.push(`update:${id}`);
        const index = records.findIndex((item) => item.id === id);
        records[index] = { ...records[index], ...value, updatedAt: new Date("2026-09-02T00:00:00.000Z") };
        return records[index];
      },
      async deleteFile(id: string) {
        events.push(`delete:${id}`);
        const index = records.findIndex((item) => item.id === id);
        const [deleted] = records.splice(index, 1);
        return deleted;
      },
    },
  };
}

describe("resume PDF validation", () => {
  it("accepts a genuine PDF and rejects spoofed, wrongly named, and oversized files", () => {
    expect(validateResumePdf({ bytes: pdfBytes, mimeType: "application/pdf", filename: "resume.pdf" }))
      .toMatchObject({ sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(() => validateResumePdf({ bytes: new Uint8Array([1, 2, 3]), mimeType: "application/pdf", filename: "resume.pdf" }))
      .toThrow("文件内容不是有效的 PDF");
    expect(() => validateResumePdf({ bytes: pdfBytes, mimeType: "text/plain", filename: "resume.pdf" }))
      .toThrow("仅支持 PDF 文件");
    expect(() => validateResumePdf({ bytes: pdfBytes, mimeType: "application/pdf", filename: "resume.txt" }))
      .toThrow("文件扩展名必须为 .pdf");
    expect(() => validateResumePdf({ bytes: pdfBytes, mimeType: "application/pdf", filename: "resume.pdf", maxBytes: 4 }))
      .toThrow("PDF 大小超过限制");
  });

  it("accepts only the two locale and visibility values", () => {
    expect(parseResumeLocale("ZH")).toBe("ZH");
    expect(parseResumeLocale("EN")).toBe("EN");
    expect(() => parseResumeLocale("FR")).toThrow("简历语言无效");
    expect(parseResumeVisibility("PRIVATE")).toBe("PRIVATE");
    expect(parseResumeVisibility("PUBLIC")).toBe("PUBLIC");
    expect(() => parseResumeVisibility("DRAFT")).toThrow("简历可见性无效");
  });
});

describe("resume file lifecycle", () => {
  it("creates a missing locale as private", async () => {
    const repo = repository();
    const stored: ResumeStoredFile = {
      originalFilename: "resume.pdf",
      storagePath: "C:/uploads/resumes/new.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      sha256: "new-hash",
    };
    const service = createResumeFileService(repo.source, async () => {}, async () => stored);

    await expect(service.upload("ZH", pdf())).resolves.toMatchObject({
      locale: "ZH",
      visibility: "PRIVATE",
      storagePath: stored.storagePath,
    });
    expect(repo.events).toEqual(["create:ZH"]);
  });

  it("replaces a locale while preserving identity and visibility, then removes only the old file", async () => {
    const current = record();
    const repo = repository([current]);
    const removed: string[] = [];
    const stored: ResumeStoredFile = {
      originalFilename: "new.pdf",
      storagePath: "C:/uploads/resumes/new.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      sha256: "new-hash",
    };
    const service = createResumeFileService(repo.source, async (path) => { removed.push(path); }, async () => stored);

    await expect(service.upload("ZH", pdf("new.pdf"))).resolves.toMatchObject({
      id: current.id,
      visibility: "PUBLIC",
      storagePath: stored.storagePath,
    });
    expect(repo.events).toEqual([`update:${current.id}`]);
    expect(removed).toEqual([current.storagePath]);
  });

  it("removes the newly stored file and preserves the current slot when a replacement update fails", async () => {
    const current = record();
    const removed: string[] = [];
    const repo = repository([current]);
    repo.source.updateFile = async () => { throw new Error("database unavailable"); };
    const stored: ResumeStoredFile = {
      originalFilename: "new.pdf",
      storagePath: "C:/uploads/resumes/new.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      sha256: "new-hash",
    };
    const service = createResumeFileService(repo.source, async (path) => { removed.push(path); }, async () => stored);

    await expect(service.upload("ZH", pdf("new.pdf"))).rejects.toThrow("database unavailable");
    expect(removed).toEqual([stored.storagePath]);
    expect(repo.records).toEqual([current]);
  });

  it("updates visibility and exposes only public locale records", async () => {
    const zh = record({ visibility: "PRIVATE" });
    const en = record({ id: "resume-en", locale: "EN", visibility: "PRIVATE" });
    const repo = repository([zh, en]);
    const service = createResumeFileService(repo.source);

    await expect(service.findPublic("ZH")).resolves.toBeNull();
    await expect(service.setVisibility(zh.id, "PUBLIC")).resolves.toMatchObject({ visibility: "PUBLIC" });
    await expect(service.findPublic("ZH")).resolves.toMatchObject({ id: zh.id });
    await expect(service.findPublic("EN")).resolves.toBeNull();
  });

  it("deletes the database record before removing the stored file", async () => {
    const current = record();
    const repo = repository([current]);
    const events = repo.events;
    const service = createResumeFileService(repo.source, async (path) => { events.push(`remove:${path}`); });

    await expect(service.delete(current.id)).resolves.toEqual({ id: current.id });
    expect(events).toEqual([`delete:${current.id}`, `remove:${current.storagePath}`]);
    expect(repo.records).toHaveLength(0);
  });
});
