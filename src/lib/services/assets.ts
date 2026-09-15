import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { getDatabase } from "../db";

const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

type UploadValidationInput = { bytes: Uint8Array; mimeType: string; filename: string; maxBytes?: number };

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

export async function saveImageAsset(file: File, altTextZh?: string, altTextEn?: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateImageUpload({ bytes, mimeType: file.type, filename: file.name });
  const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? resolve(process.cwd(), "data", "uploads"));
  await mkdir(uploadRoot, { recursive: true });
  const filename = `${randomUUID()}.${validated.extension}`;
  const destination = resolve(uploadRoot, filename);
  if (!destination.startsWith(`${uploadRoot}${sep}`)) throw new Error("无效的上传路径");
  await writeFile(destination, bytes, { flag: "wx" });
  const database = await getDatabase();
  return database.asset.create({
    data: {
      originalFilename: file.name,
      storagePath: destination,
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
      sha256: validated.sha256,
      altTextZh: altTextZh?.trim() || null,
      altTextEn: altTextEn?.trim() || null,
    },
  });
}
