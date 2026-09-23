export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function convertedActivityHref(draft: { status: string; convertedActivityId: unknown }): string | null {
  if (draft.status !== "CONVERTED" || typeof draft.convertedActivityId !== "string") return null;
  const id = draft.convertedActivityId.trim();
  return id && id.length <= 128 ? `/admin/activities?activity=${encodeURIComponent(id)}` : null;
}

export function dateValue(value: FormDataEntryValue | null): string | null {
  return value ? new Date(String(value)).toISOString() : null;
}

export function editableRecord(record: object): Record<string, unknown> {
  const excluded = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "cycle",
    "objective",
    "objectives",
    "keyResults",
    "reviews",
    "progressUpdates",
  ]);

  return Object.fromEntries(Object.entries(record).filter(([key]) => !excluded.has(key)));
}
