// Own error pages: 404.html for unknown addresses, error screen in the app when the backend fails.
const { test, expect } = require("./fixtures");

test("an unknown address shows the 404 page in the website design", async ({ page }) => {
  for (const address of ["/gibt-es-nicht", "/ordner/tief/seite.html"]) {
    const response = await page.goto(address);
    expect(response.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Diese Seite gibt es nicht");
    await expect(page.locator(".error-code")).toHaveText("404");
    // styles and logo load also in sub-folders (paths start with /)
    await expect(page.locator(".error-actions .primary")).toHaveCSS("text-decoration-line", "none");
    expect(await page.locator(".error-top img").evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  }
  await page.click("text=Zur Startseite");
  await expect(page).toHaveURL(/\/$|index\.html$/);
});

test("the 404 page is translated", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("financeOS_lang", "fr"));
  await page.goto("/gibt-es-nicht");
  await expect(page.locator("h1")).toHaveText("Cette page n'existe pas");
  await expect(page).toHaveTitle("Page introuvable – Finance OS");
});

test("the app shows an error page when the server fails, and can try again", async ({ page }) => {
  // Server error (500)
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"Fehler"}' }));
  await page.goto("/app.html");
  await expect(page.locator("#serverError")).toBeVisible();
  await expect(page.locator("#serverErrorTitle")).toHaveText("Etwas ist schiefgelaufen");
  await expect(page.locator("#serverErrorDetail")).toHaveText("Fehlercode 500");

  // Server not reachable at all
  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", (route) => route.abort());
  await page.reload();
  await expect(page.locator("#serverErrorDetail")).toHaveText("Server nicht erreichbar");

  // "Nochmals versuchen" loads the app again (here: not logged in → login page)
  await page.unroute("**/api/auth/me");
  await page.click("#serverErrorRetry");
  await page.waitForURL("**/login.html*");
});
