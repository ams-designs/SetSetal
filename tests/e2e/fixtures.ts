import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

const API = /\/rest\/v1\//;

// Replaces the Supabase REST API for this test. Context routes also catch
// requests made through the service worker; the latest route wins.
export async function mockListings(context: BrowserContext, rows: object[]) {
  await context.route(API, (route) => route.fulfill({ json: rows }));
}

// Every test fails on a console error or an uncaught exception, and never
// reaches the live database: the API answers with no real listings unless a
// test calls mockListings.
export const test = base.extend<{ consoleErrors: string[]; api: void }>({
  api: [
    async ({ context }, use) => {
      await mockListings(context, []);
      await context.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 503, json: { msg: "Not mocked" } }));
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
export async function signIn(page: Page, phone = "+2207000001", lastUsedDaysAgo = 0) {
  await page.addInitScript(([id, number, daysAgo]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("setsetal.session.v1", JSON.stringify({
      accessToken: "test-token", refreshToken: "test-refresh", expiresAt: Date.now() + 3600_000,
      userId: id, phone: number, lastUsed: Date.now() - Number(daysAgo) * 86_400_000
    }));
  }, [COLLECTOR_ID, phone, lastUsedDaysAgo] as const);
}

export interface CollectorRow {
  id: string;
  name: string;
  vehicle_type: string;
  description: string;
  consent_at: string | null;
  status: "submitted" | "approved" | "rejected" | "suspended";
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
} = {}) {
  let listing = options.listing ?? null;
  const saved: object[] = [];
  const codesSent: object[] = [];
  await context.route(/\/rest\/v1\/areas/, (route) =>
    route.fulfill({ json: [{ id: "brikama", name: "Brikama" }, { id: "nyambai", name: "Nyambai" }] }));
  await context.route(/\/rest\/v1\/collectors\?/, (route) => route.fulfill({ json: listing ? [listing] : [] }));
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
  return { saved, codesSent };
}

export const activeScreen = (page: Page) => page.locator(".screen.active");

export async function expectScreen(page: Page, heading: string, hash?: string) {
  await expect(activeScreen(page).getByRole("heading", { level: 1 })).toHaveText(heading);
  if (hash !== undefined) await expect(page).toHaveURL(new RegExp(`${hash.replace(/[/]/g, "\\/")}$`));
}

export const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });
