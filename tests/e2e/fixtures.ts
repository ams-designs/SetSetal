import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

const API = /\/rest\/v1\//;

// Replaces the Supabase REST API for this test. Context routes also catch
// requests made through the service worker; the latest route wins.
export async function mockListings(context: BrowserContext, rows: object[]) {
  await context.route(API, (route) => route.fulfill({ json: rows }));
}

export interface AreaRow { id: string; name: string }

// What public.app_lookups() returns: the lists the app offers.
export async function mockLookups(context: BrowserContext, areas: AreaRow[], overrides: object = {}) {
  await context.route(/\/rest\/v1\/rpc\/app_lookups/, (route) => route.fulfill({
    json: {
      areas,
      vehicle_types: ["municipal-truck", "private-truck", "small-van", "tricycle", "donkey-cart", "horse-cart"],
      waste_types: ["household", "garden", "bulky", "recyclables", "business"],
      report_types: ["general", "incorrect-listing", "safety", "accessibility"],
      ...overrides
    }
  }));
}

// Usage counts the app sent, for tests that check what is (and isn't) counted.
export async function recordEvents(context: BrowserContext) {
  const events: Record<string, unknown>[] = [];
  await context.route(/\/rest\/v1\/events/, (route) => {
    events.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 201, body: "" });
  });
  return events;
}

// Stands in for Cloudflare Turnstile: the check passes as soon as it is shown.
const TURNSTILE_STUB = `
  window.turnstileRenders = 0;
  window.turnstile = {
    render(container, options) {
      window.turnstileRenders++;
      container.textContent = "Security check passed";
      window.turnstilePass = () => options.callback("test-captcha-token-" + window.turnstileRenders++);
      if (!window.turnstileHold) window.turnstilePass();
      return "widget-1";
    },
    reset() { if (!window.turnstileHold) window.turnstilePass(); },
    remove() {}
  };`;

// Every test fails on a console error or an uncaught exception, and never
// reaches the live database: the API answers with no real listings unless a
// test calls mockListings.
export const test = base.extend<{ consoleErrors: string[]; api: void }>({
  api: [
    async ({ context }, use) => {
      await mockListings(context, []);
      await context.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 503, json: { msg: "Not mocked" } }));
      await context.route(/challenges\.cloudflare\.com/, (route) =>
        route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
      await use();
    },
    { auto: true }
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true }
  ]
});

export { expect };

export const COLLECTOR_ID = "00000000-0000-4000-8000-00000000000b";

// Starts the page already signed in as a collector, skipping the SMS code.
export async function signIn(page: Page, phone = "+2207000001", lastUsedDaysAgo = 0, expiresInMinutes = 60) {
  await page.addInitScript(([id, number, daysAgo, minutes]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("setsetal.session.v1", JSON.stringify({
      accessToken: "test-token", refreshToken: "test-refresh", expiresAt: Date.now() + Number(minutes) * 60_000,
      userId: id, phone: number, lastUsed: Date.now() - Number(daysAgo) * 86_400_000
    }));
  }, [COLLECTOR_ID, phone, lastUsedDaysAgo, expiresInMinutes] as const);
}

export interface CollectorRow {
  id: string;
  name: string;
  vehicle_type: string;
  description: string;
  consent_at: string | null;
  status: "submitted" | "approved" | "rejected" | "suspended";
  available_on?: string | null;
  collector_contacts: { phone: string | null; whatsapp: string | null } | null;
  collector_areas: { area_id: string }[];
  collector_waste_types: { waste_type_id: string }[];
}

// A small stand-in for the collector side of Supabase: sign-in, areas, the
// collector's own listing, its review reason and save_my_listing().
export async function mockCollectorBackend(context: BrowserContext, options: {
  listing?: CollectorRow | null;
  reason?: string;
  saveStatus?: number;
  // The listing's status after a save, as the server would report it.
  statusAfterSave?: CollectorRow["status"];
  verifyStatus?: number;
  otp?: { status: number; body?: object };
  areas?: AreaRow[];
  // The answer to set_my_availability and delete_my_account.
  actionStatus?: number;
} = {}) {
  let listing = options.listing ?? null;
  const saved: object[] = [];
  const codesSent: object[] = [];
  // Calls to set_my_availability and delete_my_account, in order.
  const actions: { name: string; body: unknown }[] = [];
  await mockLookups(context, options.areas ?? [{ id: "brikama", name: "Brikama" }, { id: "nyambai", name: "Nyambai" }]);
  await context.route(/\/rest\/v1\/collectors\?/, (route) => route.fulfill({ json: listing ? [listing] : [] }));
  await context.route(/\/rest\/v1\/rpc\/set_my_availability/, (route) => {
    const body = route.request().postDataJSON() as { p_available: boolean };
    actions.push({ name: "set_my_availability", body });
    const status = options.actionStatus ?? 200;
    if (status !== 200) return route.fulfill({ status, json: { message: "refused" } });
    if (listing) listing = { ...listing, available_on: body.p_available ? new Date().toISOString().slice(0, 10) : null };
    return route.fulfill({ json: body.p_available });
  });
  await context.route(/\/rest\/v1\/rpc\/delete_my_account/, (route) => {
    actions.push({ name: "delete_my_account", body: route.request().postDataJSON() });
    const status = options.actionStatus ?? 204;
    if (status !== 204) return route.fulfill({ status, json: { message: "refused" } });
    listing = null;
    return route.fulfill({ status: 204, body: "" });
  });
  await context.route(/\/rest\/v1\/audit_log/, (route) =>
    route.fulfill({ json: options.reason ? [{ reason: options.reason }] : [] }));
  await context.route(/\/rest\/v1\/rpc\/save_my_listing/, (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    saved.push(body);
    const status = options.saveStatus ?? 200;
    if (status !== 200) return route.fulfill({ status, json: { message: "refused" } });
    listing = {
      id: "10000000-0000-4000-8000-000000000001",
      name: String(body.p_name),
      vehicle_type: String(body.p_vehicle_type),
      description: String(body.p_description),
      consent_at: body.p_consent ? new Date().toISOString() : null,
      status: options.statusAfterSave ?? "submitted",
      collector_contacts: { phone: body.p_phone as string | null, whatsapp: body.p_whatsapp as string | null },
      collector_areas: (body.p_areas as string[]).map((area_id) => ({ area_id })),
      collector_waste_types: (body.p_waste_types as string[]).map((waste_type_id) => ({ waste_type_id }))
    };
    return route.fulfill({ json: { id: listing.id, status: listing.status } });
  });
  await context.route(/\/auth\/v1\/otp/, (route) => {
    codesSent.push(route.request().postDataJSON() as object);
    return route.fulfill({ status: options.otp?.status ?? 200, json: options.otp?.body ?? {} });
  });
  await context.route(/\/auth\/v1\/verify/, (route) => route.fulfill(
    (options.verifyStatus ?? 200) === 200
      ? { json: { access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, user: { id: COLLECTOR_ID, phone: "2207000001" } } }
      : { status: options.verifyStatus, json: { msg: "Token has expired or is invalid" } }));
  await context.route(/\/auth\/v1\/logout/, (route) => route.fulfill({ status: 204, body: "" }));
  return { saved, codesSent, actions };
}

export const activeScreen = (page: Page) => page.locator(".screen.active");

export async function expectScreen(page: Page, heading: string, hash?: string) {
  await expect(activeScreen(page).getByRole("heading", { level: 1 })).toHaveText(heading);
  if (hash !== undefined) await expect(page).toHaveURL(new RegExp(`${hash.replace(/[/]/g, "\\/")}$`));
}

// Buttons and links on the active screen smaller than the 48px touch target.
export const smallTargets = (page: Page) =>
  page.locator(".screen.active button, .screen.active a, .site-footer a").evaluateAll((elements) =>
    elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => ({ text: element.textContent?.trim() || element.getAttribute("aria-label"), box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 48 || box.width < 48)
      .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`));

export const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });

// Find: the area button opens the tiles in place; a tap picks one and the
// list changes straight away. Vehicles are a row of picture buttons.
export async function pickArea(page: Page, name: string) {
  const button = page.locator("#area-button");
  if (await button.getAttribute("aria-expanded") !== "true") await button.click();
  await page.locator("#area-tiles").getByRole("button", { name, exact: true }).click();
}
export const pickVehicle = (page: Page, name: string) =>
  page.locator("#vehicle-chips").getByRole("button", { name, exact: true }).click();

// The choices on offer, as the resident sees them.
export async function areaTiles(page: Page): Promise<string[]> {
  const button = page.locator("#area-button");
  if (await button.getAttribute("aria-expanded") !== "true") await button.click();
  return (await page.locator("#area-tiles button").allTextContents()).map((text) => text.trim());
}
export const vehicleChips = async (page: Page): Promise<string[]> =>
  (await page.locator("#vehicle-chips button").allTextContents()).map((text) => text.trim());
export const openListing = (page: Page, index = 0) => page.locator(".card-link").nth(index).click();

// Report a problem: a picture tile per reason; writing is optional.
export const chooseReason = (page: Page, name: string) =>
  page.locator("#report-reasons").getByText(name, { exact: true }).click();
export const reasonTiles = async (page: Page): Promise<string[]> =>
  (await page.locator("#report-reasons label").allTextContents()).map((text) => text.trim());
export const details = (page: Page) => page.getByLabel("Tell us more (you can skip this)");
export const sendReport = (page: Page) => page.getByRole("button", { name: "Send", exact: true }).click();
