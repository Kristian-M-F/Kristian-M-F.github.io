// Every page loads without script errors and without missing files (CSS, JS, pictures, fonts).
const { test, expect, openApp, goTo } = require("./fixtures");
test("no script errors and no missing files on any page", async ({ page, request }) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push("error: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/api/") && problems.push(r.status() + " " + r.url()));
  for (const p of ["/", "/login.html", "/kontakt.html", "/datenschutz.html", "/impressum.html", "/nutzungsbedingungen.html"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
  }
  await openApp(page, request);
  for (const p of ["month", "expenses", "recurring", "settings", "dashboard"]) await goTo(page, p);
  await page.waitForTimeout(500);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "error").length);
  expect(fonts).toBe(0);
  expect(problems).toEqual([]);
});
