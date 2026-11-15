// Phone screenshots and the feature graphic for the Google Play listing
// (docs/play-store). The collectors shown are invented, so retake these with
// real, approved listings before submitting: Play requires screenshots to
// show the app as it is.
import { test, expect } from "@playwright/test";
import { createBackend } from "./fake-backend";

const DIR = "docs/play-store/screenshots";

// 1080 × 1920: Play accepts 9:16 phone screenshots.
test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });

test("Play Store screenshots", async ({ page, context }) => {
  await createBackend().install(context);
  const shot = async (name: string) => {
    await expect(page.locator("body.ready")).toBeVisible();
    await page.waitForTimeout(350);
    await page.evaluate(() => { document.getElementById("toast")!.hidden = true; });
    await page.screenshot({ path: `${DIR}/${name}.png` });
  };

  await page.goto("./");
  await shot("1-home");
  await page.goto("./#/find");
  await expect(page.locator(".collector-card")).toHaveCount(2);
  await page.locator("#collector-results").evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 150));
  await shot("2-find");
  await page.locator(".collector-card", { hasText: "Lamin's tricycle" }).getByRole("button", { name: "View details" }).click();
  await shot("3-profile");
  await page.locator(".contact-actions").evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 330));
  await shot("4-contact");
  await page.goto("./#/join");
  await shot("5-join");
  await page.goto("./#/privacy");
  await shot("6-privacy");
});

test.describe("feature graphic", () => {
  // Play wants exactly 1024 × 500.
  test.use({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, isMobile: false });

  test("Play Store feature graphic", async ({ page }) => {
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500"
         font-family="Inter, Roboto, 'Noto Sans', 'Segoe UI', Arial, sans-serif">
      <rect width="1024" height="500" fill="#147D59"/>
      <path d="M0 410 Q260 330 520 400 T1024 380 V500 H0Z" fill="#174B3A"/>
      <g transform="translate(72 96)">
        <rect width="96" height="96" rx="28" fill="#FFFFFF"/>
        <g transform="translate(14 14) scale(1.7)" fill="#147D59">
          <path d="M20 5 26 8 23 14 17 14 14 9Z"/><path d="M29 15 34 24 28 28 24 22 26 17Z"/>
          <path d="M22 31 12 31 12 24 19 23 23 27Z"/><path d="M11 21 6 12 12 9 16 16 14 21Z"/>
          <circle cx="20" cy="20" r="4" fill="#FFFFFF"/>
        </g>
        <text x="124" y="70" font-size="68" font-weight="800" fill="#FFFFFF" letter-spacing="-2">SetSetal</text>
      </g>
      <text x="72" y="272" font-size="44" font-weight="800" fill="#FFFFFF" letter-spacing="-1">Find a waste collector near you</text>
      <text x="72" y="322" font-size="26" fill="#E7F2EA">Trucks, vans, tricycles and carts in Brikama</text>
      <g transform="translate(640 300) scale(1.05)">
        <path d="M151 111h120a8 8 0 0 0 8-8V72a8 8 0 0 0-8-8h-34l-20-20h-26l-12 20h-28a8 8 0 0 0-8 8v31a8 8 0 0 0 8 8Z" fill="#FAF8F1"/>
        <path d="M223 49h-25l-9 15h49Z" fill="#147D59"/>
        <rect x="158" y="75" width="29" height="18" rx="2" fill="#E8B84A"/>
        <circle cx="183" cy="111" r="13" fill="#28302D"/><circle cx="183" cy="111" r="5" fill="#FAF8F1"/>
        <circle cx="253" cy="111" r="13" fill="#28302D"/><circle cx="253" cy="111" r="5" fill="#FAF8F1"/>
      </g>
    </svg></body></html>`);
  await page.screenshot({ path: "docs/play-store/feature-graphic.png" });
});
});
