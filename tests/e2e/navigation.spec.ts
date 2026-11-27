import { test, expect, expectScreen, nav } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("home buttons open the right screens", async ({ page }) => {
  await page.getByRole("button", { name: "I need a collector" }).click();
  await expectScreen(page, "Find a collector", "#/find");
  await page.goBack();
  await page.getByRole("button", { name: "I collect waste" }).click();
  await expectScreen(page, "Register your service", "#/join");
  await nav(page).getByRole("button", { name: "Help" }).click();
  await expectScreen(page, "Help and feedback", "#/help");
  await nav(page).getByRole("button", { name: "Home" }).click();
  await expectScreen(page, "Find someone to take your rubbish away.", "#/");
});

test("in-app back returns one screen at a time", async ({ page }) => {
  await page.getByRole("button", { name: "I need a collector" }).click();
  await page.locator(".card-link").first().click();
  await expectScreen(page, "Collector profile", "#/collector/demo-municipal");

  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Find a collector", "#/find");
  // Find is a main tab: it has no back arrow; the phone's back goes home.
  await expect(page.locator(".screen.active").getByRole("button", { name: "Go back" })).toHaveCount(0);
  await page.goBack();
  await expectScreen(page, "Find someone to take your rubbish away.", "#/");
});

test("browser back (Android hardware back) returns one screen at a time", async ({ page }) => {
  await page.getByRole("button", { name: "I need a collector" }).click();
  await page.locator(".card-link").nth(1).click();
  await expectScreen(page, "Collector profile", "#/collector/demo-truck");

  await page.goBack();
  await expectScreen(page, "Find a collector", "#/find");
  await page.goBack();
  await expectScreen(page, "Find someone to take your rubbish away.", "#/");

  await page.goForward();
  await page.goForward();
  await expectScreen(page, "Collector profile", "#/collector/demo-truck");
  await expect(page.getByRole("heading", { level: 2, name: "Local truck collection" })).toBeVisible();
});

test("going back and forth does not grow the history stack", async ({ page }) => {
  const start = await page.evaluate(() => history.length);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "I need a collector" }).click();
    await page.locator(".card-link").first().click();
    await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
    await page.goBack();
    await expectScreen(page, "Find someone to take your rubbish away.");
  }
  // Each round visits Find and a profile; later rounds replace them instead of adding more.
  expect(await page.evaluate(() => history.length)).toBe(start + 2);
});

test("focus moves to the new screen's heading", async ({ page }) => {
  await page.getByRole("button", { name: "I need a collector" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Find a collector" })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Find someone to take your rubbish away." })).toBeFocused();
});

test("bottom nav marks the current section", async ({ page }) => {
  await page.getByRole("button", { name: "I need a collector" }).click();
  await page.locator(".card-link").first().click();
  await expect(nav(page).getByRole("button", { name: "Find" })).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("button", { name: "Home" })).not.toHaveAttribute("aria-current");
});
