import { test, expect } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("./#/find");
});

const cards = (page: import("@playwright/test").Page) => page.locator(".collector-card");
const search = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Show matching services" }).click();

test("shows every sample listing by default", async ({ page }) => {
  await expect(cards(page)).toHaveCount(6);
  await expect(page.getByText("6 demonstration listings")).toBeVisible();
});

test("filters by area", async ({ page }) => {
  await page.getByLabel("Your area").selectOption({ label: "Brikama" });
  await search(page);
  await expect(cards(page)).toHaveCount(2);
});

test("filters by vehicle", async ({ page }) => {
  await page.getByLabel("Collection vehicle").selectOption({ label: "Tricycle" });
  await search(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByText("1 demonstration listing", { exact: true })).toBeVisible();
});

test("filters by waste type", async ({ page }) => {
  await page.getByLabel("Waste type").selectOption({ label: "Recyclables" });
  await search(page);
  await expect(cards(page)).toHaveCount(1);
});

test('"Other / not listed" shows the empty state, not every listing', async ({ page }) => {
  await page.getByLabel("Your area").selectOption({ label: "Other / not listed" });
  await search(page);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "We don't have listings for your area yet" })).toBeVisible();
  await page.getByRole("button", { name: "Go to Help" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Help and feedback" })).toBeVisible();
});

test("no match shows the general empty state", async ({ page }) => {
  await page.getByLabel("Your area").selectOption({ label: "Banjul" });
  await page.getByLabel("Collection vehicle").selectOption({ label: "Horse cart" });
  await search(page);
  await expect(page.getByRole("heading", { name: "No matching sample listings" })).toBeVisible();
});

test("clear filters resets every filter", async ({ page }) => {
  await page.getByLabel("Your area").selectOption({ label: "Brikama" });
  await page.getByLabel("Collection vehicle").selectOption({ label: "Horse cart" });
  await search(page);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(cards(page)).toHaveCount(6);
  await expect(page.getByLabel("Your area")).toHaveValue("all");
});

test("selecting a listing opens its details", async ({ page }) => {
  await page.getByRole("button", { name: "View details" }).nth(3).click();
  await expect(page.getByRole("heading", { level: 2, name: "Neighbourhood collection" })).toBeVisible();
});
