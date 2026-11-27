import { test, expect, expectScreen, mockCollectorBackend, signIn, type CollectorRow } from "./fixtures";
import type { Page } from "@playwright/test";

const ignoreFailedRequests = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};

// The listing form asks one question per screen.
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const stepCount = (page: Page) => page.locator("#step-count");

// Answers the first four questions (name, phone, vehicle, areas) and stops at
// "What do you take?".
async function fillValid(page: Page, options: { name?: string; areas?: string[] } = {}) {
  await page.getByLabel("Name or business name").fill(options.name ?? "Fatou's carts");
  await next(page);
  await page.getByLabel("Phone number for residents").fill("712 3456");
  await next(page);
  await page.getByRole("radio", { name: "Donkey cart" }).check();
  await next(page);
  const areas = options.areas ?? ["Brikama"];
  for (const area of areas) await page.getByRole("checkbox", { name: area, exact: true }).check();
  await next(page);
  if (areas.length) await expect(stepCount(page)).toHaveText("Step 5 of 6");
}

// Goes on to the last question, as far as the answers allow.
async function toLastStep(page: Page) {
  const submit = page.getByRole("button", { name: "Preview my listing" });
  for (let i = 0; i < 6 && !(await submit.isVisible()); i++) await next(page);
}

async function preview(page: Page) {
  await toLastStep(page);
  await page.getByRole("button", { name: "Preview my listing" }).click();
}

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
    // The proof from the security check goes with the request, so a script
    // can't run up the SMS bill.
    expect(codesSent).toEqual([{ phone: "+2207000001", gotrue_meta_security: { captcha_token: "test-captcha-token-1" } }]);

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
    await next(page);
    await expect(stepCount(page)).toHaveText("Step 1 of 6");
    expect(await page.getByLabel("Name or business name").evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    await page.getByLabel("Name or business name").fill("Fatou's carts");
    await next(page);
    await page.getByLabel("Phone number for residents").fill("");
    await next(page);
    await expect(stepCount(page)).toHaveText("Step 2 of 6");
    await expectScreen(page, "Register your service");
  });

  test("at least one area and one waste type are required", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page, { areas: [] });
    await expect(stepCount(page)).toHaveText("Step 4 of 6");
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText("Choose at least one area.");
    await page.getByRole("checkbox", { name: "Nyambai" }).check();
    await next(page);
    await next(page);
    await expect(stepCount(page)).toHaveText("Step 5 of 6");
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText("Choose at least one waste type.");
    await expect(page.getByRole("checkbox", { name: "Household bags" })).toHaveAttribute("aria-invalid", "true");
  });

  test("a bad WhatsApp number is caught", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Name or business name").fill("Fatou's carts");
    await next(page);
    await page.getByLabel("WhatsApp number (optional)").fill("12");
    await next(page);
    await expect(page.getByText("Enter the WhatsApp number as 7 digits", { exact: false })).toBeVisible();
    await expect(stepCount(page)).toHaveText("Step 2 of 6");
  });

  test("the preview shows what residents will see and submits it for review", async ({ page, context }) => {
    const { saved } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page, { areas: ["Brikama", "Nyambai"] });
    await page.getByRole("checkbox", { name: "Garden waste" }).check();
    await page.getByRole("checkbox", { name: "Recyclables" }).check();
    await toLastStep(page);
    await page.getByRole("checkbox", { name: /Show my phone and WhatsApp numbers/ }).check();
    await preview(page);

    await expectScreen(page, "Your listing preview", "#/join/preview");
    await expect(page.locator("#preview-content .waste-list li")).toHaveText(["Garden waste", "Recyclables"]);
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
    await fillValid(page, { name: "<img src=x onerror=alert(1)>" });
    await page.getByRole("checkbox", { name: "Bulky items" }).check();
    await preview(page);
    await expect(page.getByRole("heading", { level: 2, name: "<img src=x onerror=alert(1)>" })).toBeVisible();
    await expect(page.locator("#preview-content img")).toHaveCount(0);
  });

  test("one question per screen: Back keeps answers, Enter goes on", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await expect(stepCount(page)).toHaveText("Step 1 of 6");
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeHidden();
    await page.getByLabel("Name or business name").fill("Fatou's carts");
    // The phone keyboard's Enter key moves on instead of sending the form.
    await page.getByLabel("Name or business name").press("Enter");
    await expect(stepCount(page)).toHaveText("Step 2 of 6");
    await expect(page.getByRole("heading", { name: "Which number should residents call?" })).toBeFocused();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Name or business name")).toHaveValue("Fatou's carts");
  });

  test("the vehicle is chosen by picture, and skipping it says so", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Name or business name").fill("Fatou's carts");
    await next(page);
    await next(page);
    await next(page);
    await expect(page.getByText("Choose your vehicle.")).toBeVisible();
    await expect(stepCount(page)).toHaveText("Step 3 of 6");
    await page.getByRole("radio", { name: "Horse cart" }).check();
    await expect(page.getByText("Choose your vehicle.")).toBeHidden();
  });

  test("going back from the preview keeps what was typed", async ({ page, context }) => {
    await mockCollectorBackend(context);
    await page.goto("./#/join");
    await fillValid(page);
    await page.getByRole("checkbox", { name: "Household bags" }).check();
    await preview(page);
    await page.getByRole("button", { name: "Edit details" }).click();
    // Back on the last question, with every earlier answer kept.
    await expect(stepCount(page)).toHaveText("Step 6 of 6");
    await expect(page.getByLabel("Name or business name")).toHaveValue("Fatou's carts");
    await expect(page.getByRole("checkbox", { name: "Household bags", includeHidden: true })).toBeChecked();
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
    await expect(page.getByRole("checkbox", { name: "Brikama", includeHidden: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Household bags", includeHidden: true })).toBeChecked();
    await expect(stepCount(page)).toHaveText("Step 1 of 6");
  });

  test("each status has its own colour and picture", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: { ...approved, status: "rejected" }, reason: "The phone number didn't answer" });
    await page.goto("./#/join");
    await expect(page.locator(".status-box")).toHaveClass(/result-problem/);
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

  test("a busy sign-in server doesn't sign the collector out", async ({ page, context, consoleErrors }) => {
    await signIn(page, "+2207000001", 0, -1);
    await mockCollectorBackend(context, { listing: approved });
    await context.route(/\/auth\/v1\/token\?grant_type=refresh_token/, (route) =>
      route.fulfill({ status: 429, json: { msg: "Request rate limit reached" } }));
    await page.goto("./#/join");
    await expect(page.getByText("Signed in as +2207000001")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("setsetal.session.v1"))).not.toBeNull();
    ignoreFailedRequests(consoleErrors);
  });

  test("a refused refresh token ends the sign-in", async ({ page, context, consoleErrors }) => {
    await signIn(page, "+2207000001", 0, -1);
    await mockCollectorBackend(context, { listing: approved });
    await context.route(/\/auth\/v1\/token\?grant_type=refresh_token/, (route) =>
      route.fulfill({ status: 400, json: { msg: "Invalid Refresh Token" } }));
    await page.goto("./#/join");
    await expect(page.getByLabel("Your phone number")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("setsetal.session.v1"))).toBeNull();
    ignoreFailedRequests(consoleErrors);
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
    await toLastStep(page);
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
