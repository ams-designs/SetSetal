import AxeBuilder from "@axe-core/playwright";
import { test, expect, mockCollectorBackend, mockListings, signIn, smallTargets, type CollectorRow } from "./fixtures";

const today = new Date().toISOString().slice(0, 10);

const approved: CollectorRow = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fatou's carts",
  vehicle_type: "donkey-cart",
  description: "Weekly pickups",
  consent_at: "2026-10-26T10:00:00Z",
  status: "approved",
  available_on: null,
  collector_contacts: { phone: "+2207123456", whatsapp: null },
  collector_areas: [{ area_id: "brikama" }],
  collector_waste_types: [{ waste_type_id: "household" }]
};

const ignoreFailedRequests = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};

test.describe("collecting today", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("an approved collector says they're collecting today, and can switch it off", async ({ page, context }) => {
    const { actions } = await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await expect(page.getByText("Are you collecting today?")).toBeVisible();
    await page.getByRole("button", { name: "I'm collecting today" }).click();
    await expect(page.getByText("Residents can now see that you're collecting today.")).toBeVisible();
    await expect(page.getByText("You're shown as collecting today")).toBeVisible();
    await expect(page.getByText("It switches off by itself at midnight.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Stop showing “Collecting today”" }).click();
    await expect(page.getByText("Are you collecting today?")).toBeVisible();
    expect(actions).toEqual([
      { name: "set_my_availability", body: { p_available: true } },
      { name: "set_my_availability", body: { p_available: false } }
    ]);
  });

  test("yesterday's availability is no longer shown as on", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: { ...approved, available_on: "2020-01-01" } });
    await page.goto("./#/join");
    await expect(page.getByText("Are you collecting today?")).toBeVisible();
  });

  test("today's availability is shown as on", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: { ...approved, available_on: today } });
    await page.goto("./#/join");
    await expect(page.getByText("You're shown as collecting today")).toBeVisible();
  });

  test("a listing that isn't approved isn't offered it", async ({ page, context }) => {
    await mockCollectorBackend(context, { listing: { ...approved, status: "submitted" } });
    await page.goto("./#/join");
    await expect(page.getByText("Waiting for review")).toBeVisible();
    await expect(page.getByRole("button", { name: "I'm collecting today" })).toHaveCount(0);
  });

  test("a failure says so and changes nothing", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { listing: approved, actionStatus: 400 });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "I'm collecting today" }).click();
    await expect(page.getByText("That didn't work. Please try again.")).toBeVisible();
    await expect(page.getByText("Are you collecting today?")).toBeVisible();
    ignoreFailedRequests(consoleErrors);
  });
});

test.describe("residents see who is collecting today", () => {
  const row = (name: string, available: boolean) => ({
    id: `8b0c7a52-3f1e-4f43-9a51-${name.length.toString().padStart(12, "0")}`, name, vehicle_type: "tricycle", description: "",
    phone: "+2207000001", whatsapp: null, areas: ["brikama"], waste_types: ["household"], available_today: available
  });

  test("the listing is labelled and comes first; the rest stay in name order", async ({ page, context }) => {
    await mockListings(context, [row("Awa", false), row("Lamin's", true), row("Musa cart", false)]);
    await page.goto("./#/find");
    await expect(page.locator(".collector-card h3")).toHaveText(["Lamin's", "Awa", "Musa cart"]);
    await expect(page.locator(".collector-card").first().getByText("Collecting today")).toBeVisible();
    await expect(page.getByText("Collecting today")).toHaveCount(1);
  });

  test("the profile says it's the collector's word, not SetSetal's check", async ({ page, context }) => {
    const listing = row("Lamin's", true);
    await mockListings(context, [listing]);
    await page.goto(`./#/collector/${listing.id}`);
    await expect(page.locator("#profile-content").getByText("Collecting today", { exact: true })).toBeVisible();
    await expect(page.getByText("SetSetal hasn't checked this, so confirm when you call.", { exact: false })).toBeVisible();
  });

  test("a saved copy from another day doesn't claim the collector is working today", async ({ page, context, consoleErrors }) => {
    const listing = row("Lamin's", true);
    await page.addInitScript((value) => localStorage.setItem("setsetal.listings.v2", JSON.stringify(value)),
      { savedAt: Date.now() - 25 * 60 * 60 * 1000, rows: [listing] });
    await context.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("./#/find");
    await expect(page.getByRole("heading", { name: "Lamin's" })).toBeVisible();
    await expect(page.getByText("Collecting today")).toHaveCount(0);
    ignoreFailedRequests(consoleErrors);
  });

  test("demonstration listings never say they're collecting today", async ({ page }) => {
    await page.goto("./#/find");
    await expect(page.locator(".collector-card")).toHaveCount(6);
    await expect(page.getByText("Collecting today")).toHaveCount(0);
  });
});

test.describe("deleting an account", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("it asks first, and cancelling keeps everything", async ({ page, context }) => {
    const { actions } = await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "Delete my listing and account" }).click();
    await expect(page.getByText("It can't be undone.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Keep my account" }).click();
    await expect(page.getByText("It can't be undone.", { exact: false })).toBeHidden();
    expect(actions).toEqual([]);
    await expect(page.getByText("Signed in as +2207000001")).toBeVisible();
  });

  test("confirming deletes the account and signs out on this phone", async ({ page, context }) => {
    const { actions } = await mockCollectorBackend(context, { listing: approved });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "Delete my listing and account" }).click();
    await page.getByRole("button", { name: "Yes, delete everything" }).click();
    await expect(page.getByText("Your listing and account have been deleted.")).toBeVisible();
    await expect(page.getByLabel("Your phone number")).toBeVisible();
    expect(actions.map((action) => action.name)).toEqual(["delete_my_account"]);
    expect(await page.evaluate(() => localStorage.getItem("setsetal.session.v1"))).toBeNull();
    // The next person on this phone doesn't see the question still open.
    await expect(page.getByText("It can't be undone.", { exact: false })).toBeHidden();
  });

  test("if deleting fails, it says so and the collector stays signed in", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { listing: approved, actionStatus: 500 });
    await page.goto("./#/join");
    await page.getByRole("button", { name: "Delete my listing and account" }).click();
    await page.getByRole("button", { name: "Yes, delete everything" }).click();
    await expect(page.getByText("We couldn't confirm that.", { exact: false })).toBeVisible();
    await expect(page.getByText("Signed in as +2207000001")).toBeVisible();
    ignoreFailedRequests(consoleErrors);
  });
});

test.describe("the sign-in security check", () => {
  // The deployed build may not have a captcha key.
  test.skip(Boolean(process.env.BASE_URL), "needs the local build, which has the test key");

  test("no code is sent until the check has passed", async ({ page, context }) => {
    await page.addInitScript(() => { (window as Window & { turnstileHold?: boolean }).turnstileHold = true; });
    const { codesSent } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("7000001");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(codesSent).toHaveLength(0);
    // The check passes while the collector waits, and the code goes out.
    await page.evaluate(() => (window as Window & { turnstilePass?: () => void }).turnstilePass?.());
    await expect(page.getByText("We sent a code to +2207000001.")).toBeVisible();
    expect(codesSent).toHaveLength(1);
  });

  test("each code request uses a new proof", async ({ page, context }) => {
    const { codesSent } = await mockCollectorBackend(context);
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("7000001");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We sent a code to +2207000001.")).toBeVisible();
    await page.getByRole("button", { name: "Use a different number" }).click();
    await page.getByLabel("Your phone number").fill("7000002");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We sent a code to +2207000002.")).toBeVisible();
    const tokens = (codesSent as { gotrue_meta_security: { captcha_token: string } }[]).map((body) => body.gotrue_meta_security.captcha_token);
    expect(new Set(tokens).size).toBe(2);
  });

  test("a refused check is explained", async ({ page, context, consoleErrors }) => {
    await mockCollectorBackend(context, { otp: { status: 400, body: { msg: "captcha verification process failed" } } });
    await page.goto("./#/join");
    await page.getByLabel("Your phone number").fill("7000001");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("The security check didn't pass. Please try again.")).toBeVisible();
    ignoreFailedRequests(consoleErrors);
  });

  test("residents never load the check", async ({ page }) => {
    let loaded = false;
    page.on("request", (request) => { if (request.url().includes("challenges.cloudflare.com")) loaded = true; });
    for (const hash of ["#/", "#/find", "#/collector/demo-van", "#/help", "#/privacy"]) await page.goto("./" + hash);
    expect(loaded).toBe(false);
  });
});

test("the collector's status screen has no serious accessibility problems, and every button is big enough to tap", async ({ page, context }) => {
  await signIn(page);
  await mockCollectorBackend(context, { listing: approved });
  await page.goto("./#/join");
  await page.getByRole("button", { name: "Delete my listing and account" }).click();
  await expect(page.getByRole("button", { name: "Keep my account" })).toBeFocused();
  const results = await new AxeBuilder({ page }).include(".screen.active").analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
});
