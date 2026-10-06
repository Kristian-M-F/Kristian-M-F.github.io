// Guided tour: shown once after the first login, step by step, can be restarted.
const { test, expect, createUser, goTo } = require("./fixtures");

test("the tour leads through the app and does not come back", async ({ page, request }) => {
  await createUser(page, request);
  const card = page.locator(".tour-card");
  await expect(card).toBeVisible();
  await expect(card.locator("#tourTitle")).toHaveText("Willkommen bei Finance OS");

  const total = await page.evaluate(() => Tour.steps);
  for (let step = 1; step <= total; step++) {
    await expect(card.locator("#tourProgress")).toHaveText(`Schritt ${step} von ${total}`);
    if (step === 2) {
      // The highlighted element is the settings button in the menu.
      const box = await page.locator('.nav [data-page="settings"]').boundingBox();
      const spot = await page.locator(".tour-spotlight").boundingBox();
      expect(Math.abs(spot.x + spot.width / 2 - (box.x + box.width / 2))).toBeLessThan(4);
      await card.locator('[data-tour="back"]').click();
      await expect(card.locator("#tourProgress")).toHaveText(`Schritt 1 von ${total}`);
      await card.locator('[data-tour="next"]').click();
    }
    await card.locator('[data-tour="next"]').click();
  }
  await expect(card).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator(".tour-card")).toHaveCount(0);
});

test("the tour can be restarted in the settings and closed with Escape", async ({ page, request }) => {
  await createUser(page, request);
  await page.keyboard.press("Escape");
  await expect(page.locator(".tour-card")).toHaveCount(0);

  await goTo(page, "settings");
  await page.click('[data-settings-tab-button="look"]');
  await page.click('[data-action="start-tour"]');
  await expect(page.locator(".tour-card")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tourProgress")).toContainText("Schritt 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await expect(page.locator("#settings")).toHaveClass(/active/); // back where the tour was started
});

test.describe("in English", () => {
  test.use({ language: "en" });

  test("the tour is translated", async ({ page, request }) => {
    await createUser(page, request);
    await expect(page.locator("#tourTitle")).toHaveText("Welcome to Finance OS");
    await expect(page.locator('[data-tour="next"]')).toHaveText("Next");
    await expect(page.locator("#tourProgress")).toHaveText(/^Step 1 of \d+$/);
  });
});
