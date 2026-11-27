import { defineConfig, devices } from "@playwright/test";

// Takes the screenshots for docs/guide. Run with `npm run guide:screenshots`.
// It is separate from the test suite: it checks nothing, it only photographs
// the app with a made-up backend (tests/guide/fake-backend.ts).
export default defineConfig({
  testDir: "tests/guide",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:4173/" },
  projects: [
    {
      name: "guide",
      use: {
        ...devices["Pixel 5"],
        // Smaller files than the phone's own 2.75, and still sharp.
        deviceScaleFactor: 2,
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
      }
    }
  ],
  webServer: {
    command: "VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build && npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
