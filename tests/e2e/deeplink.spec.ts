import { test, expect, expectScreen } from "./fixtures";

test("a cold load of #/collector/<id> opens that profile", async ({ page }) => {
  await page.goto("./#/collector/demo-truck");
  await expectScreen(page, "Collector profile", "#/collector/demo-truck");
  await expect(page.getByRole("heading", { level: 2, name: "Local truck collection" })).toBeVisible();
});

test("back from a deep link goes home, not out of the app", async ({ page }) => {
  await page.goto("./#/collector/demo-horse");
  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Find the right waste collector near you.", "#/");
});

test("every screen has its own URL", async ({ page }) => {
  for (const [hash, heading] of [
    ["#/find", "Find a collector"],
    ["#/join", "Register your service"],
    ["#/help", "Help and feedback"],
    ["#/admin", "Admin overview"]
  ]) {
    await page.goto("./" + hash);
    await expectScreen(page, heading, hash);
  }
});

test("an unknown collector falls back to the list", async ({ page }) => {
  await page.goto("./#/collector/not-a-real-id");
  await expectScreen(page, "Find a collector", "#/find");
});

test("the preview without a draft falls back to the form", async ({ page }) => {
  await page.goto("./#/join/preview");
  await expectScreen(page, "Register your service", "#/join");
});

test("reload keeps the screen and back still works", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Find a collector" }).click();
  await page.getByRole("button", { name: "View details" }).first().click();
  await page.reload();
  await expectScreen(page, "Collector profile", "#/collector/demo-municipal");
  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Find a collector", "#/find");
});
