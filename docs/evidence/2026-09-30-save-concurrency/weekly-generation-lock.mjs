import assert from "node:assert/strict";

// Run against an authenticated Playwright page backed by an isolated test database.
// The page must contain at least one editable weekly draft with no recovery copy.
export async function verifyWeeklyGenerationLock(page, screenshotPath) {
  await page.goto(new URL("/admin/weekly", page.url()).href);
  await page.getByRole("button", { name: "编辑", exact: true }).first().click();
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value() { throw new DOMException("Proof: storage unavailable", "QuotaExceededError"); },
    });
  });
  const title = page.locator('input[name="titleZh"]');
  const originalTitle = await title.inputValue();
  await page.locator('input[name="weekStart"]').fill("2040-01-16");
  await page.locator('input[name="weekEnd"]').fill("2040-01-22");
  let release;
  let reached;
  const waiting = new Promise((resolve) => { reached = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/admin/weekly", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "生成或打开周报", exact: true }).click();
    await waiting;
    assert.equal(await title.isDisabled(), true, "Generation must lock existing draft input");
    assert.equal(await title.inputValue(), originalTitle);
    for (const name of ["取消", "保存草稿", "生成 AI 候选"]) {
      assert.equal(await page.getByRole("button", { name, exact: true }).isDisabled(), true, name);
    }
    for (const name of ["编辑", "转为私有职业动态"]) {
      const buttons = page.getByRole("button", { name, exact: true });
      assert.ok(await buttons.count() > 0);
      assert.equal(await buttons.evaluateAll((items) => items.every((item) => item.disabled)), true, name);
    }
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    release();
    await page.getByText(/已生成新的私有周报草稿。|已打开这一周的现有草稿/).waitFor();
    assert.equal(await title.isEnabled(), true, "Input must unlock after generation");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
  }
}
