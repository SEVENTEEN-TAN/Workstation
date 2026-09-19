import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { getDatabase } from "../db";

const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

const SITE_VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "历史版本",
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

type UploadValidationInput = { bytes: Uint8Array; mimeType: string; filename: string; maxBytes?: number };
type AssetAltTextInput = { altTextZh?: unknown; altTextEn?: unknown };
type SiteVersionSource = { id: string; version: number; status: string; content: unknown };
type KnowledgeDraftAttachmentSource = { draftId: string; draftTitle: string; target: string; assetId: string };
type StoredAsset = { id: string; storagePath: string };
type AssetFileData = {
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  width: null;
  height: null;
  sizeBytes: number;
  sha256: string;
};

export type AssetReferenceData = {
  source: "SITE_VERSION" | "KNOWLEDGE_DRAFT";
  versionId: string;
  version: number | null;
  status: string;
  path: string;
  label: string;
};

export type AssetData = {
  id: string;
  originalFilename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  sha256: string;
  altTextZh: string | null;
  altTextEn: string | null;
  isReferenced: boolean;
  references: AssetReferenceData[];
  createdAt: string;
};

type AssetRecord = {
  id: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  sha256: string;
  altTextZh: string | null;
  altTextEn: string | null;
  isReferenced?: boolean;
  createdAt: Date;
};

type AssetLibraryRepository<TAsset extends AssetRecord> = {
  listAssets(): Promise<TAsset[]>;
  listSiteVersions(): Promise<SiteVersionSource[]>;
  listKnowledgeDraftAttachments(): Promise<KnowledgeDraftAttachmentSource[]>;
  findAsset(id: string): Promise<StoredAsset | null>;
  updateAsset(id: string, data: AssetFileData): Promise<TAsset>;
  deleteAsset(id: string): Promise<unknown>;
};

function normalizeAltText(value: unknown) {
  if (value !== undefined && value !== null && typeof value !== "string") throw new Error("替代文本必须是字符串");
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > 500) throw new Error("替代文本不能超过 500 个字符");
  return normalized || null;
}

export function normalizeAssetAltText(input: AssetAltTextInput) {
  return {
    altTextZh: normalizeAltText(input.altTextZh),
    altTextEn: normalizeAltText(input.altTextEn),
  };
}

export function findAssetReferences(assetId: string, versions: SiteVersionSource[]) {
  const target = `/api/assets/${assetId}`;
  const references: AssetReferenceData[] = [];

  function visit(value: unknown, path: Array<string | number>, version: SiteVersionSource) {
    if (value === target) {
      references.push({
        source: "SITE_VERSION",
        versionId: version.id,
        version: version.version,
        status: version.status,
        path: path.join("."),
        label: `版本 ${version.version} · ${SITE_VERSION_STATUS_LABELS[version.status] ?? version.status}`,
      });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index], version));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => visit(item, [...path, key], version));
    }
  }

  versions.forEach((version) => visit(version.content, [], version));
  return references.sort((left, right) => {
    const versionOrder = (right.version ?? 0) - (left.version ?? 0);
    if (versionOrder) return versionOrder;
    const leftLocale = left.path.startsWith("zh.") ? 0 : 1;
    const rightLocale = right.path.startsWith("zh.") ? 0 : 1;
    return leftLocale - rightLocale || left.path.localeCompare(right.path);
  });
}

export function findKnowledgeDraftAssetReferences(assetId: string, attachments: KnowledgeDraftAttachmentSource[]) {
  return attachments.filter((attachment) => attachment.assetId === assetId).map((attachment) => ({
    source: "KNOWLEDGE_DRAFT" as const,
    versionId: attachment.draftId,
    version: null,
    status: "DRAFT",
    path: `knowledge.attachments.${attachment.target}`,
    label: `知识发布草稿 · ${attachment.draftTitle}`,
  }));
}

export function createAssetLibraryService<TAsset extends AssetRecord>(
  repository: AssetLibraryRepository<TAsset>,
  removeFile: (path: string) => Promise<void> = (path) => rm(path, { force: true }),
  storeFile: (file: File) => Promise<AssetFileData> = writeImageFile,
) {
  return {
    async list(): Promise<AssetData[]> {
      const [assets, versions, draftAttachments] = await Promise.all([
        repository.listAssets(),
        repository.listSiteVersions(),
        repository.listKnowledgeDraftAttachments(),
      ]);
      return assets.map((asset) => {
        const references = [
          ...findAssetReferences(asset.id, versions),
          ...findKnowledgeDraftAssetReferences(asset.id, draftAttachments),
        ];
        return {
          id: asset.id,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          sizeBytes: asset.sizeBytes,
          sha256: asset.sha256,
          altTextZh: asset.altTextZh,
          altTextEn: asset.altTextEn,
          isReferenced: references.length > 0,
          references,
          createdAt: asset.createdAt.toISOString(),
        };
      });
    },
    async delete(id: string) {
      const [asset, versions, draftAttachments] = await Promise.all([
        repository.findAsset(id),
        repository.listSiteVersions(),
        repository.listKnowledgeDraftAttachments(),
      ]);
      if (!asset) {
        throw new Response(JSON.stringify({ error: "媒体资源不存在" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      const references = [
        ...findAssetReferences(id, versions),
        ...findKnowledgeDraftAssetReferences(id, draftAttachments),
      ];
      if (references.length) {
        throw new Response(JSON.stringify({ error: "媒体资源仍被内容版本引用，无法删除", references }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      await repository.deleteAsset(id);
      await removeFile(asset.storagePath);
      return { id };
    },
    async replace(id: string, file: File) {
      const asset = await repository.findAsset(id);
      if (!asset) {
        throw new Response(JSON.stringify({ error: "媒体资源不存在" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      const previousStoragePath = asset.storagePath;
      const stored = await storeFile(file);
      let updated: TAsset;
      try {
        updated = await repository.updateAsset(id, stored);
      } catch (error) {
        try {
          await removeFile(stored.storagePath);
        } catch {
          // Preserve the database failure; the new file is not referenced.
        }
        throw error;
      }

      try {
        await removeFile(previousStoragePath);
      } catch {
        // The replacement is already live; an orphan is safer than a broken reference.
      }
      return updated;
    },
  };
}

export async function getAssetLibraryService() {
  const database = await getDatabase();
  return createAssetLibraryService({
    listAssets: () => database.asset.findMany({ orderBy: { createdAt: "desc" } }),
    listSiteVersions: () => database.siteVersion.findMany({
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, content: true },
    }),
    listKnowledgeDraftAttachments: () => database.knowledgePublicationDraftAttachment.findMany({
      select: {
        draftId: true,
        target: true,
        assetId: true,
        draft: { select: { title: true } },
      },
    }).then((attachments) => attachments.map(({ draft, ...attachment }) => ({ ...attachment, draftTitle: draft.title }))),
    findAsset: (id) => database.asset.findUnique({ where: { id }, select: { id: true, storagePath: true } }),
    updateAsset: (id, data) => database.asset.update({ where: { id }, data }),
    deleteAsset: (id) => database.asset.delete({ where: { id } }),
  });
}

function hasImageSignature(bytes: Uint8Array, mimeType: keyof typeof MIME_EXTENSIONS) {
  if (mimeType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

export function validateImageUpload(input: UploadValidationInput) {
  const maxBytes = input.maxBytes ?? MAX_UPLOAD_BYTES;
  if (input.bytes.byteLength > maxBytes) throw new Error("图片大小超过限制");
  if (!(input.mimeType in MIME_EXTENSIONS)) throw new Error("仅支持 PNG、JPEG 和 WebP 图片");
  const mimeType = input.mimeType as keyof typeof MIME_EXTENSIONS;
  if (!hasImageSignature(input.bytes, mimeType)) throw new Error("文件内容与图片类型不匹配");
  const extension = MIME_EXTENSIONS[mimeType];
  const suppliedExtension = extname(input.filename).slice(1).toLowerCase();
  if (suppliedExtension && !([extension, ...(extension === "jpg" ? ["jpeg"] : [])] as string[]).includes(suppliedExtension)) {
    throw new Error("文件扩展名与图片类型不匹配");
  }
  return { extension, sha256: createHash("sha256").update(input.bytes).digest("hex") };
}

async function writeImageFile(file: File): Promise<AssetFileData> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateImageUpload({ bytes, mimeType: file.type, filename: file.name });
  const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? resolve(process.cwd(), "data", "uploads"));
  await mkdir(uploadRoot, { recursive: true });
  const filename = `${randomUUID()}.${validated.extension}`;
  const destination = resolve(uploadRoot, filename);
  if (!destination.startsWith(`${uploadRoot}${sep}`)) throw new Error("无效的上传路径");
  await writeFile(destination, bytes, { flag: "wx" });
  return {
    originalFilename: file.name,
    storagePath: destination,
    mimeType: file.type,
    width: null,
    height: null,
    sizeBytes: bytes.byteLength,
    sha256: validated.sha256,
  };
}

export async function saveImageAsset(file: File, altTextZh?: string, altTextEn?: string) {
  const stored = await writeImageFile(file);
  const database = await getDatabase();
  const altText = normalizeAssetAltText({ altTextZh, altTextEn });
  return database.asset.create({
    data: {
      ...stored,
      ...altText,
    },
  });
}

export async function updateAssetAltText(id: string, input: AssetAltTextInput) {
  const database = await getDatabase();
  if (!await database.asset.findUnique({ where: { id }, select: { id: true } })) {
    throw new Response(JSON.stringify({ error: "媒体资源不存在" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return database.asset.update({ where: { id }, data: normalizeAssetAltText(input) });
}
