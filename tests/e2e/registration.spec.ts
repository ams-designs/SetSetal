import { test, expect, expectScreen, mockCollectorBackend, signIn, type CollectorRow } from "./fixtures";
import type { Page } from "@playwright/test";

const ignoreFailedRequests = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};

async function fillValid(page: Page) {
  await page.getByLabel("Name or business name").fill("Fatou's carts");
  await page.getByLabel("Phone number for residents").fill("712 3456");
  await page.getByLabel("Vehicle or collection method").selectOption({ label: "Donkey cart" });
  await page.getByRole("checkbox", { name: "Brikama" }).check();
}

const preview = (page: Page) => page.getByRole("button", { name: "Preview my listing" }).click();

const approved: CollectorRow = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fatou's carts",
  vehicle_type: "donkey-cart",
  description: "Weekly pickups",
  consent_at: null,
  status: "approved",
  collector_contacts: { phone: "+2207123456", whatsapp: null },
  collector_areas: [{ area_id: "brikama" }],
  collector_waste_types: [{ waste_type_id: "household" }]
};

test.describe("signing in", () => {
  test("a collector signs in with a code sent to their phone", async ({ page, context }) => {
    const { codesSent } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("700 0001");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We sent a code to +2207000001.")).toBeVisible();
    expect(codesSent).toEqual([{ phone: "+2207000001" }]);

    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Signed in as +2207000001")).toBeVisible();
    await expect(page.getByLabel("Phone number for residents")).toHaveValue("+2207000001");
  });

  test("a number that isn't a phone number is caught before sending", async ({ page, context }) => {
    const { codesSent } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("12ab");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Enter a Gambian number as 7 digits, or a full number starting with +.")).toBeVisible();
    expect(codesSent).toHaveLength(0);
  });

  test("a wrong code says so", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { verifyStatus: 403 });
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("7000001");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
    ignoreFailedRequests(consoleErrors);
  });

  test("if phone sign-in isn't switched on yet, it says so", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { otp: { status: 400, body: { msg: "Unsupported phone provider" } } });
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("7000001");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Sign-in isn't available yet. Please try again later.")).toBeVisible();
    ignoreFailedRequests(consoleErrors);
  });
});

test.describe("registering", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("required fields block submission", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await expect(page.getByLabel("Name or business name")).toBeVisible();
    await page.getByLabel("Phone number for residents").fill("");
    await preview(page);
    await expectScreen(page, "Register your service");
    expect(await page.getByLabel("Name or business name").evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  });

  test("at least one area and one waste type are required", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Brikama" }).uncheck();
    await preview(page);
    await expect(page.getByRole("alert")).toHaveText("Choose at least one area.");
    await page.getByRole("checkbox", { name: "Nyambai" }).check();
    await preview(page);
    await expect(page.getByRole("alert")).toHaveText("Choose at least one waste type.");
    await expect(page.getByRole("checkbox", { name: "Household bags" })).toHaveAttribute("aria-invalid", "true");
  });

  test("a bad WhatsApp number is caught", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Household bags" }).check();
    await page.getByLabel("WhatsApp number (optional)").fill("12");
    await preview(page);
    await expect(page.getByText("Enter the WhatsApp number as 7 digits", { exact: false })).toBeVisible();
  });

  test("the preview shows what residents will see and submits it for review", async ({ page, context }) => {
    const { saved } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Nyambai" }).check();
    await page.getByRole("checkbox", { name: "Garden waste" }).check();
    await page.getByRole("checkbox", { name: "Recyclables" }).check();
    await page.getByRole("checkbox", { name: /Show my phone and WhatsApp numbers/ }).check();
    await preview(page);

    await expectScreen(page, "Your listing preview", "#/join/preview");
    await expect(page.locator("#preview-content li")).toHaveText(["Garden waste", "Recyclables"]);
    await expect(page.locator("#preview-content")).toContainText("Brikama, Nyambai");
    await expect(page.getByText("Not published yet")).toBeVisible();
    await expect(page.getByText("An admin checks new details before residents see them.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Submitted for review.")).toBeVisible();
    await expectScreen(page, "Register your service", "#/join");
    await expect(page.getByText("Waiting for review")).toBeVisible();
    expect(saved).toEqual([{
      p_id: null, p_name: "Fatou's carts", p_vehicle_type: "donkey-cart", p_description: "",
      p_phone: "+2207123456", p_whatsapp: null, p_areas: ["brikama", "nyambai"],
      p_waste_types: ["garden", "recyclables"], p_consent: true
    }]);
  });

  test("a refused save stays on the preview and says nothing was sent", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { saveStatus: 400 });
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Household bags" }).check();
    await preview(page);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("SetSetal couldn't accept these details.", { exact: false })).toBeVisible();
    await expectScreen(page, "Your listing preview");
    ignoreFailedRequests(consoleErrors);
  });

  test("names are shown as text, never as HTML", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByLabel("Name or business name").fill("<img src=x onerror=alert(1)>");
    await page.getByRole("checkbox", { name: "Bulky items" }).check();
    await preview(page);
    await expect(page.getByRole("heading", { level: 2, name: "<img src=x onerror=alert(1)>" })).toBeVisible();
    await expect(page.locator("#preview-content img")).toHaveCount(0);
  });

  test("going back from the preview keeps what was typed", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Household bags" }).check();
    await preview(page);
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page.getByLabel("Name or business name")).toHaveValue("Fatou's carts");
    await expect(page.getByRole("checkbox", { name: "Household bags" })).toBeChecked();
  });
});

test.describe("an existing listing", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a rejected listing shows why, and editing starts from its details", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: { ...approved, status: "rejected" }, reason: "The phone number didn't answer" });
    await page.goto("./#/join");
    await expect(page.getByText("Not approved")).toBeVisible();
    await expect(page.getByText("Reason: The phone number didn't answer")).toBeVisible();
    await page.getByRole("button", { name: "Edit my listing" }).click();
    await expect(page.getByLabel("Name or business name")).toHaveValue("Fatou's carts");
    await expect(page.getByLabel("Phone number for residents")).toHaveValue("+2207123456");
    await expect(page.getByRole("checkbox", { name: "Brikama" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Household bags" })).toBeChecked();
  });

  test("an approved listing without consent explains residents can't call", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await expect(page.getByText("Residents can find your listing.")).toBeVisible();
    await expect(page.getByText("Residents can't contact you", { exact: false })).toBeVisible();
  });

  test("signing out returns to the sign-in step", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("You're signed out.")).toBeVisible();
    await expect(page.getByLabel("Your phone number")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("setsetal.session.v1"))).toBeNull();
  });
});

test.describe("shared phones and honest saving", () => {
  test("a sign-in unused for over a week ends", async ({ page, context }) => {
    await signIn(page, "+2207000001", 8);
    await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await expect(page.getByLabel("Your phone number")).toBeVisible();
    await expect(page.getByText("On a shared phone, sign out when you finish.")).toBeVisible();
  });

  test("the status panel shows who is signed in, with Sign out", async ({ page, context }) => {
    await signIn(page);
    await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await expect(page.getByText("Residents can find your listing.")).toBeVisible();
    await expect(page.getByText("Signed in as +2207000001")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("tapping Submit twice saves once", async ({ page, context }) => {
    await signIn(page);
    const { saved } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Household bags" }).check();
    await preview(page);
    const submit = page.getByRole("button", { name: "Submit for review" });
    await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(page.getByText("Submitted for review.")).toBeVisible();
    expect(saved).toHaveLength(1);
  });

  test("a change that doesn't need review says the listing is still live", async ({ page, context }) => {
    await signIn(page);
    await mockCollectorBackend(context, { listing: approved, statusAfterSave: "approved" });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "Edit my listing" }).click();
    await page.getByRole("checkbox", { name: /Show my phone and WhatsApp numbers/ }).check();
    await preview(page);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Saved. Your listing is still live.")).toBeVisible();
  });

  test("a suspended listing says edits won't bring it back", async ({ page, context }) => {
    await signIn(page);
    await mockCollectorBackend(context, { listing: { ...approved, status: "suspended" }, reason: "Several safety reports" });
    await page.goto("./#/join");
    await expect(page.getByText("Reason: Several safety reports")).toBeVisible();
    await expect(page.getByText("Your listing stays hidden while it's suspended, even if you edit it.")).toBeVisible();
  });
});
