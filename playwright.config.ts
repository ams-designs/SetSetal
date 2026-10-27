import { defineConfig, devices } from "@playwright/test";

// Set BASE_URL to test a deployed build (for example a Netlify preview) instead
// of a local one.
const baseURL = process.env.BASE_URL ?? "http://localhost:4173/";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        // Optional: point at an installed Chromium instead of downloading one.
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
      }
    }
  ],
  // Tests run against the production build, because the service worker only
  // exists there.
  webServer: process.env.BASE_URL ? undefined : {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
