import assert from "node:assert/strict";

// Use an authenticated page, isolated test vault, and two indexed notes with distinct body text.
export async function verifyKnowledgeNoteSelection(page, { url, firstPath, firstLabel, secondLabel, firstBody, secondBody, screenshotPath }) {
  let release;
  let reached;
  const waiting = new Promise((resolve) => { reached = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const endpoint = "**/api/admin/knowledge/vaults/*/notes?*";
  await page.route(endpoint, async (route) => {
    if (new URL(route.request().url()).searchParams.get("path") !== firstPath) return route.continue();
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto(url);
    if (firstLabel) await page.getByRole("button", { name: firstLabel, exact: true }).click();
    await waiting;
    await page.getByRole("button", { name: secondLabel, exact: true }).click();
    await page.getByText(secondBody, { exact: true }).waitFor();
    const returned = page.waitForResponse((response) => new URL(response.url()).searchParams.get("path") === firstPath);
    release();
    await returned;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(await page.getByText(firstBody, { exact: true }).count(), 0, "Late first-note response must not replace the selected note");
    assert.equal(await page.getByText(secondBody, { exact: true }).isVisible(), true);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
}
