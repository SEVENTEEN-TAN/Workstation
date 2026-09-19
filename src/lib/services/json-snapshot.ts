import { z } from "zod";

const jsonSnapshotSchema = z.record(z.string(), z.json());

export function parseJsonSnapshot(value: unknown) {
  return jsonSnapshotSchema.parse(JSON.parse(JSON.stringify(value)));
}
