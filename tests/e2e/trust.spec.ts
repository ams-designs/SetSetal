import { test, expect } from "./fixtures";

test("every sample listing is labelled as a demonstration", async ({ page }) => {
  await page.goto("./#/find");
  const cards = page.locator(".collector-card");
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await expect(card.getByText("Demonstration listing")).toBeVisible();
  }
  await page.goto("./#/collector/demo-van");
  await expect(page.locator("#profile-content").getByText("Demonstration listing")).toBeVisible();
});

test("demo listings have no call or WhatsApp links", async ({ page }) => {
  for (const hash of ["#/find", "#/collector/demo-municipal", "#/collector/demo-horse"]) {
    await page.goto("./" + hash);
    await expect(page.locator('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
  }
});

test("no screen claims a listing is verified, licensed or official", async ({ page }) => {
  for (const hash of ["#/", "#/find", "#/collector/demo-municipal", "#/help", "#/admin"]) {
    await page.goto("./" + hash);
    // Sample descriptions may describe the kind of service; labels must not.
    const labels = await page.locator(".demo-label, .notice, .trust-strip").allInnerTexts();
    expect(labels.join(" ")).not.toMatch(/\b(verified|licensed|official)\b/i);
  }
});
