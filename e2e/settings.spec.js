// Settings: allowances, savings accounts, categories, appearance.
const { test, expect, openApp, goTo } = require("./fixtures");

const chf = (text) => Number(text.replace(/[^\d.-]/g, ""));

async function openTab(page, tab) {
  await goTo(page, "settings");
  await page.click(`[data-settings-tab-button="${tab}"]`);
}

test("allowances can be switched on, filled in, set to yearly, added and removed", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "pay");

  // The setup was answered with "no allowances": switch public transport on, 200 per month, 50 of it saved.
  await page.check('[data-allowance-toggle="transport"]');
  await page.fill("#al-transport-amounts-0", "200");
  await page.locator("#al-transport-amounts-0").blur();
  await page.fill("#al-transport-save-0", "50");
  await page.locator("#al-transport-save-0").blur();
  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(1200); // wage 1000 + 200
  await expect.poll(async () => chf(await page.locator("#mSaved").textContent())).toBe(50);

  // Yearly: paid only with the first wage of the apprenticeship year (August), not in this month.
  await openTab(page, "pay");
  await page.selectOption('[data-allowance-per="transport"]', "year");
  await expect(page.locator(".allowance", { hasText: "ÖV" })).toContainText("CHF pro Jahr");
  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(1000);

  await openTab(page, "pay");
  await page.check('[data-allowance-toggle="food"]');
  await expect(page.locator("#al-food-amounts-0")).toBeVisible();

  await page.fill("#allowanceName", "Schulmaterial");
  await page.click('[data-action="add-allowance"]');
  await expect(page.locator("#allowanceList")).toContainText("Schulmaterial");
  await page.locator(".allowance", { hasText: "Schulmaterial" }).locator('[data-action="delete-allowance"]').click();
  await expect(page.locator("#allowanceList")).not.toContainText("Schulmaterial");
});

test("savings accounts can be added, renamed and deleted", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "lists");
  await page.fill("#accountNewName", "Führerschein");
  await page.click('[data-action="add-account"]');
  const row = page.locator(".account-row", { hasText: "Führerschein" });
  await expect(row).toBeVisible();

  page.answerDialog("Auto");
  await row.locator('[data-action="rename-account"]').click();
  await expect(page.locator("#accountList")).toContainText("Auto");
  await expect(page.locator("#accountList")).not.toContainText("Führerschein");

  await page.locator(".account-row", { hasText: "Auto" }).locator('[data-action="delete-account-item"]').click();
  await expect(page.locator("#accountList")).not.toContainText("Auto");

  // New savings accounts can be chosen when saving money.
  await goTo(page, "expenses");
  await page.selectOption("#entryKind", "saving");
  await expect(page.locator("#exCat option")).toHaveCount(1);
});

test("categories can be added, renamed and removed", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "lists");
  const expenses = page.locator('[data-list-items="categories"]');
  await page.fill("#listName-categories", "Konzerte");
  await page.click('[data-action="add-list-item"][data-list="categories"]');
  await expect(expenses).toContainText("Konzerte");

  page.answerDialog("Festivals");
  await expenses.locator(".chip", { hasText: "Konzerte" }).locator('[data-action="rename-list-item"]').click();
  await expect(expenses).toContainText("Festivals");

  await goTo(page, "expenses");
  await expect(page.locator("#exCat")).toContainText("Festivals");

  await openTab(page, "lists");
  await expenses.locator(".chip", { hasText: "Festivals" }).locator('[data-action="delete-list-item"]').click();
  await expect(expenses).not.toContainText("Festivals");

  expect(page.browserDialogs).toEqual([]); // renamed in the page's own dialog, not a browser pop-up

  // Enter adds a payment method
  await page.fill("#listName-payments", "Kreditkarte");
  await page.press("#listName-payments", "Enter");
  await expect(page.locator('[data-list-items="payments"]')).toContainText("Kreditkarte");
});

test("new accounts list public transport and the meal allowance; both off after answering \"no allowances\"", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "pay");
  await expect(page.locator(".allowance")).toHaveCount(2);
  await expect(page.locator('[data-allowance-toggle="transport"]')).not.toBeChecked();
  await expect(page.locator('[data-allowance-toggle="food"]')).not.toBeChecked();
});

test("the 13th-month salary per year is calculated", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "pay");
  await page.fill("#salary0", "1300");
  await page.locator("#salary0").blur();
  await expect(page.locator("#thirteenth0")).toHaveText("–");

  // Spread over 12 wages: net wage ÷ 13 = 100 of every wage is 13th-month salary
  await page.selectOption("#setThirteenth", "spread");
  await expect.poll(async () => chf(await page.locator("#thirteenth0").textContent())).toBe(100);
  await expect(page.locator("#thirteenthNote")).not.toBeEmpty();

  // Paid with the December wage: one extra monthly wage
  await page.selectOption("#setThirteenth", "12");
  await expect.poll(async () => chf(await page.locator("#thirteenth0").textContent())).toBe(1300);
});

test("colour, dark mode and text size are applied and saved with the account", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "look");
  // The radio buttons are hidden; people click their labels.
  const choose = (name, value) => page.locator("label", { has: page.locator(`input[name="${name}"][value="${value}"]`) }).click();
  // New accounts start with Lila
  await expect(page.locator("html")).toHaveAttribute("data-accent", "violet");
  await expect(page.locator('input[name="accent"][value="violet"]')).toBeChecked();
  await choose("accent", "blue");
  await choose("mode", "dark");
  await choose("text", "large");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-accent", "blue");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-text", "large");

  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.removeItem("financeOS_appearance")); // only the account remembers it
  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  await expect(html).toHaveAttribute("data-accent", "blue");
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("contact, terms, privacy policy and imprint can be reached from the settings", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "account");
  const help = page.locator('[data-fold="settings-help"]');
  for (const href of ["kontakt.html", "nutzungsbedingungen.html", "datenschutz.html", "impressum.html"]) {
    await expect(help.locator(`a[href="${href}"]`)).toBeVisible();
  }
});

test("renamed default categories: old accounts get „Freizeit“ and „Fahrzeug“, with their entries", async ({ page, request }) => {
  await openApp(page, request);
  await expect.poll(() => page.evaluate(() => state.categories.slice(1, 3))).toEqual(["Freizeit", "Fahrzeug"]);
  // An account from before the rename
  await page.evaluate(() => {
    state.categories = state.categories.map((name) => ({ Freizeit: "Freizeit/Ausgang", Fahrzeug: "Motorrad/Auto" })[name] || name);
    state.expenses.push({ id: "old1", date: todayISO(), desc: "Kino", cat: "Freizeit/Ausgang", pay: "Karte", amount: 15 });
    save();
    flushData();
  });
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  expect(await page.evaluate(() => state.categories.slice(1, 3))).toEqual(["Freizeit", "Fahrzeug"]);
  expect(await page.evaluate(() => state.expenses.find((entry) => entry.id === "old1").cat)).toBe("Freizeit");
});
