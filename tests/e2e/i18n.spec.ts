import { test, expect } from "./fixtures";
import en from "../../src/i18n/en.json" with { type: "json" };
import wo from "../../src/i18n/wo.json" with { type: "json" };
import mnk from "../../src/i18n/mnk.json" with { type: "json" };

test("every locale has the same keys as English", () => {
  const keys = Object.keys(en).sort();
  expect(Object.keys(wo).sort()).toEqual(keys);
  expect(Object.keys(mnk).sort()).toEqual(keys);
});

test("no element is left without its translated text", async ({ page }) => {
  await page.goto("./");
  const empty = await page.locator("[data-i18n]").evaluateAll((elements) =>
    elements.filter((element) => !element.textContent?.trim()).map((element) => element.getAttribute("data-i18n")));
  expect(empty).toEqual([]);
});

test("an untranslated locale falls back to English", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("setsetal.locale", "wo"));
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("lang", "wo");
  await expect(page.getByRole("button", { name: "Find a collector" })).toBeVisible();
});
