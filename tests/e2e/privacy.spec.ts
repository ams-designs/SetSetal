import { test, expect, expectScreen, nav } from "./fixtures";

test("the privacy notice is reachable from Help, the footer and the Join form", async ({ page }) => {
  await page.goto("./#/help");
  await page.locator(".screen.active").getByRole("button", { name: "Privacy" }).click();
  await expectScreen(page, "Privacy", "#/privacy");
  await expect(nav(page).getByRole("button", { name: "Help" })).toHaveAttribute("aria-current", "page");
  await page.locator(".screen.active").getByRole("button", { name: "Go back" }).click();
  await expectScreen(page, "Help and feedback", "#/help");

  await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
  await expectScreen(page, "Privacy", "#/privacy");
});

test("the privacy notice says what is and isn't collected", async ({ page }) => {
  await page.goto("./#/privacy");
  const notice = page.locator("#privacy");
  await expect(notice).toContainText("SetSetal doesn't ask for your name, phone number or address");
  await expect(notice).toContainText("it doesn't use your phone's location");
  await expect(notice).toContainText("There are no cookies and no advertising");
  await expect(notice).toContainText("Residents see your phone and WhatsApp numbers only if you tick the box");
  await expect(notice).toContainText("You can delete your listing and account from the Join screen");
  await expect(notice).toContainText("Feedback is deleted 12 months after it's dealt with");
});
