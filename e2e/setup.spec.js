// First-time setup of a new account: required questions, optional subscriptions, answers in the settings.
const { test, expect, createUser, skipTour, goTo } = require("./fixtures");

test("a new account answers the setup first; the answers end up in the settings", async ({ page, request }) => {
  await createUser(page, request, { setup: false });
  const setup = page.locator("#setup");
  const next = page.locator("#setupNext");
  const error = page.locator("#setupError");

  // The app behind is blurred and cannot be used; Escape does not close the setup.
  await expect(setup).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/setup-open/);
  expect(await page.locator("#financeApp").evaluate((app) => app.inert)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(setup).toBeVisible();
  await expect(page.locator("#setupSkip")).toBeHidden(); // required question

  await setup.locator('[data-answer="startMonth"]').selectOption("8");
  await setup.locator('[data-answer="startYear"]').selectOption(String(new Date().getFullYear()));
  await next.click();

  // No answer: an error, and the question stays.
  await next.click();
  await expect(error).toBeVisible();
  await setup.locator('[data-choice="years"][data-value="3"]').click();
  await next.click();

  await setup.locator('[data-answer="paydayOther"]').selectOption("20");
  await next.click();
  await setup.locator('[data-choice="thirteenth"][data-value="12"]').click();
  await next.click();

  // One wage per apprenticeship year, all required.
  await expect(setup.locator("[data-wage]")).toHaveCount(3);
  await setup.locator('[data-wage="0"]').fill("800");
  await next.click();
  await expect(error).toBeVisible();
  await setup.locator('[data-wage="1"]').fill("1000");
  await setup.locator('[data-wage="2"]').fill("1300");
  await next.click();

  await setup.locator('[data-choice="allowances"][data-value="yes"]').click();
  await next.click();
  await expect(error).toBeVisible(); // "yes" without choosing one
  await setup.locator('[data-allowance-on="0"]').check(); // meal allowance
  await setup.locator('[data-allowance-amount="0"]').fill("120");
  await setup.locator('[data-own="name"]').fill("Schulmaterial");
  await setup.locator('[data-own="name"]').blur();
  await setup.locator('[data-own="amount"]').fill("300");
  await setup.locator('[data-own="per"]').selectOption("year");
  await next.click();

  // Subscriptions can be skipped; here one is added.
  await expect(page.locator("#setupSkip")).toBeVisible();
  await setup.locator('[data-setup="add-order"]').click();
  await setup.locator('[data-order="0"][data-key="name"]').fill("Handy-Abo");
  await setup.locator('[data-order="0"][data-key="amount"]').fill("25");
  await next.click();

  await expect(setup.locator(".setup-summary")).toContainText("Handy-Abo");
  await next.click();
  await expect(setup).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/setup-open/);
  await skipTour(page);

  await goTo(page, "settings");
  await page.click('[data-settings-tab-button="pay"]');
  await expect(page.locator("#setYears")).toHaveValue("3");
  await expect(page.locator("#setPayday")).toHaveValue("20");
  await expect(page.locator("#setThirteenth")).toHaveValue("12");
  await expect(page.locator("#salary0")).toHaveValue(/800/);
  await expect(page.locator("#salary2")).toHaveValue(/1300/);
  await expect(page.locator('[data-allowance-toggle="food"]')).toBeChecked();
  await expect(page.locator('[data-allowance-toggle="transport"]')).not.toBeChecked();
  await expect(page.locator("#al-food-amounts-1")).toHaveValue(/120/);
  await expect(page.locator("#allowanceList")).toContainText("Schulmaterial");
  await expect(page.locator('.allowance', { hasText: "Schulmaterial" }).locator("[data-allowance-per]")).toHaveValue("year");

  await goTo(page, "recurring");
  await expect(page.locator("#recurringRows")).toContainText("Handy-Abo");

  // After reloading, the setup is not shown again.
  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  await expect(setup).toBeHidden();
});
