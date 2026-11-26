import { test, expect, areaTiles, mockListings, mockLookups, pickVehicle, vehicleChips } from "./fixtures";

const cart = {
  id: "8b0c7a52-3f1e-4f43-9a51-1c2d3e4f5a61", name: "Brikama Donkey Cart", vehicle_type: "donkey-cart",
  description: "", phone: null, whatsapp: null, areas: ["nyambai"], waste_types: ["household"], available_today: false
};

const options = (page: import("@playwright/test").Page, label: string) =>
  page.getByLabel(label).locator("option").allInnerTexts();

test("with real listings, the area filter offers the database's areas", async ({ page, context }) => {
  await mockListings(context, [cart]);
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }, { id: "nyambai", name: "Nyambai" }]);
  await page.goto("./#/find");
  await expect(page.getByRole("heading", { name: "Brikama Donkey Cart" })).toBeVisible();
  await expect.poll(() => areaTiles(page)).toEqual(["All areas", "Brikama", "Nyambai", "My area isn't here"]);
  // The listing shows the area's name, not its id.
  await expect(page.locator(".collector-card .card-area")).toHaveText("Nyambai");
});

test("demonstration listings keep their own sample towns", async ({ page, context }) => {
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }]);
  await page.goto("./#/find");
  await expect(page.locator(".collector-card")).toHaveCount(6);
  await expect.poll(() => areaTiles(page))
    .toEqual(["All areas", "Banjul", "Bakau", "Kanifing", "Serrekunda", "Brikama", "My area isn't here"]);
});

test("a type the database has switched off is no longer offered", async ({ page, context }) => {
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }], {
    vehicle_types: ["tricycle", "donkey-cart"], waste_types: ["household"], report_types: ["general", "safety"]
  });
  await page.goto("./#/find");
  await expect.poll(() => vehicleChips(page)).toEqual(["All", "Tricycle", "Donkey cart"]);
  await page.goto("./#/help");
  await expect.poll(() => options(page, "What is this about?")).toEqual(["General feedback", "Safety concern"]);
});

test("a type this version of the app has no label for is left out", async ({ page, context }) => {
  await mockLookups(context, [], { vehicle_types: ["tricycle", "hovercraft"] });
  await page.goto("./#/find");
  await expect.poll(() => vehicleChips(page)).toEqual(["All", "Tricycle"]);
});

test("the lists are saved for the next visit offline", async ({ page, context, consoleErrors }) => {
  await mockLookups(context, [], { vehicle_types: ["tricycle"] });
  await page.goto("./#/find");
  await expect.poll(() => vehicleChips(page)).toEqual(["All", "Tricycle"]);
  await context.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 503, body: "" }));
  await page.reload();
  await expect.poll(() => vehicleChips(page)).toEqual(["All", "Tricycle"]);
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
});

test("the filter keeps the resident's choice when the lists arrive", async ({ page, context }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await context.route(/\/rest\/v1\/rpc\/app_lookups/, async (route) => {
    await held;
    await route.fulfill({ json: {
      areas: [], vehicle_types: ["tricycle", "donkey-cart"], waste_types: ["household"], report_types: ["general"]
    } });
  });
  await page.goto("./#/find");
  await pickVehicle(page, "Tricycle");
  release();
  await expect.poll(() => vehicleChips(page)).toEqual(["All", "Tricycle", "Donkey cart"]);
  await expect(page.locator("#vehicle-chips").getByRole("button", { name: "Tricycle" })).toHaveAttribute("aria-pressed", "true");
});
