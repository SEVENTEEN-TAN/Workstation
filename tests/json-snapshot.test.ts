import { describe, expect, it } from "vitest";

import { parseJsonSnapshot } from "../src/lib/services/json-snapshot";

describe("JSON snapshots", () => {
  it("serializes database values into a plain JSON object", () => {
    const source = {
      id: "source-1",
      occurredAt: new Date("2026-09-19T08:00:00.000Z"),
      nested: { values: [1, "two", null, true] },
    };

    const snapshot = parseJsonSnapshot(source);

    expect(snapshot).toEqual({
      id: "source-1",
      occurredAt: "2026-09-19T08:00:00.000Z",
      nested: { values: [1, "two", null, true] },
    });
    expect(snapshot.nested).not.toBe(source.nested);
  });

  it("rejects snapshots that are not JSON objects", () => {
    expect(() => parseJsonSnapshot(["source-1"])).toThrow();
  });
});
