// Profile: user name, password, email address, data download and account deletion.
const fs = require("fs");
const { test, expect, PASSWORD, uniqueEmail, linkFromMail, openApp, goTo, logIn, skipTour } = require("./fixtures");

async function openProfile(page) {
  await goTo(page, "settings");
  await page.click('[data-settings-tab-button="account"]');
}

// "Download data / delete account" is folded away at first.
async function openPrivacySection(page) {
  await openProfile(page);
  const section = page.locator("#privacyCard");
  if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
  await expect(section.locator('[data-action="export-account"]')).toBeVisible();
}

test("the user name can be changed", async ({ page, request }) => {
  await openApp(page, request);
  await openProfile(page);
  await page.fill("#newUsername", "Lea Muster");
  await page.click('[data-action="change-username"]');
  await expect(page.locator("#accountName")).toHaveText("Lea Muster");
  await page.reload();
  await expect(page.locator("#accountName")).toHaveText("Lea Muster");
});

test("the password is changed on the login page", async ({ page, request }) => {
  const { email } = await openApp(page, request);
  await openProfile(page);
  await page.click('a[href="login.html?change=password"]');
  await expect(page.locator("#authTitle")).toHaveText("Passwort ändern");
  await page.fill("#currentPassword", PASSWORD);
  await page.fill("#password", "Neu-und-sicher-1!");
  await page.click("#submitBtn");
  await expect(page.locator("#authNotice")).toContainText("Passwort geändert");

  await page.goto("/app.html"); // this device stays logged in
  await expect(page.locator("#financeApp")).toBeVisible();
  await page.click('[data-action="logout"]');
  await page.waitForURL("**/login.html");
  await logIn(page, { email, password: "Neu-und-sicher-1!" });
});

test("the email address is changed after confirming the new one", async ({ page, request }) => {
  await openApp(page, request);
  const newEmail = uniqueEmail("new");
  await openProfile(page);
  await page.click('a[href="login.html?change=email"]');
  await expect(page.locator("#authTitle")).toHaveText("E-Mail-Adresse ändern");
  await page.fill("#email", newEmail);
  await page.fill("#password", PASSWORD);
  await page.click("#submitBtn");
  await expect(page.locator("#authNotice")).toContainText(newEmail);

  await page.goto(await linkFromMail(request, newEmail, "email"));
  await expect(page.locator("#authNotice")).toContainText("bestätigt");
  await logIn(page, { email: newEmail });
});

test("all data can be downloaded", async ({ page, request }) => {
  const { email } = await openApp(page, request);
  await openPrivacySection(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-action="export-account"]')]);
  expect(download.suggestedFilename()).toMatch(/^finance-os-.*\.json$/);
  const content = fs.readFileSync(await download.path(), "utf8");
  expect(content).toContain(email);
});

test("the account can be deleted with the password", async ({ page, request }) => {
  const { email } = await openApp(page, request);
  await openPrivacySection(page);
  await page.fill("#deletePassword", PASSWORD);
  await page.click('[data-action="delete-account"]');
  await page.waitForURL("**/login.html*");
  await expect(page.locator("#authNotice")).toContainText("gelöscht");

  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("#submitBtn");
  await expect(page.locator("#authError")).toHaveText("E-Mail oder Passwort falsch");
});
