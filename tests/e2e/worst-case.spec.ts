// Worst realistic data, at the narrowest phone and at 200% zoom: long
// business names, an area name at its 80-character limit, a collector in ten
// areas, every waste type, duplicate names. Nothing may scroll sideways, and
// Call must stay on screen. (Found with the break-ui pass, 27 Nov 2026.)
import { test, expect, mockListings, mockLookups, pickArea } from "./fixtures";

const LONG_AREA = "Brikama Nyambai, behind the Gambia College road junction and Sanyang turning";
const areas = [{ id: "brikama", name: "Brikama" }, { id: "long", name: LONG_AREA },
  ...["Kabafita", "Nyambai", "Sanchaba", "Jamisa", "Mandinaring", "Busumbala", "Kembujeh", "Bafuloto"].map((name) => ({ id: name.toLowerCase(), name }))];
const listing = { description: "", whatsapp: null, available_today: false, updated_at: null };
const rows = [
  { ...listing, id: "w1", name: "Ebrima Jallow & Sons Waste Collection and Recycling Services (Brikama) Ltd", vehicle_type: "private-truck",
    phone: "+2207654321", whatsapp: "+447700900123", areas: areas.map((area) => area.id),
    waste_types: ["household", "garden", "bulky", "recyclables", "business"], available_today: true },
  { ...listing, id: "w2", name: "Jo", vehicle_type: "donkey-cart", phone: "+2203000000", areas: ["long"], waste_types: ["household"] },
  { ...listing, id: "w3", name: "KANIFING MUNICIPAL COUNCIL WASTE MANAGEMENT UNIT — WEST COAST REGION OFFICE", vehicle_type: "municipal-truck",
    phone: null, areas: ["brikama"], waste_types: ["household"] },
  { ...listing, id: "w4", name: "Lamin's tricycle", vehicle_type: "tricycle", phone: "+2207000011", areas: ["kabafita"], waste_types: ["household"] },
  { ...listing, id: "w5", name: "Lamin's tricycle", vehicle_type: "tricycle", phone: "+2207000012", areas: ["nyambai"], waste_types: ["household"] }
];

const scrollsSideways = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test.describe("worst-case data", () => {
  test.beforeEach(async ({ context }) => {
    await mockListings(context, rows);
    await mockLookups(context, areas);
  });

  for (const [label, width, zoom] of [["320px", 320, 1], ["200% zoom", 393, 2]] as const) {
    test(`Find holds up at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 851 });
      if (zoom !== 1) await page.addInitScript((z) => document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = String(z); }), zoom);
      await page.goto("./#/find");
      await expect(page.locator(".collector-card")).toHaveCount(5);
      expect(await scrollsSideways(page)).toBe(false);
      const firstCall = page.locator(".collector-card").first().getByRole("link", { name: /^Call / });
      await firstCall.scrollIntoViewIfNeeded();
      await expect(firstCall).toBeInViewport({ ratio: 1 });
      await page.locator("#area-button").click();
      expect(await scrollsSideways(page)).toBe(false);
    });
  }

  test("a long area name is limited to two lines on the area button", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 851 });
    await page.goto("./#/find");
    await pickArea(page, LONG_AREA);
    const strong = page.locator("#area-current");
    const lines = await strong.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines).toBeLessThanOrEqual(2);
    // Jo works there, and so does the collector who covers every area.
    await expect(page.locator(".collector-card")).toHaveCount(2);
  });

  test("collectors with the same name are told apart by their area", async ({ page }) => {
    await page.goto("./#/find");
    await expect(page.locator(".collector-card", { hasText: "Lamin's tricycle" }).locator(".card-area")).toHaveText(["Kabafita", "Nyambai"]);
  });
});
