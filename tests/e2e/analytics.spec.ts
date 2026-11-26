import { test, expect, mockListings, mockLookups, pickArea, pickVehicle, recordEvents } from "./fixtures";

const cart = {
  id: "8b0c7a52-3f1e-4f43-9a51-1c2d3e4f5a61", name: "Brikama Donkey Cart", vehicle_type: "donkey-cart",
  description: "", phone: "+2207000001", whatsapp: "+2207000001", areas: ["brikama"], waste_types: ["household"],
  available_today: false
};

// What a usage count may contain. Nothing here can identify a resident.
const ALLOWED = ["name", "area", "vehicle", "waste", "channel", "report_type", "collector_id"];

test("a search that finds nothing is counted once, with only the filter values", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }]);
  const events = await recordEvents(context);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await pickVehicle(page, "Horse cart");
  await expect(page.getByRole("heading", { name: "No matching listings" })).toBeVisible();
  // Tapping the same picture again is the same search.
  await pickVehicle(page, "Horse cart");
  await expect.poll(() => events).toEqual([{ name: "search_no_results", area: "all", vehicle: "horse-cart", waste: "all" }]);
});

test("the same empty search tried again after one that found listings is counted again", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }]);
  const events = await recordEvents(context);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await pickVehicle(page, "Horse cart");
  await expect(page.getByRole("heading", { name: "No matching listings" })).toBeVisible();
  await pickVehicle(page, "All");
  await expect(page.locator(".collector-card")).toHaveCount(1);
  await pickVehicle(page, "Horse cart");
  await expect(page.getByRole("heading", { name: "No matching listings" })).toBeVisible();
  const horse = { name: "search_no_results", area: "all", vehicle: "horse-cart", waste: "all" };
  await expect.poll(() => events).toEqual([horse, horse]);
});

test("a search that finds listings isn't counted", async ({ page, context }) => {
  await mockListings(context, [cart]);
  const events = await recordEvents(context);
  await page.goto("./#/find");
  await pickVehicle(page, "Donkey cart");
  await expect(page.locator(".collector-card")).toHaveCount(1);
  await page.waitForTimeout(300);
  expect(events).toEqual([]);
});

test("searches of the demonstration listings aren't counted", async ({ page, context }) => {
  const events = await recordEvents(context);
  await page.goto("./#/find");
  await pickArea(page, "My area isn't here");
  await expect(page.getByRole("heading", { name: "We don't have listings for your area yet" })).toBeVisible();
  expect(events).toEqual([]);
});

test("taps on Call and WhatsApp are counted for the listing, not the resident", async ({ page, context }) => {
  await mockListings(context, [cart]);
  const events = await recordEvents(context);
  await page.goto(`./#/collector/${cart.id}`);
  // Stop the links from leaving the page; the count is sent on the tap itself.
  await page.evaluate(() => document.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a[data-contact]")) event.preventDefault();
  }));
  await page.getByRole("link", { name: "Call Brikama Donkey Cart" }).click();
  await page.getByRole("link", { name: "Message Brikama Donkey Cart on WhatsApp" }).click();
  await expect.poll(() => events).toEqual([
    { name: "contact_tap", channel: "call", collector_id: cart.id },
    { name: "contact_tap", channel: "whatsapp", collector_id: cart.id }
  ]);
  for (const event of events) expect(Object.keys(event).every((key) => ALLOWED.includes(key))).toBe(true);
});

test("feedback is counted by type, without its text", async ({ page, context }) => {
  await mockListings(context, [cart]);
  const events = await recordEvents(context);
  await context.route(/\/rest\/v1\/reports/, (route) => route.fulfill({ status: 201, body: "" }));
  await page.goto(`./#/collector/${cart.id}`);
  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await page.getByLabel("Details").fill("The number is wrong, call me on 7654321");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Feedback sent")).toBeVisible();
  await expect.poll(() => events).toEqual([
    { name: "report_submitted", report_type: "incorrect-listing" },
    { name: "listing_marked_wrong", collector_id: cart.id }
  ]);
  expect(JSON.stringify(events)).not.toContain("7654321");
});

test("a safety report about a listing doesn't count as marking it wrong", async ({ page, context }) => {
  await mockListings(context, [cart]);
  const events = await recordEvents(context);
  await context.route(/\/rest\/v1\/reports/, (route) => route.fulfill({ status: 201, body: "" }));
  await page.goto(`./#/collector/${cart.id}`);
  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await page.getByLabel("What is this about?").selectOption({ label: "Safety concern" });
  await page.getByLabel("Details").fill("The cart blocks the road");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Feedback sent")).toBeVisible();
  await expect.poll(() => events).toEqual([{ name: "report_submitted", report_type: "safety" }]);
  await page.waitForTimeout(300);
  expect(events).toEqual([{ name: "report_submitted", report_type: "safety" }]);
});

test("a browser that asks not to be tracked isn't counted", async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "doNotTrack", { get: () => "1" }));
  await mockListings(context, [cart]);
  const events = await recordEvents(context);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await pickVehicle(page, "Horse cart");
  await expect(page.getByRole("heading", { name: "No matching listings" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(events).toEqual([]);
});

test("the app sets no cookies", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  expect(await context.cookies()).toEqual([]);
});
