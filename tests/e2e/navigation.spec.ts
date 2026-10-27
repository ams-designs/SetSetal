import { test, expect, expectScreen, nav } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("home buttons open the right screens", async ({ page }) => {
  await page.getByRole("button", { name: "Find a collector" }).click();
  await expectScreen(page, "Find a collector", "#/find");
  await page.goBack();
  await page.getByRole("button", { name: "Register as a collector" }).click();
  await expectScreen(page, "Register your service", "#/join");
  await page.getByRole("button", { name: "Open help" }).click();
  await expectScreen(page, "Help and feedback", "#/help");
  await nav(page).getByRole("button", { name: "Home" }).click();
  await expectScreen(page, "Find the right waste collector near you.", "#/");
});

test("in-app back returns one screen at a time", async ({ page }) => {
  await page.getByRole("button", { name: "Find a collector" }).click();
  await page.getByRole("button", { name: "View details" }).first().click();
  await expectScreen(page, "Collector profile", "#/collector/demo-municipal");

  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Find a collector", "#/find");
  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Find the right waste collector near you.", "#/");
});

test("browser back (Android hardware back) returns one screen at a time", async ({ page }) => {
  await page.getByRole("button", { name: "Find a collector" }).click();
  await page.getByRole("button", { name: "View details" }).nth(1).click();
  await expectScreen(page, "Collector profile", "#/collector/demo-truck");

  await page.goBack();
  await expectScreen(page, "Find a collector", "#/find");
  await page.goBack();
  await expectScreen(page, "Find the right waste collector near you.", "#/");

  await page.goForward();
  await page.goForward();
  await expectScreen(page, "Collector profile", "#/collector/demo-truck");
  await expect(page.getByRole("heading", { level: 2, name: "Local truck collection" })).toBeVisible();
});

test("going back and forth does not grow the history stack", async ({ page }) => {
  const start = await page.evaluate(() => history.length);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Find a collector" }).click();
    await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
    await expectScreen(page, "Find the right waste collector near you.");
  }
  expect(await page.evaluate(() => history.length)).toBe(start + 1);
});

test("focus moves to the new screen's heading", async ({ page }) => {
  await page.getByRole("button", { name: "Find a collector" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Find a collector" })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Find the right waste collector near you." })).toBeFocused();
});

test("bottom nav marks the current section", async ({ page }) => {
  await page.getByRole("button", { name: "Find a collector" }).click();
  await page.getByRole("button", { name: "View details" }).first().click();
  await expect(nav(page).getByRole("button", { name: "Find" })).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("button", { name: "Home" })).not.toHaveAttribute("aria-current");
});
