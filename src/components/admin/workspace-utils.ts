export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
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
