// Phone view: burger menus, bottom navigation, tour, no sideways scrolling.
const { test, expect, openApp, createUser, goTo, expectNoHorizontalScroll, skipTour } = require("./fixtures");

test("public pages fit the phone screen", async ({ page }) => {
  for (const path of ["/", "/login.html", "/login.html?register", "/datenschutz.html", "/kontakt.html"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

test("the burger menu on the landing page opens, navigates and closes", async ({ page }) => {
  await page.goto("/");
  const menu = page.locator("#mobileMenu");
  await page.click("[data-burger]");
  await expect(menu).toHaveClass(/open/);
  await menu.locator('a[href="#faq"]').click();
  await expect(menu).not.toHaveClass(/open/);
  await expect(page.locator("#faq")).toBeInViewport();
  await page.click("[data-burger]");
  await expect(menu.locator('a[href="kontakt.html"]')).toBeVisible();
});

test("the app works with the bottom navigation and the menu", async ({ page, request }) => {
  await openApp(page, request);
  await expectNoHorizontalScroll(page);
  for (const id of ["month", "expenses", "recurring", "settings", "dashboard"]) {
    await goTo(page, id);
    await expectNoHorizontalScroll(page);
  }
  await page.click("#appBurger");
  await expect(page.locator("#appMenu")).toHaveClass(/open/);
  await expect(page.locator('#appMenu [data-action="logout"]')).toBeVisible();
  await expect(page.locator("#appLang")).toBeVisible();
});

test("the tour highlights the visible phone controls", async ({ page, request }) => {
  await createUser(page, request);
  const card = page.locator(".tour-card");
  const total = await page.evaluate(() => Tour.steps);
  for (let step = 1; step <= total; step++) {
    // The card always stays fully on the screen.
    const box = await card.boundingBox();
    const screen = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(screen.width);
    expect(box.y + box.height).toBeLessThanOrEqual(screen.height);
    await card.locator('[data-tour="next"]').click();
  }
  await expect(card).toHaveCount(0);
});

test("dashboard blocks are at least half as wide; the content fits in half", async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await createUser(page, request);
  await skipTour(page);
  await page.evaluate(() => {
    state.recurring.push({ id: newId(), kind: "expense", name: "Fitnessstudio Abo", amount: 80, interval: "monthly", start: todayISO().slice(0, 8) + "20", end: "", cat: state.categories[0] });
    state.layout = { ...(state.layout || {}), grid: { phone: { upcoming: { x: 0, w: 12 }, categories: { x: 12, w: 4 } } } };
    applyLayout();
    render();
  });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const full = document.querySelector('[data-block="available"]').getBoundingClientRect().width;
    const block = (id) => document.querySelector(`[data-block="${id}"]`);
    const overflow = [...document.querySelectorAll("#dashboard [data-block]:not(.block-hidden) .card *")].some((el) => {
      const box = el.getBoundingClientRect();
      const parent = el.closest("[data-block]").getBoundingClientRect();
      return box.width && (box.right > parent.right + 1 || box.left < parent.left - 1);
    });
    return {
      upcoming: block("upcoming").getBoundingClientRect().width / full,
      categories: block("categories").getBoundingClientRect().width / full,
      overflow,
    };
  });
  expect(result.upcoming).toBeLessThan(0.55);
  expect(result.categories).toBeGreaterThan(0.45); // narrower than half is shown as half
  expect(result.overflow).toBe(false);
});
