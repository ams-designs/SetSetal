import { test as base, expect, type Page } from "@playwright/test";

// Every test fails on a console error or an uncaught exception.
export const test = base.extend<{ consoleErrors: string[] }>({
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
