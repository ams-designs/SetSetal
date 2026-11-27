import AxeBuilder from "@axe-core/playwright";
import { test, expect, mockCollectorBackend, signIn } from "./fixtures";

for (const hash of ["#/", "#/find", "#/collector/demo-van", "#/join", "#/help", "#/privacy", "#/admin"]) {
  test(`no serious or critical axe violations on ${hash}`, async ({ page }) => {
    await page.goto("./" + hash);
    await expect(page.locator("body.ready")).toBeVisible();
    // The whole page: the header and bottom nav are on every screen too.
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    expect(serious).toEqual([]);
  });
}

const serious = async (page: import("@playwright/test").Page) => (await new AxeBuilder({ page }).analyze()).violations
  .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
  .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);

test("no serious axe violations when a report shows an error", async ({ page }) => {
  await page.goto("./#/help");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Choose what happened.")).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("no serious axe violations when a Join step shows an error", async ({ page, context }) => {
  await signIn(page);
  await mockCollectorBackend(context);
  await page.goto("./#/join");
  await page.getByLabel("Name or business name").fill("Fatou");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose your vehicle.")).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("touch targets are at least 56px", async ({ page }) => {
  await page.goto("./#/find");
  // The screen slides in, so measure once it has settled.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const small = await page.locator(".screen.active button, .bottom-nav button, .topbar button").evaluateAll((buttons) =>
    buttons
      .filter((button) => (button as HTMLElement).offsetParent !== null)
      // A card's name button stretches over the whole card top: that is its tap area.
      .map((button) => ({
        text: button.textContent?.trim() || button.getAttribute("aria-label"),
        box: (button.closest(".card-head") ?? button).getBoundingClientRect()
      }))
      .filter(({ box }) => box.height < 56 || box.width < 56)
      .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`));
  expect(small).toEqual([]);
});
