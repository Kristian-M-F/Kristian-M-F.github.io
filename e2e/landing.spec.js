// Landing page: content, language, light/dark, links to login and the privacy page.
const { test, expect } = require("./fixtures");

test("shows the landing page with all sections", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Finance OS/);
  await expect(page.locator("h1")).toHaveText("Dein Lehrlingslohn, im Griff vom 25. bis zum 24.");
  for (const id of ["features", "how-it-works", "security", "faq"]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await page.click('.site-nav a[href="#faq"]');
  await expect(page.locator("#faq")).toBeInViewport();
});

test("switches between German, English, French and Italian", async ({ page }) => {
  const headings = {
    en: "Your apprentice wage, under control from the 25th to the 24th.",
    fr: "Ton salaire d'apprenti·e, sous contrôle du 25 au 24.",
    it: "Il tuo salario di apprendista, sotto controllo dal 25 al 24.",
    de: "Dein Lehrlingslohn, im Griff vom 25. bis zum 24.",
  };
  await page.goto("/");
  for (const [language, heading] of Object.entries(headings)) {
    await page.locator(".header-actions [data-lang-select]").selectOption(language);
    await expect(page.locator("h1")).toHaveText(heading);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
  }
});

test("light bulb switches between light and dark and remembers it", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator(".header-actions [data-theme-toggle]");
  const isDark = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await isDark();
  await toggle.click();
  const after = await isDark();
  expect(after).not.toBe(before);
  await page.reload();
  expect(await isDark()).toBe(after);
});

test("'Kostenlos starten' opens the registration in a new tab", async ({ page, context }) => {
  await page.goto("/");
  const [registration] = await Promise.all([context.waitForEvent("page"), page.click(".header-actions a.button")]);
  await registration.waitForLoadState();
  expect(registration.url()).toContain("/login.html?register");
  await expect(page).toHaveURL(/\/$|index\.html/); // the landing page stays open
});

test("FAQ answers open and close", async ({ page }) => {
  await page.goto("/");
  const question = page.locator("#faq details").first();
  await question.locator("summary").click();
  await expect(question).toHaveAttribute("open", "");
  await question.locator("summary").click();
  await expect(question).not.toHaveAttribute("open", "");
});
