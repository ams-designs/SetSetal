import { test, expect, expectScreen, signIn, COLLECTOR_ID } from "./fixtures";
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
const live = { ...waiting, id: "10000000-0000-4000-8000-000000000002", name: "Lamin's tricycle", vehicle_type: "tricycle", status: "approved" };
const report = {
  id: "20000000-0000-4000-8000-000000000001", type: "safety", message: "The cart blocks the road",
  created_at: "2026-10-26T11:00:00Z", collectors: { name: "Lamin's tricycle" }
};
const history = [{
  id: 1, from_status: null, to_status: "submitted", reason: "<b>Submitted</b>",
  created_at: "2026-10-26T10:00:00Z", collectors: { name: "Fatou's carts" }
}];

async function mockAdmin(context: BrowserContext, options: {
  admin?: boolean;
  actionStatus?: number;
  // Changes a listing between loading the screen and deciding.
  editedSince?: boolean;
  reportAlreadyClosed?: boolean;
} = {}) {
  const actions: Request[] = [];
  await context.route(/\/auth\/v1\/logout/, (route) => route.fulfill({ status: 204, body: "" }));
  await context.route(/\/rest\/v1\/admins/, (route) =>
    route.fulfill({ json: options.admin === false ? [] : [{ user_id: COLLECTOR_ID }] }));
  await context.route(/\/rest\/v1\/areas/, (route) => route.fulfill({ json: [{ id: "brikama", name: "Brikama" }] }));
  await context.route(/\/rest\/v1\/collectors\?/, (route) => {
    const url = route.request().url();
    const byId = url.match(/id=eq\.([0-9a-f-]+)/);
    if (byId) {
      const listing = [waiting, live].find((item) => item.id === byId[1]);
      return route.fulfill({ json: listing ? [options.editedSince ? { ...listing, name: "Renamed since" } : listing] : [] });
    }
    return route.fulfill({ json: url.includes("status=eq.submitted") ? [waiting] : [live] });
  });
  await context.route(/\/rest\/v1\/audit_log/, (route) => route.fulfill({ json: history }));
  await context.route(/\/rest\/v1\/reports/, (route) => {
    if (route.request().method() === "PATCH") {
      actions.push(route.request());
      if (options.actionStatus) return route.fulfill({ status: options.actionStatus, body: "" });
      return route.fulfill({ json: options.reportAlreadyClosed ? [] : [{ id: report.id }] });
    }
    return route.fulfill({ json: [report] });
  });
  await context.route(/\/rest\/v1\/rpc\/set_collector_status/, (route) => {
    actions.push(route.request());
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
  await expect(page.getByText("Sign in with your phone to use the admin tools.")).toBeVisible();
  await page.locator("#admin-content").getByRole("button", { name: "Sign in" }).click();
  await expectScreen(page, "Register your service", "#/join");
  await expect(page.getByLabel("Your phone number")).toBeVisible();
});

test("an account that isn't an admin is told so", async ({ page, context }) => {
  await signIn(page);
  await mockAdmin(context, { admin: false });
  await page.goto("./#/admin");
  await expect(page.getByText("This account isn't an admin.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
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
  await expect(page.locator(".history-list")).toContainText("<b>Submitted</b>");
  await expect(page.locator(".history-list b")).toHaveCount(0);
});

test("approving needs a reason, which the collector will see", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context);
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("The collector sees this reason exactly as you write it", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  expect(actions).toHaveLength(0);

  await page.getByLabel("Why can Fatou's carts go live?", { exact: false }).fill("Met in person at Brikama market");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing approved. Residents can now find it.")).toBeVisible();
  expect(actions[0].postDataJSON()).toEqual({
    p_collector: waiting.id, p_status: "approved", p_reason: "Met in person at Brikama market"
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
  expect(actions[0].postDataJSON()).toMatchObject({ p_collector: live.id, p_status: "suspended" });
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

test("a listing edited since the admin opened it isn't decided blind", async ({ page, context }) => {
  await signIn(page);
  const actions = await mockAdmin(context, { editedSince: true });
  await page.goto("./#/admin");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Why can Fatou's carts go live?", { exact: false }).fill("Met in person");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("This changed since you opened it, so nothing was done.", { exact: false })).toBeVisible();
  expect(actions.filter((request) => request.url().includes("set_collector_status"))).toHaveLength(0);
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
  await expect(page.getByText("Sign in with your phone to use the admin tools.")).toBeVisible();
  await expect(page.getByText("+2207123456")).toHaveCount(0);
});

test("signing in from the admin screen says why", async ({ page }) => {
  await page.goto("./#/admin");
  await page.locator("#admin-content").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Sign in to reach the admin tools.")).toBeVisible();
});
