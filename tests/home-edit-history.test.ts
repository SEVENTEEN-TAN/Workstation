import { describe, expect, it } from "vitest";

import { createEditHistory, recordEdit, redoEdit, synchronizeEditHistory, undoEdit } from "../src/components/admin/home/edit-history";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import type { SiteContent } from "../src/lib/content/schema";

function content(title: string): SiteContent {
  return { ...bootstrapSiteContent, zh: { ...bootstrapSiteContent.zh, meta: { ...bootstrapSiteContent.zh.meta, title } } };
}

describe("homepage session edit history", () => {
  it("undoes and redoes whole snapshots without mutating previous history", () => {
    const initial = createEditHistory(content("Initial"));
    const edited = recordEdit(initial, content("Edited"));
    const undone = undoEdit(edited);
    expect(undone.present.zh.meta.title).toBe("Initial");
    expect(redoEdit(undone).present.zh.meta.title).toBe("Edited");
    expect(initial.present.zh.meta.title).toBe("Initial");
    expect(edited.present.zh.meta.title).toBe("Edited");
  });

  it("leaves empty undo and redo unchanged", () => {
    const initial = createEditHistory(content("Initial"));
    expect(undoEdit(initial)).toBe(initial);
    expect(redoEdit(initial)).toBe(initial);
  });

  it("clears redo when a different edit follows undo", () => {
    const edited = recordEdit(createEditHistory(content("Initial")), content("First"));
    const branched = recordEdit(undoEdit(edited), content("Second"));
    expect(redoEdit(branched).present.zh.meta.title).toBe("Second");
    expect(undoEdit(branched).present.zh.meta.title).toBe("Initial");
  });

  it("does not add steps or clear redo for equal snapshots", () => {
    const undone = undoEdit(recordEdit(createEditHistory(content("Initial")), content("Edited")));
    const unchanged = recordEdit(undone, structuredClone(undone.present));
    expect(unchanged).toBe(undone);
    expect(redoEdit(unchanged).present.zh.meta.title).toBe("Edited");
  });

  it("retains only the latest 100 undo steps", () => {
    let history = createEditHistory(content("0"));
    for (let index = 1; index <= 105; index++) history = recordEdit(history, content(String(index)));
    for (let index = 0; index < 100; index++) history = undoEdit(history);
    expect(history.present.zh.meta.title).toBe("5");
    expect(undoEdit(history)).toBe(history);
    expect(redoEdit(history).present.zh.meta.title).toBe("6");
  });

  it("keeps undo available after saved content is fetched without adding a step", () => {
    const submitted = content("Edited");
    const history = recordEdit(createEditHistory(content("Initial")), submitted);
    const fetched = synchronizeEditHistory(history, submitted, structuredClone(submitted));
    expect(fetched.present.zh.meta.title).toBe("Edited");
    expect(undoEdit(fetched).present.zh.meta.title).toBe("Initial");
    expect(undoEdit(undoEdit(fetched)).present.zh.meta.title).toBe("Initial");
  });

  it("accepts server normalization without adding an undo step", () => {
    const submitted = content("Edited");
    const history = recordEdit(createEditHistory(content("Initial")), submitted);
    const fetched = synchronizeEditHistory(history, submitted, content("Normalized"));
    expect(fetched.present.zh.meta.title).toBe("Normalized");
    expect(undoEdit(fetched).present.zh.meta.title).toBe("Initial");
    expect(redoEdit(undoEdit(fetched)).present.zh.meta.title).toBe("Normalized");
  });

  it("preserves edits and their history made while a save is in flight", () => {
    const submitted = content("Submitted");
    const history = recordEdit(recordEdit(createEditHistory(content("Initial")), submitted), content("Concurrent"));
    const fetched = synchronizeEditHistory(history, submitted, content("Server"));
    expect(fetched.present.zh.meta.title).toBe("Concurrent");
    expect(undoEdit(fetched).present.zh.meta.title).toBe("Submitted");
  });

  it("resets history when refresh or rollback replaces content", () => {
    const submitted = content("Edited");
    const history = recordEdit(createEditHistory(content("Initial")), submitted);
    const reset = synchronizeEditHistory(history, submitted, content("Restored"), true);
    expect(reset.present.zh.meta.title).toBe("Restored");
    expect(undoEdit(reset)).toBe(reset);
    expect(redoEdit(reset)).toBe(reset);
  });

  it("keeps concurrent input when refresh resets history", () => {
    const submitted = content("Submitted");
    const history = recordEdit(createEditHistory(submitted), content("Concurrent"));
    const reset = synchronizeEditHistory(history, submitted, content("Server"), true);
    expect(reset.present.zh.meta.title).toBe("Concurrent");
    expect(undoEdit(reset)).toBe(reset);
  });
});
