import { test, expect, mockListings } from "./fixtures";
import type { BrowserContext, Request } from "@playwright/test";

const REPORTS = /\/rest\/v1\/reports/;

// Answers report inserts with the given status and records what was sent.
async function reportsAnswer(context: BrowserContext, status: number) {
  const sent: Request[] = [];
  await context.route(REPORTS, (route) => {
    sent.push(route.request());
    return route.fulfill({ status, body: "" });
  });
  return sent;
}

const ignoreFailedRequests = (consoleErrors: string[]) => {
  const others = consoleErrors.filter((message) => !/Failed to load resource/.test(message));
  consoleErrors.length = 0;
  expect(others).toEqual([]);
};

async function fillReport(page: import("@playwright/test").Page, message = "The bins were not collected") {
  await page.getByLabel("What is this about?").selectOption({ label: "Safety concern" });
  await page.getByLabel("Details").fill(message);
  await page.getByRole("button", { name: "Send feedback" }).click();
}

test("feedback is sent to the SetSetal team, with nothing about the resident", async ({ page, context }) => {
  const sent = await reportsAnswer(context, 201);
  await page.goto("./#/help");
  await expect(page.getByText("Don't include your address or phone number")).toBeVisible();
  await fillReport(page);
  await expect(page.getByText("Feedback sent")).toBeVisible();
  await expect(page.getByLabel("Details")).toHaveValue("");

  expect(sent).toHaveLength(1);
  expect(sent[0].method()).toBe("POST");
  expect(sent[0].headers()["prefer"]).toBe("return=minimal");
  expect(sent[0].postDataJSON()).toEqual({ type: "safety", message: "The bins were not collected", collector_id: null });
});

test("offline feedback is saved on the phone and sent later", async ({ page, context, consoleErrors }) => {
  await reportsAnswer(context, 503);
  await page.goto("./#/help");
  await fillReport(page);
  await expect(page.getByText("Saved on this phone, not sent yet")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("setsetal.outbox.v1") ?? "[]").length)).toBe(1);

  const sent = await reportsAnswer(context, 201);
  await page.reload();
  await expect(page.getByText("Your saved feedback has been sent.")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("setsetal.outbox.v1"))).toBeNull();
  ignoreFailedRequests(consoleErrors);
});

test("feedback the server refuses says so and stays in the form", async ({ page, context, consoleErrors }) => {
  await reportsAnswer(context, 400);
  await page.goto("./#/help");
  await fillReport(page, "Keep this text");
  await expect(page.getByText("Feedback not sent")).toBeVisible();
  await expect(page.getByLabel("Details")).toHaveValue("Keep this text");
  ignoreFailedRequests(consoleErrors);
});

test("a report from a listing is linked to that listing", async ({ page, context }) => {
  const cart = {
    id: "8b0c7a52-3f1e-4f43-9a51-1c2d3e4f5a61", name: "Brikama Donkey Cart", vehicle_type: "donkey-cart",
    description: "", phone: null, whatsapp: null, areas: ["brikama"], waste_types: ["household"], updated_at: null
  };
  await mockListings(context, [cart]);
  const sent = await reportsAnswer(context, 201);
  await page.goto(`./#/collector/${cart.id}`);
  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await expect(page.getByText("About this listing: Brikama Donkey Cart")).toBeVisible();
  await expect(page.getByLabel("What is this about?")).toHaveValue("incorrect-listing");
  await page.getByLabel("Details").fill("Wrong phone number");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Feedback sent")).toBeVisible();
  expect(sent[0].postDataJSON()).toMatchObject({ type: "incorrect-listing", collector_id: cart.id });
});

test("demonstration listings have no report link", async ({ page }) => {
  await page.goto("./#/collector/demo-van");
  await expect(page.getByRole("heading", { level: 2, name: "Small-load collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report a problem with this listing" })).toHaveCount(0);
});


const cartRow = {
  id: "8b0c7a52-3f1e-4f43-9a51-1c2d3e4f5a61", name: "Brikama Donkey Cart", vehicle_type: "donkey-cart",
  description: "", phone: null, whatsapp: null, areas: ["brikama"], waste_types: ["household"], updated_at: null
};

test("if the listing is no longer shown, the report goes without it and says so", async ({ page, context, consoleErrors }) => {
  await mockListings(context, [cartRow]);
  const sent: Request[] = [];
  await context.route(REPORTS, (route) => {
    sent.push(route.request());
    const linked = (route.request().postDataJSON() as { collector_id: string | null }).collector_id;
    return linked
      ? route.fulfill({ status: 401, json: { code: "42501", message: 'new row violates row-level security policy for table "reports"' } })
      : route.fulfill({ status: 201, body: "" });
  });
  await page.goto(`./#/collector/${cartRow.id}`);
  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await page.getByLabel("Details").fill("Wrong phone number");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("That listing is no longer shown, so we sent your feedback without linking it.")).toBeVisible();
  expect(sent.map((request) => (request.postDataJSON() as { collector_id: string | null }).collector_id))
    .toEqual([cartRow.id, null]);
  ignoreFailedRequests(consoleErrors);
});

test("a message of only spaces is caught before sending", async ({ page, context }) => {
  const sent = await reportsAnswer(context, 201);
  await page.goto("./#/help");
  await page.getByLabel("Details").fill("   \n  ");
  await page.getByRole("button", { name: "Send feedback" }).click();
  expect(await page.getByLabel("Details").evaluate((field: HTMLTextAreaElement) => field.validationMessage))
    .toBe("Please write a few words about what happened.");
  expect(sent).toHaveLength(0);
});

test("saved feedback that the server later refuses is removed, and the resident is told", async ({ page, context, consoleErrors }) => {
  await page.addInitScript(() => localStorage.setItem("setsetal.outbox.v1", JSON.stringify([
    { id: "a", report: { type: "general", message: "Saved earlier", collector_id: null }, queuedAt: Date.now() }
  ])));
  await reportsAnswer(context, 400);
  await page.goto("./#/help");
  await expect(page.getByText("Some saved feedback couldn't be sent and was removed.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("setsetal.outbox.v1"))).toBeNull();
  ignoreFailedRequests(consoleErrors);
});

test("opening Help from the menu starts feedback that isn't about a listing", async ({ page, context }) => {
  await mockListings(context, [cartRow]);
  await page.goto(`./#/collector/${cartRow.id}`);
  await page.getByRole("button", { name: "Report a problem with this listing" }).click();
  await expect(page.getByText("About this listing: Brikama Donkey Cart")).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Home" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Help" }).click();
  await expect(page.getByText("About this listing: Brikama Donkey Cart")).toBeHidden();
});
