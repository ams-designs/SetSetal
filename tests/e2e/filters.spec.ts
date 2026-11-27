import { test, expect, nav, openListing, pickArea, pickVehicle } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("./#/find");
});

const cards = (page: import("@playwright/test").Page) => page.locator(".collector-card");

test("shows every sample listing by default", async ({ page }) => {
  await expect(cards(page)).toHaveCount(6);
  await expect(page.getByText("6 demonstration listings")).toBeVisible();
  await expect(page.locator("#area-current")).toHaveText("All areas");
});

test("filters by area with one tap, and says which area is chosen", async ({ page }) => {
  await pickArea(page, "Brikama");
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator("#area-current")).toHaveText("Brikama");
  // The tiles close and focus returns to the area button.
  await expect(page.locator("#area-options")).toBeHidden();
  await expect(page.locator("#area-button")).toBeFocused();
});

test("filters by vehicle picture", async ({ page }) => {
  await pickVehicle(page, "Tricycle");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByText("1 demonstration listing", { exact: true })).toBeVisible();
  await expect(page.locator("#vehicle-chips").getByRole("button", { name: "Tricycle" })).toHaveAttribute("aria-pressed", "true");
});

test("there is no waste-type filter; each card shows what it takes", async ({ page }) => {
  await expect(page.getByLabel("Waste type")).toHaveCount(0);
  await expect(cards(page).first().locator(".waste-list li")).toHaveText(["Household bags", "Business waste"]);
});

test('"My area isn\'t here" shows the empty state, not every listing', async ({ page }) => {
  await pickArea(page, "My area isn't here");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "We don't have listings for your area yet" })).toBeVisible();
  await page.getByRole("button", { name: "Go to Help" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Help and feedback" })).toBeVisible();
});

test("no match shows the general empty state, with a way back to everything", async ({ page }) => {
  await pickArea(page, "Banjul");
  await pickVehicle(page, "Horse cart");
  await expect(page.getByRole("heading", { name: "No matching sample listings" })).toBeVisible();
  await page.getByRole("button", { name: "Show all collectors" }).click();
  await expect(cards(page)).toHaveCount(6);
  await expect(page.locator("#area-current")).toHaveText("All areas");
  await expect(page.locator("#vehicle-chips").getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("tapping a listing's name or picture opens its details", async ({ page }) => {
  await openListing(page, 3);
  await expect(page.getByRole("heading", { level: 2, name: "Neighbourhood collection" })).toBeVisible();
  await nav(page).getByRole("button", { name: "Find" }).click();
  // The name's tap area covers the picture, so a tap there opens it too.
  await page.locator(".collector-card .card-picture").first().click({ force: true });
  await expect(page.getByRole("heading", { level: 2, name: "Municipal collection service" })).toBeVisible();
});

test("demonstration listings have no Call or WhatsApp button, and say so", async ({ page }) => {
  await expect(page.getByRole("link", { name: /^Call / })).toHaveCount(0);
  await expect(cards(page).first()).toContainText("Example only. No phone number.");
  await expect(cards(page).first()).toContainText("Demonstration listing");
});
