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

export const activeScreen = (page: Page) => page.locator(".screen.active");

export async function expectScreen(page: Page, heading: string, hash?: string) {
  await expect(activeScreen(page).getByRole("heading", { level: 1 })).toHaveText(heading);
  if (hash !== undefined) await expect(page).toHaveURL(new RegExp(`${hash.replace(/[/]/g, "\\/")}$`));
}

export const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });
