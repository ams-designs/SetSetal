import AxeBuilder from "@axe-core/playwright";
import { test, expect, expectScreen, mockLookups, signIn, smallTargets, COLLECTOR_ID } from "./fixtures";
import type { BrowserContext, Request } from "@playwright/test";

const waiting = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fatou's carts",
  vehicle_type: "donkey-cart",
  description: "Weekly pickups",
  consent_at: "2026-10-26T10:00:00Z",
  status: "submitted",
  updated_at: "2026-10-26T10:00:00Z",
  collector_contacts: { phone: "+2207123456", whatsapp: null },
  collector_areas: [{ area_id: "brikama" }],
  collector_waste_types: [{ waste_type_id: "household" }, { waste_type_id: "garden" }]
};
const live = {
  ...waiting, id: "10000000-0000-4000-8000-000000000002", name: "Lamin's tricycle", vehicle_type: "tricycle", status: "approved",
  updated_at: "2026-10-26T12:30:00.123456+00:00"
};
const suspended = { ...waiting, id: "10000000-0000-4000-8000-000000000003", name: "Musa's van", vehicle_type: "small-van", status: "suspended" };
const rejected = { ...waiting, id: "10000000-0000-4000-8000-000000000004", name: "Awa's cart", vehicle_type: "horse-cart", status: "rejected" };
const report = {
  id: "20000000-0000-4000-8000-000000000001", type: "safety", message: "The cart blocks the road",
  created_at: "2026-10-26T11:00:00Z", collectors: { name: "Lamin's tricycle" }
};
const closedReport = {
  id: "20000000-0000-4000-8000-000000000002", type: "incorrect-listing", message: "Wrong number on the listing",
  created_at: "2026-10-25T09:00:00Z", status: "dismissed", resolution_note: "Number checked by phone",
  resolved_at: "2026-10-27T09:00:00Z", collectors: { name: "Lamin's tricycle" }
};
const history = [{
  id: 1, from_status: null, to_status: "submitted", reason: "<b>Submitted</b>",
  created_at: "2026-10-26T10:00:00Z", collectors: { name: "Fatou's carts" }
}];
const areas = [
  { id: "brikama", name: "Brikama", district: "West Coast Region", active: true, sort_order: 1 },
  { id: "old-town", name: "Old town", district: "West Coast Region", active: false, sort_order: 2 }
];
const activity = {
  days: 30,
  totals: { contact_tap: 7, search_no_results: 3, report_submitted: 2 },
  no_results: [{ area: "other", vehicle: "all", waste: "bulky", count: 3 }],
  contacts: [{ name: "Lamin's tricycle", call: 5, whatsapp: 2 }]
};

async function mockAdmin(context: BrowserContext, options: {
  admin?: boolean;
  actionStatus?: number;
  // The collector changed the listing after the admin loaded the screen, so
  // the server refuses the decision with 409.
  editedSince?: boolean;
  reportAlreadyClosed?: boolean;
  activityStatus?: number;
} = {}) {
  const actions: Request[] = [];
  await context.route(/\/auth\/v1\/logout/, (route) => route.fulfill({ status: 204, body: "" }));
  await context.route(/\/rest\/v1\/admins/, (route) =>
    route.fulfill({ json: options.admin === false ? [] : [{ user_id: COLLECTOR_ID }] }));
  await mockLookups(context, [{ id: "brikama", name: "Brikama" }]);
  await context.route(/\/rest\/v1\/areas/, (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: areas });
    actions.push(route.request());
    return route.fulfill({ status: options.actionStatus ?? (route.request().method() === "POST" ? 201 : 204), body: "" });
  });
  await context.route(/\/rest\/v1\/collectors\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("status=eq.submitted")) return route.fulfill({ json: [waiting] });
    if (url.includes("status=eq.approved")) return route.fulfill({ json: [live] });
    return route.fulfill({ json: [suspended, rejected] });
  });
  await context.route(/\/rest\/v1\/rpc\/admin_activity/, (route) =>
    options.activityStatus ? route.fulfill({ status: options.activityStatus, json: {} }) : route.fulfill({ json: activity }));
  await context.route(/\/rest\/v1\/audit_log/, (route) => route.fulfill({ json: history }));
  await context.route(/\/rest\/v1\/reports/, (route) => {
    if (route.request().method() === "PATCH") {
      actions.push(route.request());
      if (options.actionStatus) return route.fulfill({ status: options.actionStatus, body: "" });
      return route.fulfill({ json: options.reportAlreadyClosed ? [] : [{ id: report.id }] });
    }
    return route.fulfill({ json: route.request().url().includes("status=neq.open") ? [closedReport] : [report] });
  });
  await context.route(/\/rest\/v1\/rpc\/set_collector_status/, (route) => {
    actions.push(route.request());
    if (options.editedSince) {
      return route.fulfill({ status: 409, json: { code: "PT409", message: "the listing has changed since it was reviewed" } });
    }
    return route.fulfill({ status: options.actionStatus ?? 204, body: "" });
  });
  return actions;
}

const ignoreFailedRequests = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};

test("signed out, the admin screen asks to sign in first", async ({ page }) => {
  await page.goto("./#/admin");
  await expect(page.getByText("Sign in to use the admin tools.")).toBeVisible();
  await expect(page.getByLabel("Your email address")).toBeVisible();
  await page.getByRole("button", { name: "Sign in with your phone instead" }).click();
  await expectScreen(page, "Register your service", "#/join");
  await expect(page.getByLabel("Your phone number")).toBeVisible();
});

test.describe("signing in by email", () => {
  test("an admin signs in with a code sent by email, and no account is created", async ({ page, context }) => {
    await mockAdmin(context);
    const sent: unknown[] = [];
    const verified: unknown[] = [];
    await context.route(/\/auth\/v1\/otp/, (route) => {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ json: {} });
    });
    await context.route(/\/auth\/v1\/verify/, (route) => {
      verified.push(route.request().postDataJSON());
      return route.fulfill({ json: {
        access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600,
        user: { id: COLLECTOR_ID, email: "admin@example.com", phone: "" }
      } });
    });
    await page.goto("./#/admin");
    await page.getByLabel("Your email address").fill(" Admin@Example.com ");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("We sent a code to admin@example.com.")).toBeVisible();
    expect(sent).toEqual([{ email: "admin@example.com", create_user: false, gotrue_meta_security: { captcha_token: "test-captcha-token-1" } }]);
    await expect(page.locator("#admin-content").getByLabel("Code from the email")).toBeFocused();
    // The hosted project sends 8-digit email codes; the form takes 6 to 10.
    await page.locator("#admin-content").getByLabel("Code from the email").fill("12345678");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".admin-card").first()).toContainText("Fatou's carts");
    expect(verified).toEqual([{ type: "email", email: "admin@example.com", token: "12345678" }]);
  });

  test("a mistyped address is caught before sending", async ({ page, context }) => {
    let requests = 0;
    await context.route(/\/auth\/v1\/otp/, (route) => { requests++; return route.fulfill({ json: {} }); });
    await page.goto("./#/admin");
    await page.getByLabel("Your email address").fill("admin@example");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Enter an email address, for example name@example.com.")).toBeVisible();
    expect(requests).toBe(0);
  });

  test("an address that isn't set up gets no code, and is told so", async ({ page, context, consoleErrors }) => {
    await context.route(/\/auth\/v1\/otp/, (route) =>
      route.fulfill({ status: 422, json: { code: "otp_disabled", msg: "Signups not allowed for otp" } }));
    await page.goto("./#/admin");
    await page.getByLabel("Your email address").fill("someone@example.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("ask the project owner whether it is set up as an admin", { exact: false })).toBeVisible();
    await expect(page.locator("#admin-content").getByLabel("Code from the email")).toBeHidden();
    ignoreFailedRequests(consoleErrors);
  });

  test("a wrong code says so, and a different address can be used", async ({ page, context, consoleErrors }) => {
    await context.route(/\/auth\/v1\/otp/, (route) => route.fulfill({ json: {} }));
    await context.route(/\/auth\/v1\/verify/, (route) =>
      route.fulfill({ status: 403, json: { code: "otp_expired", msg: "Token has expired or is invalid" } }));
    await page.goto("./#/admin");
    await page.getByLabel("Your email address").fill("admin@example.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.locator("#admin-content").getByLabel("Code from the email").fill("000000");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
    ignoreFailedRequests(consoleErrors);
    await page.getByRole("button", { name: "Use a different email address" }).click();
    await expect(page.getByLabel("Your email address")).toBeFocused();
  });
});

test("an account that isn't an admin is told so", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context, { admin: false });
  await page.goto("./#/admin");
  await expect(page.getByText("This account isn't an admin.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("an admin can sign out someone else's sign-in from the admin screen", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context, { admin: false });
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("You're signed out.")).toBeVisible();
  await expect(page.getByLabel("Your email address")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("setsetal.session.v1"))).toBeNull();
});

test("an admin signed in by email isn't offered the collector form on Join", async ({ page, context }) => {
  await page.addInitScript((id) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("setsetal.session.v1", JSON.stringify({
      accessToken: "test-token", refreshToken: "test-refresh", expiresAt: Date.now() + 3600_000,
      userId: id, phone: "", email: "admin@example.com", lastUsed: Date.now()
    }));
  }, COLLECTOR_ID);
  await mockAdmin(context);
  await page.goto("./#/join");
  await expect(page.getByText("You're signed in as an admin.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Name or business name")).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete my listing and account" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.getByRole("button", { name: "Go to the admin screen" }).click();
  await expect(page.locator(".admin-card").first()).toContainText("Fatou's carts");
});

test("an admin sees the review queue, live listings, reports and history", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Fatou's carts" })).toBeVisible();
  await expect(page.locator(".admin-card").first()).toContainText("+2207123456");
  await expect(page.locator(".admin-card").first()).toContainText("Household bags, Garden waste");
  await expect(page.getByText("The cart blocks the road")).toBeVisible();
  // History text from the server is shown as text.
  const decisions = page.locator(".history-list:not(.plain-list)");
  await expect(decisions).toContainText("<b>Submitted</b>");
  await expect(decisions.locator("b")).toHaveCount(0);
});

test("approving needs a reason, which the collector will see", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await page.locator(".admin-card", { hasText: "Fatou's carts" }).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("The collector sees this reason exactly as you write it", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  expect(actions).toHaveLength(0);

  await page.getByLabel("Why can Fatou's carts go live?", { exact: false }).fill("Met in person at Brikama market");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing approved. Residents can now find it.")).toBeVisible();
  // The decision names the version the admin saw; the server refuses any other.
  expect(actions[0].postDataJSON()).toEqual({
    p_collector: waiting.id, p_status: "approved", p_reason: "Met in person at Brikama market",
    p_expected_status: "submitted", p_expected_updated_at: "2026-10-26T10:00:00Z"
  });
});

test("a live listing can be suspended with a reason", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Suspend" }).click();
  await page.getByLabel("Why are you suspending Lamin's tricycle?").fill("Several safety reports");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing suspended. Residents can no longer see it.")).toBeVisible();
  expect(actions[0].postDataJSON()).toMatchObject({
    p_collector: live.id, p_status: "suspended",
    p_expected_status: "approved", p_expected_updated_at: "2026-10-26T12:30:00.123456+00:00"
  });
});

test("a report is resolved with a note", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await page.getByLabel("Note for the record (optional)").fill("Spoke to the collector");
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Report resolved.")).toBeVisible();
  expect(actions[0].method()).toBe("PATCH");
  expect(actions[0].url()).toContain(`id=eq.${report.id}&status=eq.open`);
  expect(actions[0].postDataJSON()).toEqual({ status: "resolved", resolution_note: "Spoke to the collector" });
});

test("a refused decision says nothing was changed", async ({ page, context, consoleErrors }) => {
  await signIn(page);
  await mockAdmin(context, { actionStatus: 400 });
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByLabel("Why are you rejecting Fatou's carts?", { exact: false }).fill("The phone didn't answer");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("That wasn't allowed.", { exact: false })).toBeVisible();
  ignoreFailedRequests(consoleErrors);
});

test("a listing edited since the admin opened it isn't decided blind", async ({ page, context, consoleErrors }) => {
  await signIn(page);
  await mockAdmin(context, { editedSince: true });
  await page.goto("./#/admin");
  await page.locator(".admin-card", { hasText: "Fatou's carts" }).getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Why can Fatou's carts go live?", { exact: false }).fill("Met in person");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("This changed since you opened it, so nothing was done.", { exact: false })).toBeVisible();
  await expect(page.getByText("Listing approved.", { exact: false })).toHaveCount(0);
  ignoreFailedRequests(consoleErrors);
});

test("a report another admin already closed isn't overwritten", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context, { reportAlreadyClosed: true });
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("This changed since you opened it", { exact: false })).toBeVisible();
  await expect(page.getByText("Report dismissed.")).toHaveCount(0);
});

test("a server error doesn't claim nothing changed", async ({ page, context, consoleErrors }) => {
  await signIn(page);
  await mockAdmin(context, { actionStatus: 500 });
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("We couldn't confirm this.", { exact: false })).toBeVisible();
  ignoreFailedRequests(consoleErrors);
});

test("signing out clears the admin screen for the next person", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  await page.goto("./#/join");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("./#/admin");
  await expect(page.getByText("Sign in to use the admin tools.")).toBeVisible();
  await expect(page.getByText("+2207123456")).toHaveCount(0);
});

test("signing in from the admin screen says why", async ({ page }) => {
  await page.goto("./#/admin");
  await page.locator("#admin-content").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Sign in to reach the admin tools.")).toBeVisible();
});

test("rejected and suspended listings are shown, and a decision can be reversed", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Rejected and suspended (2)" })).toBeVisible();
  const card = page.locator(".admin-card", { hasText: "Musa's van" });
  await expect(card).toContainText("Suspended");
  await card.getByRole("button", { name: "Reinstate" }).click();
  await page.getByLabel("Why can Musa's van go live?", { exact: false }).fill("The safety problem was fixed");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing approved. Residents can now find it.")).toBeVisible();
  expect(actions[0].postDataJSON()).toEqual({
    p_collector: suspended.id, p_status: "approved", p_reason: "The safety problem was fixed",
    p_expected_status: "suspended", p_expected_updated_at: "2026-10-26T10:00:00Z"
  });
  await expect(page.locator(".admin-card", { hasText: "Awa's cart" }).getByRole("button", { name: "Approve" })).toBeVisible();
});

test("report decisions are in the history and can be reopened", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  const history = page.locator(".history-list:not(.plain-list)");
  await expect(history).toContainText("Report (Incorrect listing)");
  await expect(history).toContainText("Dismissed");
  await expect(history).toContainText("Note: Number checked by phone");
  await history.getByRole("button", { name: "Reopen this report" }).click();
  await expect(page.getByText("Report reopened.")).toBeVisible();
  expect(actions[0].method()).toBe("PATCH");
  expect(actions[0].url()).toContain(`id=eq.${closedReport.id}&status=neq.open`);
  expect(actions[0].postDataJSON()).toEqual({ status: "open" });
});

test("an admin adds an area and switches one off", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Areas (1)" })).toBeVisible();
  await page.getByLabel("Area name").fill("  Nyambai   Forest ");
  await page.getByRole("button", { name: "Add area" }).click();
  await expect(page.getByText("Area added.", { exact: false })).toBeVisible();
  expect(actions[0].method()).toBe("POST");
  expect(actions[0].postDataJSON()).toEqual({
    id: "nyambai-forest", name: "Nyambai Forest", district: "West Coast Region", sort_order: 3
  });

  await page.getByRole("button", { name: "Switch off Brikama" }).click();
  await expect(page.getByText("Area switched off.", { exact: false })).toBeVisible();
  expect(actions[1].method()).toBe("PATCH");
  expect(actions[1].url()).toContain("id=eq.brikama");
  expect(actions[1].postDataJSON()).toEqual({ active: false });
  await expect(page.getByRole("button", { name: "Switch on Old town" })).toBeVisible();
});

test("an area already on the list isn't added twice", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await page.getByLabel("Area name").fill("BRIKAMA");
  await page.getByRole("button", { name: "Add area" }).click();
  await expect(page.getByText("That area is already on the list.")).toBeVisible();
  await expect(page.getByLabel("Area name")).toHaveValue("BRIKAMA");
  expect(actions).toHaveLength(0);
});

test("activity shows counts, never anything about a resident", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context);
  await page.goto("./#/admin");
  const section = page.locator(".admin-section", { hasText: "Activity" }).last();
  await expect(section).toContainText("Counts from the last 30 days. They never say who the resident was.");
  await expect(section.locator(".stat-card", { hasText: "Taps on Call or WhatsApp" })).toContainText("7");
  await expect(section.locator(".stat-card", { hasText: "Reports about a listing" })).toContainText("0");
  await expect(section).toContainText("Lamin's tricycle: Call 5 · WhatsApp 2");
  await expect(section).toContainText("Other / not listed · All vehicle types · Bulky items");
});

test("the admin screen still works when the activity counts can't be loaded", async ({ page, context, consoleErrors }) => {
  await signIn(page);
  await mockAdmin(context, { activityStatus: 500 });
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  await expect(page.getByText("The activity counts couldn't be loaded.")).toBeVisible();
  ignoreFailedRequests(consoleErrors);
});

test("an approval shows on this phone's Find screen straight away", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  await context.route(/\/rest\/v1\/public_collectors/, (route) => route.fulfill({
    json: [{ id: waiting.id, name: waiting.name, vehicle_type: "donkey-cart", description: "", phone: null, whatsapp: null,
      areas: ["brikama"], waste_types: ["household"], available_today: false }]
  }));
  await page.locator(".admin-card", { hasText: "Fatou's carts" }).getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Why can Fatou's carts go live?", { exact: false }).fill("Met in person");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing approved. Residents can now find it.")).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Find" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Fatou's carts" })).toBeVisible();
});

test("the admin dashboard has no serious accessibility problems, and every button is big enough to tap", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context);
  await page.goto("./#/admin");
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  await page.locator(".admin-card", { hasText: "Fatou's carts" }).getByRole("button", { name: "Approve" }).click();
  const results = await new AxeBuilder({ page }).include(".screen.active").analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
});
