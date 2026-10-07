// "Back" returns to exactly the same place: same page, same view, same scroll position.
const { test, expect } = require("./fixtures");

/** The landing page scrolls smoothly: wait until the position no longer changes. */
async function settledScrollY(page) {
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => Math.round(scrollY));
        const settled = y === last;
        last = y;
        return settled;
      },
      { intervals: [150] },
    )
    .toBe(true);
  return last;
}

test("landing page → privacy policy → back: same scroll position", async ({ page }) => {
  await page.goto("/");
  await page.locator(".security-link").scrollIntoViewIfNeeded();
  const before = await settledScrollY(page);
  expect(before).toBeGreaterThan(500);
  await page.click(".security-link");
  await expect(page).toHaveURL(/datenschutz\.html/);
  await page.click("a[data-back]");
  await expect(page).toHaveURL(/\/(index\.html)?$/);
  expect(Math.abs((await settledScrollY(page)) - before)).toBeLessThan(5);
});

test("browser back button also returns to the same place", async ({ page }) => {
  await page.goto("/");
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  const before = await settledScrollY(page);
  await page.click('.site-footer a[href="datenschutz.html"]');
  await expect(page).toHaveURL(/datenschutz\.html/);
  await page.goBack();
  expect(Math.abs((await settledScrollY(page)) - before)).toBeLessThan(5);
});

test("registration → privacy policy → back: registration with the typed name", async ({ page }) => {
  await page.goto("/login.html?register");
  await page.fill("#username", "Lea");
  await page.click('.terms-check a[href="datenschutz.html"]');
  await expect(page).toHaveURL(/datenschutz\.html/);
  await page.click("a[data-back]");
  await expect(page).toHaveURL(/login\.html\?register/);
  await expect(page.locator("#authTitle")).toHaveText("Konto erstellen");
  await expect(page.locator("#username")).toHaveValue("Lea");
});

test("login → contact → back: login again", async ({ page }) => {
  await page.goto("/login.html");
  await page.click('.auth-links a[href="kontakt.html"]');
  await expect(page).toHaveURL(/kontakt\.html/);
  await page.click("a[data-back]");
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator("#authTitle")).toHaveText("Willkommen zurück");
});

test("contact → privacy policy → back: the form is still filled in", async ({ page }) => {
  await page.goto("/kontakt.html");
  await page.fill("#contactName", "Lea Muster");
  await page.fill("#contactMessage", "Noch nicht fertig …");
  await page.click(".contact-legal a");
  await page.click("a[data-back]");
  await expect(page).toHaveURL(/kontakt\.html/);
  await expect(page.locator("#contactName")).toHaveValue("Lea Muster");
  await expect(page.locator("#contactMessage")).toHaveValue("Noch nicht fertig …");
});

test("privacy policy opened in a new tab: back closes the tab", async ({ page, context }) => {
  await page.goto("/");
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.evaluate(() => window.open("datenschutz.html", "_blank", "noopener")),
  ]);
  await tab.waitForLoadState();
  await Promise.all([tab.waitForEvent("close"), tab.click("a[data-back]")]);
  expect(tab.isClosed()).toBe(true);
});
