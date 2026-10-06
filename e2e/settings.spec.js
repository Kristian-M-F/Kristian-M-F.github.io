// Settings: allowances, savings accounts, categories, appearance.
const { test, expect, openApp, goTo } = require("./fixtures");

const chf = (text) => Number(text.replace(/[^\d.-]/g, ""));

async function openTab(page, tab) {
  await goTo(page, "settings");
  await page.click(`[data-settings-tab-button="${tab}"]`);
}

test("allowances can be switched on, filled in, added and removed", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "pay");

  // The meal allowance is on by default: 200 per month, 50 of it saved.
  await page.fill("#al-food-amounts-0", "200");
  await page.locator("#al-food-amounts-0").blur();
  await page.fill("#al-food-save-0", "50");
  await page.locator("#al-food-save-0").blur();
  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(200);
  await expect.poll(async () => chf(await page.locator("#mSaved").textContent())).toBe(50);

  await openTab(page, "pay");
  await page.check('[data-allowance-toggle="transport"]');
  await expect(page.locator("#al-transport-amounts-0")).toBeVisible();

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
  await page.selectOption("#listType", "categories");
  await page.fill("#listName", "Konzerte");
  await page.click('[data-action="add-list-item"]');
  await expect(page.locator("#listItems")).toContainText("Konzerte");

  page.answerDialog("Festivals");
  await page.locator(".list-item", { hasText: "Konzerte" }).locator('[data-action="rename-list-item"]').click();
  await expect(page.locator("#listItems")).toContainText("Festivals");

  await goTo(page, "expenses");
  await expect(page.locator("#exCat")).toContainText("Festivals");

  await openTab(page, "lists");
  await page.locator(".list-item", { hasText: "Festivals" }).locator('[data-action="delete-list-item"]').click();
  await expect(page.locator("#listItems")).not.toContainText("Festivals");
});

test("colour, dark mode and text size are applied and saved with the account", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "look");
  // The radio buttons are hidden; people click their labels.
  const choose = (name, value) => page.locator("label", { has: page.locator(`input[name="${name}"][value="${value}"]`) }).click();
  await choose("accent", "violet");
  await choose("mode", "dark");
  await choose("text", "large");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-accent", "violet");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-text", "large");

  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.removeItem("financeOS_appearance")); // only the account remembers it
  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  await expect(html).toHaveAttribute("data-accent", "violet");
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("amounts can be hidden", async ({ page, request }) => {
  await openApp(page, request);
  await openTab(page, "look");
  await page.locator("label.switch", { has: page.locator('input[name="hideAmounts"]') }).click();
  await expect(page.locator('input[name="hideAmounts"]')).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-hide-amounts", /.*/);
});
