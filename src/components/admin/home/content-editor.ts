import {
  siteContentSchema,
  type LocalizedSiteContent,
  type SiteContent,
} from "../../../lib/content/schema";
import { getVisualEditField } from "./visual-editor-protocol";

export type SiteLocale = "zh" | "en";

export const SITE_SECTION_IDS = [
  "meta",
  "nav",
  "hero",
  "about",
  "works",
  "services",
  "footer",
  "projects",
] as const satisfies readonly (keyof LocalizedSiteContent)[];

export type SiteSectionId = (typeof SITE_SECTION_IDS)[number];

export type ContentPath = readonly (string | number)[];

export type SiteContentValidation = {
  valid: boolean;
  fieldErrors: Record<string, string>;
  sectionErrorCounts: Record<string, number>;
  errorCount: number;
};

function updateValueAtPath(
  current: unknown,
  path: ContentPath,
  value: unknown,
): unknown {
  const [segment, ...remainingPath] = path;
  const clone = Array.isArray(current)
    ? [...current]
    : { ...(current as Record<string, unknown>) };
  const container = clone as Record<string | number, unknown>;

  container[segment] = remainingPath.length
    ? updateValueAtPath(container[segment], remainingPath, value)
    : value;

  return clone;
}

export function updateContentAtPath(
  content: SiteContent,
  path: ContentPath,
  value: unknown,
): SiteContent {
  if (path.length === 0) {
    throw new Error("Content update path cannot be empty");
  }

  return updateValueAtPath(content, path, value) as SiteContent;
}

export function updateVisualContent(content: SiteContent, path: string, value: string): SiteContent {
  if (!getVisualEditField(content, path)) throw new Error("Field is not editable");
  return updateContentAtPath(content, path.split("."), value);
}

export function updateHomepageProjectSelection(
  content: SiteContent,
  selectedProjectIds: string[],
): SiteContent {
  return { ...content, selectedProjectIds };
}

export function moveHomepageProjectSelection(
  content: SiteContent,
  index: number,
  direction: "up" | "down",
): SiteContent {
  const selectedProjectIds = content.selectedProjectIds ?? [];
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= selectedProjectIds.length) return content;

  const nextIds = [...selectedProjectIds];
  [nextIds[index], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[index]];
  return updateHomepageProjectSelection(content, nextIds);
}

export function validateSiteContent(content: unknown): SiteContentValidation {
  const result = siteContentSchema.safeParse(content);
  if (result.success) {
    return {
      valid: true,
      fieldErrors: {},
      sectionErrorCounts: {},
      errorCount: 0,
    };
  }

  const fieldErrors: Record<string, string> = {};
  const sectionErrorCounts: Record<string, number> = {};

  for (const issue of result.error.issues) {
    const fieldPath = issue.path.map(String).join(".");
    fieldErrors[fieldPath] ??= issue.message;

    const [locale, section] = issue.path;
    if (
      (locale === "zh" || locale === "en") &&
      typeof section === "string" &&
      SITE_SECTION_IDS.includes(section as SiteSectionId)
    ) {
      const sectionPath = `${locale}.${section}`;
      sectionErrorCounts[sectionPath] = (sectionErrorCounts[sectionPath] ?? 0) + 1;
    }
  }

  return {
    valid: false,
    fieldErrors,
    sectionErrorCounts,
    errorCount: result.error.issues.length,
  };
}

export function isSiteContentDirty(
  content: SiteContent,
  savedContent: SiteContent,
): boolean {
  return JSON.stringify(content) !== JSON.stringify(savedContent);
}
