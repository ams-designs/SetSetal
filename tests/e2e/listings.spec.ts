import { test, expect, expectScreen, mockListings } from "./fixtures";

const cart = {
  id: "8b0c7a52-3f1e-4f43-9a51-1c2d3e4f5a61",
  name: "Brikama Donkey Cart",
  vehicle_type: "donkey-cart",
  description: "Weekly household pickups.",
  phone: "+2207000001",
  whatsapp: "+2207000001",
  areas: ["brikama"],
  waste_types: ["household", "garden"],
  updated_at: "2026-10-26T12:00:00Z"
};
const van = {
  ...cart,
  id: "2f4e6a8c-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
  name: "Nyambai Van",
  vehicle_type: "small-van",
  description: "",
  phone: null,
  whatsapp: null
};

test("real listings replace the demonstrations, never mixed", async ({ page, context }) => {
  await mockListings(context, [cart, van]);
  await page.goto("./#/find");
  await expect(page.locator(".collector-card")).toHaveCount(2);
  await expect(page.locator("#results-count")).toHaveText("2 listings");
  await expect(page.getByText("Demonstration listing")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
});

test("a consented listing offers Call and WhatsApp", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await page.goto(`./#/collector/${cart.id}`);
  await expectScreen(page, "Collector profile");
  await expect(page.getByRole("link", { name: "Call Brikama Donkey Cart" })).toHaveAttribute("href", "tel:+2207000001");
  await expect(page.getByRole("link", { name: "Message Brikama Donkey Cart on WhatsApp" }))
    .toHaveAttribute("href", "https://wa.me/2207000001");
});

test("a listing without contact details shows no contact links", async ({ page, context }) => {
  await mockListings(context, [van]);
  await page.goto(`./#/collector/${van.id}`);
  await expect(page.getByText("No contact details yet")).toBeVisible();
  await expect(page.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(0);
});

test("a malformed phone number is never turned into a link", async ({ page, context }) => {
  await mockListings(context, [{ ...cart, phone: "javascript:alert(1)", whatsapp: "123" }]);
  await page.goto(`./#/collector/${cart.id}`);
  await expect(page.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(0);
});

test("listing text from the server is shown as text, never as HTML", async ({ page, context }) => {
  await mockListings(context, [{ ...cart, name: '<img src=x onerror="window.hacked=1">Cart' }]);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: '<img src=x onerror="window.hacked=1">Cart' })).toBeVisible();
  expect(await page.evaluate(() => (window as { hacked?: number }).hacked)).toBeUndefined();
});

test("a link to a listing that no longer exists falls back to the list", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await page.goto("./#/collector/demo-truck");
  await expectScreen(page, "Find a collector", "#/find");
});

test("the request uses the publishable key and asks only for public fields", async ({ page }) => {
  const request = page.waitForRequest(/public_collectors/);
  await page.goto("./#/find");
  const sent = await request;
  expect(sent.headers()["apikey"]).toMatch(/^sb_publishable_/);
  expect(sent.url()).not.toContain("owner");
  expect(sent.url()).toContain("order=name.asc");
});

test("if the server fails, the labelled demonstrations stay", async ({ page, context, consoleErrors }) => {
  await context.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("./#/find");
  await expect(page.locator(".collector-card")).toHaveCount(6);
  await expect(page.locator("#results-count")).toHaveText("6 demonstration listings");
  // The browser logs the failed request itself; nothing else may error.
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
});

test("saved listings still show offline", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await expect(page.getByText("Demonstration listing")).toHaveCount(0);
  await context.setOffline(false);
});

// Seeds the saved listings, then makes the server unreachable so only the
// saved copy can be shown.
async function withSavedListings(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext,
  saved: unknown) {
  await page.addInitScript((value) => localStorage.setItem("setsetal.listings.v2", JSON.stringify(value)), saved);
  await context.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 503, body: "" }));
}
const ignoreFailedRequest = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};
const hoursAgo = (hours: number) => Date.now() - hours * 60 * 60 * 1000;

test("saved listings say when they were saved", async ({ page, context, consoleErrors }) => {
  await withSavedListings(page, context, { savedAt: hoursAgo(2), rows: [cart] });
  await page.goto(`./#/collector/${cart.id}`);
  await expect(page.getByRole("link", { name: "Call Brikama Donkey Cart" })).toBeVisible();
  await expect(page.locator("#profile-content")).toContainText("Details may have changed.");
  ignoreFailedRequest(consoleErrors);
});

test("saved contact details are hidden after 48 hours", async ({ page, context, consoleErrors }) => {
  await withSavedListings(page, context, { savedAt: hoursAgo(49), rows: [cart] });
  await page.goto(`./#/collector/${cart.id}`);
  await expect(page.getByRole("heading", { level: 2, name: "Brikama Donkey Cart" })).toBeVisible();
  await expect(page.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(0);
  ignoreFailedRequest(consoleErrors);
});

test("saved listings older than 7 days are dropped", async ({ page, context, consoleErrors }) => {
  await withSavedListings(page, context, { savedAt: hoursAgo(24 * 8), rows: [cart] });
  await page.goto("./#/find");
  await expect(page.locator("#results-count")).toHaveText("6 demonstration listings");
  ignoreFailedRequest(consoleErrors);
});

test("a damaged saved copy doesn't leave Find loading", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("setsetal.listings.v2", '{"savedAt":"x","rows":{}}'));
  await page.goto("./#/find");
  await expect(page.locator("#results-count")).toHaveText("6 demonstration listings");
});

test("Help describes the listings that are actually shown", async ({ page, context }) => {
  await page.goto("./#/help");
  await expect(page.locator("#help-listings-note")).toContainText("demonstration examples");
  await mockListings(context, [cart]);
  await page.reload();
  await expect(page.locator("#help-listings-note")).toContainText("reviewed them");
});
