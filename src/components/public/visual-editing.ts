import { getVisualEditField } from "../admin/home/visual-editor-protocol";
import {
  homepageEmailSchema,
  homepageGithubUrlSchema,
  type SiteContent,
} from "../../lib/content/schema";

export function startPreviewReadyRetry(postReady: () => void) {
  postReady();
  const interval = setInterval(postReady, 250);
  return () => clearInterval(interval);
}

export function editableTextProps(enabled: boolean, path: string) {
  return enabled ? {
    "data-cms-path": path,
    contentEditable: true,
    suppressContentEditableWarning: true,
    tabIndex: 0,
  } as const : {};
}

export function selectableFieldProps(enabled: boolean, path: string) {
  return enabled ? {
    "data-cms-path": path,
    role: "button" as const,
    tabIndex: 0,
  } : {};
}

export function createTextCommit(
  content: SiteContent,
  path: unknown,
  value: string,
  composing: boolean,
) {
  const field = getVisualEditField(content, path);
  if (composing || !field || field.kind !== "text" || value.length > 10_000) return null;
  return { type: "homepage-editor:commit" as const, path: field.path, value };
}

export function safeEditorLinkTarget(kind: "email" | "github", value: string) {
  if (kind === "email") {
    const parsed = homepageEmailSchema.safeParse(value);
    return parsed.success ? `mailto:${parsed.data}` : undefined;
  }
  const parsed = homepageGithubUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
