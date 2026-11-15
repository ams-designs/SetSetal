// Walks through SetSetal as a resident, a collector and an admin, and saves a
// screenshot of each step to docs/guide/img. Every collector, name and number
// shown is invented (tests/guide/fake-backend.ts).
import { test, expect, type Locator, type Page } from "@playwright/test";
import { ADMIN_PHONE, createBackend } from "./fake-backend";

const DIR = "docs/guide/img";

async function settle(page: Page): Promise<void> {
  await expect(page.locator("body.ready")).toBeVisible();
  // Let the screen's fade-in finish.
  await page.waitForTimeout(350);
}

async function shot(page: Page, name: string, options: { toast?: boolean } = {}): Promise<void> {
  await settle(page);
  if (!options.toast) await page.evaluate(() => { document.getElementById("toast")!.hidden = true; });
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

// One part of a long screen, with a little of the page around it.
async function shotOf(page: Page, target: Locator, name: string): Promise<void> {
  await settle(page);
  await page.evaluate(() => { document.getElementById("toast")!.hidden = true; });
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: `${DIR}/${name}.png` });
}

async function signInAs(page: Page, phone: string): Promise<void> {
  await page.getByLabel("Your phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
}

const navTo = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name }).click();

test("guide screenshots", async ({ page, context }) => {
  test.setTimeout(240_000);
  const backend = createBackend();
  await backend.install(context);
  // On a phone the top bar and the menu stay fixed while the page scrolls. A
  // picture of the whole page would have them across its middle, so for the
  // pictures they sit at the top and the bottom of the page instead.
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      .topbar { position: static !important; }
      .bottom-nav { position: static !important; transform: none !important; width: auto !important; }
      .app-main { min-height: 0 !important; padding-bottom: 24px !important; }
      .site-footer { padding-bottom: 12px !important; }
      body { display: flex; flex-direction: column; min-height: 100vh; }
      .site-footer { order: 1; margin-top: auto; }
      .bottom-nav { order: 2; }`;
    document.head.append(style);
  }));

  // Residents ------------------------------------------------------------------
  await page.goto("./");
  await settle(page);
  // Chrome offers installation after a few seconds on a real phone.
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" })
  })));
  await shot(page, "01-home");

  await page.getByRole("button", { name: "Find a collector" }).click();
  await expect(page.locator(".collector-card")).toHaveCount(2);
  await shot(page, "02-find");

  await page.getByLabel("Your area").selectOption({ label: "Brikama Kabafita" });
  await page.getByRole("button", { name: "Show matching services" }).click();
  await expect(page.locator(".collector-card")).toHaveCount(1);
  await shot(page, "03-find-filtered");

  await page.getByLabel("Your area").selectOption({ label: "Other / not listed" });
  await page.getByRole("button", { name: "Show matching services" }).click();
  await shotOf(page, page.locator("#collector-results"), "04-no-listings-for-area");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.locator(".collector-card", { hasText: "Lamin's tricycle" }).getByRole("button", { name: "View details" }).click();
  await shot(page, "05-profile");

  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await page.getByLabel("Details").fill("He came two hours late on Saturday.");
  await shot(page, "06-report");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Feedback sent")).toBeVisible();
  await shotOf(page, page.locator("#report-feedback"), "07-report-sent");

  await page.locator(".screen.active").getByRole("button", { name: "Privacy" }).click();
  await shot(page, "08-privacy");

  // Collectors -----------------------------------------------------------------
  await navTo(page, "Join");
  await page.getByLabel("Your phone number").fill("7123456");
  await shot(page, "10-sign-in");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await shot(page, "11-enter-code");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByLabel("Name or business name").fill("Fatou's donkey cart");
  await page.getByLabel("WhatsApp number (optional)").fill("7123456");
  await page.getByLabel("Vehicle or collection method").selectOption({ label: "Donkey cart" });
  await page.getByRole("checkbox", { name: "Brikama", exact: true }).check();
  await page.getByRole("checkbox", { name: "Brikama Nyambai" }).check();
  await page.getByRole("checkbox", { name: "Household bags" }).check();
  await page.getByRole("checkbox", { name: "Garden waste" }).check();
  await page.getByLabel("Service description").fill("Door-to-door pickups every Tuesday and Friday morning.");
  await page.getByRole("checkbox", { name: /Show my phone and WhatsApp numbers/ }).check();
  await shot(page, "12-listing-form");

  await page.getByRole("button", { name: "Preview my listing" }).click();
  await shot(page, "13-preview");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Waiting for review")).toBeVisible();
  await shot(page, "14-waiting-for-review");
  await page.getByRole("button", { name: "Sign out" }).click();

  // Admins ---------------------------------------------------------------------
  await page.goto("./#/admin");
  await shot(page, "20-admin-signed-out");
  await page.locator("#admin-content").getByRole("button", { name: "Sign in" }).click();
  await signInAs(page, ADMIN_PHONE);
  await expect(page.getByRole("heading", { name: "Review queue (1)" })).toBeVisible();
  // The whole screen is very long; the guide shows its parts one by one.
  await settle(page);
  await page.screenshot({ path: `${DIR}/21-admin-overview.png`, fullPage: true, clip: { x: 0, y: 0, width: 393, height: 1010 } });

  const queued = page.locator(".admin-card", { hasText: "Fatou's donkey cart" });
  await shotOf(page, queued, "22-review-card");
  await queued.getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Why can Fatou's donkey cart go live?", { exact: false }).fill("Met in person at Brikama market; phone answered");
  await shotOf(page, queued, "23-approve-with-reason");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Listing approved. Residents can now find it.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review queue (0)" })).toBeVisible();

  const sectionWith = (title: string) => page.locator(".admin-section", { has: page.getByRole("heading", { level: 2, name: title }) });
  const reports = sectionWith("Open reports");
  await reports.getByLabel("Note for the record (optional)").first().fill("Called the collector; number corrected");
  await shotOf(page, reports, "24-open-reports");
  await shotOf(page, sectionWith("Rejected and suspended"), "25-rejected-and-suspended");
  await shotOf(page, sectionWith("Recent decisions"), "26-history");
  await page.getByLabel("Area name").fill("Brikama Jalanbang");
  await shotOf(page, sectionWith("Areas"), "27-areas");
  await shotOf(page, sectionWith("Activity"), "28-activity");
  await navTo(page, "Join");
  await page.getByRole("button", { name: "Sign out" }).click();

  // The collector again, now approved ---------------------------------------------
  await signInAs(page, "7123456");
  await expect(page.getByText("Residents can find your listing.")).toBeVisible();
  await shot(page, "30-approved");
  await page.getByRole("button", { name: "I'm collecting today" }).click();
  await expect(page.getByText("You're shown as collecting today")).toBeVisible();
  await shotOf(page, page.locator("#my-listing"), "31-collecting-today");

  await page.getByRole("button", { name: "Delete my listing and account" }).click();
  await shotOf(page, page.locator("#signed-in"), "32-delete-account");
  await page.getByRole("button", { name: "Keep my account" }).click();

  // What a collector sees when an admin says no.
  const mine = backend.listings.find((listing) => listing.name === "Fatou's donkey cart")!;
  mine.status = "rejected";
  backend.audit.push({
    id: 99, collector_id: mine.id, from_status: "submitted", to_status: "rejected",
    reason: "The phone number didn't answer. Please check it and submit again.", created_at: new Date().toISOString()
  });
  await page.reload();
  await expect(page.getByText("Not approved")).toBeVisible();
  await shotOf(page, page.locator("#my-listing"), "33-not-approved");
  mine.status = "approved";

  // And what residents now see.
  await page.reload();
  await navTo(page, "Find");
  await expect(page.locator(".collector-card")).toHaveCount(3);
  await shot(page, "34-find-with-new-listing");
});
