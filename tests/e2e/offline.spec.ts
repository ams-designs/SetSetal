import { test, expect, expectScreen, nav } from "./fixtures";

test("after the first load the app works offline", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expectScreen(page, "Find the right waste collector near you.");

  for (const [name, heading] of [["Find", "Find a collector"], ["Join", "Register your service"], ["Help", "Help and feedback"]]) {
    await nav(page).getByRole("button", { name }).click();
    await expectScreen(page, heading);
  }
  await page.goto("./#/collector/demo-van");
  await expect(page.getByRole("heading", { level: 2, name: "Small-load collection" })).toBeVisible();
  await context.setOffline(false);
});
