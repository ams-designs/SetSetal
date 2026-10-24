import { test, expect } from "./fixtures";

test("feedback says it is not sent to a server", async ({ page }) => {
  await page.goto("./#/help");
  await expect(page.getByText("Feedback stays in this browser session and is not sent to an administrator.")).toBeVisible();
  await page.getByLabel("What is this about?").selectOption({ label: "Safety concern" });
  await page.getByLabel("Details").fill("Test report");
  await page.getByRole("button", { name: "Submit demo feedback" }).click();
  await expect(page.getByText("It has not been sent to a server or administrator.")).toBeVisible();

  // The demo keeps reports in memory only: counted until a reload, then gone.
  await page.goto("./#/admin");
  await expect(page.locator("#admin-report-count")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#admin-report-count")).toHaveText("0");
});
