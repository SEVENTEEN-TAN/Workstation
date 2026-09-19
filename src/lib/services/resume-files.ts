import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ResumeFile as PrismaResumeFile } from "@prisma/client";

import { getDatabase } from "../db";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";

export type ResumeLocale = "ZH" | "EN";
export type ResumeVisibility = "PRIVATE" | "PUBLIC";

export type ResumeStoredFile = {
  originalFilename: string;
  storagePath: string;
  mimeType: typeof PDF_MIME;
  sizeBytes: number;
  sha256: string;
};

export type ResumeFileRecord = ResumeStoredFile & {
  id: string;
  locale: ResumeLocale;
  visibility: ResumeVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type ResumeFileData = Omit<ResumeFileRecord, "storagePath" | "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type ResumeFileCreateData = ResumeStoredFile & {
  locale: ResumeLocale;
  visibility: ResumeVisibility;
};

export type ResumeFileRepository = {
  listFiles(): Promise<ResumeFileRecord[]>;
  findByLocale(locale: ResumeLocale): Promise<ResumeFileRecord | null>;
  findById(id: string): Promise<ResumeFileRecord | null>;
  createFile(value: ResumeFileCreateData): Promise<ResumeFileRecord>;
  updateFile(id: string, value: Partial<ResumeStoredFile> & { visibility?: ResumeVisibility }): Promise<ResumeFileRecord>;
  deleteFile(id: string): Promise<unknown>;
};

export function parseResumeLocale(value: unknown): ResumeLocale {
  if (value !== "ZH" && value !== "EN") throw new Error("简历语言无效");
  return value;
}

export function parseResumeVisibility(value: unknown): ResumeVisibility {
  if (value !== "PRIVATE" && value !== "PUBLIC") throw new Error("简历可见性无效");
  return value;
}

function parseResumeFileRecord(record: PrismaResumeFile): ResumeFileRecord {
  if (record.mimeType !== PDF_MIME) throw new Error("简历文件类型无效");
  return {
    ...record,
    locale: parseResumeLocale(record.locale),
    visibility: parseResumeVisibility(record.visibility),
    mimeType: PDF_MIME,
  };
}

export function validateResumePdf(input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  maxBytes?: number;
}) {
  if (input.bytes.byteLength > (input.maxBytes ?? MAX_RESUME_BYTES)) throw new Error("PDF 大小超过限制");
  if (input.mimeType !== PDF_MIME) throw new Error("仅支持 PDF 文件");
  if (extname(input.filename).toLowerCase() !== ".pdf") throw new Error("文件扩展名必须为 .pdf");
  if (input.bytes.length < 5 || new TextDecoder().decode(input.bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("文件内容不是有效的 PDF");
  }
  return { sha256: createHash("sha256").update(input.bytes).digest("hex") };
}

export function getResumeUploadRoot() {
  if (process.env.RESUME_UPLOAD_DIR) return resolve(process.env.RESUME_UPLOAD_DIR);
  const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? resolve(process.cwd(), "data", "uploads"));
  return resolve(uploadRoot, "resumes");
}

export function resolveResumeStoragePath(storagePath: string) {
  const root = getResumeUploadRoot();
  const resolved = resolve(storagePath);
  if (!resolved.startsWith(`${root}${sep}`)) throw new Error("无效的简历文件路径");
  return resolved;
}

async function writeResumeFile(file: File): Promise<ResumeStoredFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { sha256 } = validateResumePdf({ bytes, mimeType: file.type, filename: file.name });
  const root = getResumeUploadRoot();
  await mkdir(root, { recursive: true });
  const storagePath = resolve(root, `${randomUUID()}.pdf`);
  resolveResumeStoragePath(storagePath);
  await writeFile(storagePath, bytes, { flag: "wx" });
  return {
    originalFilename: file.name,
    storagePath,
    mimeType: PDF_MIME,
    sizeBytes: bytes.byteLength,
    sha256,
  };
}

async function removeResumeFile(storagePath: string) {
  await rm(resolveResumeStoragePath(storagePath), { force: true });
}

function notFound() {
  return new Response(JSON.stringify({ error: "简历文件不存在" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export function createResumeFileService(
  repository: ResumeFileRepository,
  removeFile: (path: string) => Promise<void> = removeResumeFile,
  storeFile: (file: File) => Promise<ResumeStoredFile> = writeResumeFile,
) {
  const toAdminFile = (file: ResumeFileRecord): ResumeFileData => {
    return {
      id: file.id,
      locale: file.locale,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      visibility: file.visibility,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  };

  return {
    async list() {
      return (await repository.listFiles())
        .sort((left, right) => left.locale.localeCompare(right.locale))
        .map(toAdminFile);
    },
    async upload(localeInput: unknown, file: File) {
      const locale = parseResumeLocale(localeInput);
      const current = await repository.findByLocale(locale);
      const stored = await storeFile(file);
      let saved: ResumeFileRecord;
      try {
        saved = current
          ? await repository.updateFile(current.id, stored)
          : await repository.createFile({ ...stored, locale, visibility: "PRIVATE" });
      } catch (error) {
        try { await removeFile(stored.storagePath); } catch { /* Preserve the database failure. */ }
        throw error;
      }

      if (current && current.storagePath !== stored.storagePath) {
        try { await removeFile(current.storagePath); } catch { /* The new record is already authoritative. */ }
      }
      return saved;
    },
    async setVisibility(id: string, visibilityInput: unknown) {
      const visibility = parseResumeVisibility(visibilityInput);
      if (!await repository.findById(id)) throw notFound();
      return repository.updateFile(id, { visibility });
    },
    async delete(id: string) {
      const current = await repository.findById(id);
      if (!current) throw notFound();
      await repository.deleteFile(id);
      try { await removeFile(current.storagePath); } catch { /* The deleted record remains authoritative. */ }
      return { id };
    },
    async findPublic(localeInput: unknown) {
      const locale = parseResumeLocale(localeInput);
      const record = await repository.findByLocale(locale);
      return record?.visibility === "PUBLIC" ? record : null;
    },
  };
}

export async function getResumeFileService() {
  const database = await getDatabase();
  return createResumeFileService({
    listFiles: async () => (await database.resumeFile.findMany()).map(parseResumeFileRecord),
    findByLocale: async (locale) => {
      const record = await database.resumeFile.findUnique({ where: { locale } });
      return record ? parseResumeFileRecord(record) : null;
    },
    findById: async (id) => {
      const record = await database.resumeFile.findUnique({ where: { id } });
      return record ? parseResumeFileRecord(record) : null;
    },
    createFile: async (value) => parseResumeFileRecord(await database.resumeFile.create({ data: value })),
    updateFile: async (id, value) => parseResumeFileRecord(await database.resumeFile.update({ where: { id }, data: value })),
    deleteFile: (id) => database.resumeFile.delete({ where: { id } }),
  });
}
