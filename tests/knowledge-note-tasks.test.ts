import { describe, expect, it } from "vitest";

import { extractKnowledgeTasks } from "../src/lib/knowledge/note-tasks";

describe("Obsidian task extraction", () => {
  it("extracts task text and completion state without treating plain checklist text as an action", () => {
    expect(extractKnowledgeTasks("- [ ] Review JVM memory\n- [x] Publish notes\n- normal list")).toEqual([
      { title: "Review JVM memory", completed: false },
      { title: "Publish notes", completed: true },
    ]);
  });
});
