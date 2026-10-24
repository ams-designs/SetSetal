import { test, expect, expectScreen } from "./fixtures";
import type { Page } from "@playwright/test";

async function fillValid(page: Page) {
  await page.getByLabel("Name or business name").fill("Fatou's carts");
  await page.getByLabel("Contact phone number").fill("+220 712 3456");
  await page.getByLabel("Vehicle or collection method").selectOption({ label: "Donkey cart" });
  await page.getByLabel("Main service area").selectOption({ label: "Bakau" });
  await page.getByRole("checkbox", { name: /I agree/ }).check();
}

const submit = (page: Page) => page.getByRole("button", { name: "Preview my listing" }).click();

test.beforeEach(async ({ page }) => {
  await page.goto("./#/join");
});

test("required fields block submission", async ({ page }) => {
  await submit(page);
  await expectScreen(page, "Register your service");
  expect(await page.getByLabel("Name or business name").evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
});

test("a short phone number shows an error", async ({ page }) => {
  await fillValid(page);
  await page.getByLabel("Contact phone number").fill("12ab");
  await page.getByRole("checkbox", { name: "Garden waste" }).check();
  await submit(page);
  await expect(page.getByText("Please enter a phone number with at least 7 digits.")).toBeVisible();
});

test("at least one waste type is required", async ({ page }) => {
  await fillValid(page);
  await submit(page);
  const error = page.getByRole("alert");
  await expect(error).toHaveText("Choose at least one waste type.");
  await expect(page.getByRole("checkbox", { name: "Household bags" })).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("checkbox", { name: "Household bags" }).check();
  await expect(error).toBeHidden();
});

test("several waste types appear in the preview, which says it is not published", async ({ page }) => {
  await fillValid(page);
  await page.getByRole("checkbox", { name: "Garden waste" }).check();
  await page.getByRole("checkbox", { name: "Recyclables" }).check();
  await submit(page);

  await expectScreen(page, "Your listing preview", "#/join/preview");
  await expect(page.locator("#preview-content li")).toHaveText(["Garden waste", "Recyclables"]);
  await expect(page.getByText("Not published")).toBeVisible();
  await expect(page.getByText("This preview is temporary and visible only in this browser session.")).toBeVisible();
});

test("names are shown as text, never as HTML", async ({ page }) => {
  await fillValid(page);
  await page.getByLabel("Name or business name").fill("<img src=x onerror=alert(1)>");
  await page.getByRole("checkbox", { name: "Bulky items" }).check();
  await submit(page);
  await expect(page.getByRole("heading", { level: 2, name: "<img src=x onerror=alert(1)>" })).toBeVisible();
  await expect(page.locator("#preview-content img")).toHaveCount(0);
});

test("finishing the preview says nothing was published", async ({ page }) => {
  await fillValid(page);
  await page.getByRole("checkbox", { name: "Household bags" }).check();
  await submit(page);
  await page.getByRole("button", { name: "Finish preview" }).click();
  await expect(page.getByText("Preview finished. Nothing was published or submitted.")).toBeVisible();
  await expectScreen(page, "Find the right waste collector near you.", "#/");
});
