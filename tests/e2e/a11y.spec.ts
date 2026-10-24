import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

for (const hash of ["#/", "#/find", "#/collector/demo-van", "#/join", "#/help", "#/admin"]) {
  test(`no serious or critical axe violations on ${hash}`, async ({ page }) => {
    await page.goto("./" + hash);
    await expect(page.locator("body.ready")).toBeVisible();
    const results = await new AxeBuilder({ page }).include(".screen.active").analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    expect(serious).toEqual([]);
  });
}

test("touch targets are at least 48px", async ({ page }) => {
  await page.goto("./#/find");
  const small = await page.locator(".screen.active button, .bottom-nav button, .topbar button").evaluateAll((buttons) =>
    buttons
      .filter((button) => (button as HTMLElement).offsetParent !== null)
      .map((button) => ({ text: button.textContent?.trim() || button.getAttribute("aria-label"), box: button.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 48 || box.width < 48)
      .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`));
  expect(small).toEqual([]);
});
