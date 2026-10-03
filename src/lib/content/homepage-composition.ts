export function selectHomepageRecords<T extends { id: string }>(records: T[], ids?: string[]): T[] {
  if (ids === undefined) return records;
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => { const record = byId.get(id); return record ? [record] : []; });
}
