// Working with the app: wage, entries, savings, standing orders; everything is saved.
const { test, expect, openApp, goTo } = require("./fixtures");

const chf = (text) => Number(text.replace(/[^\d.-]/g, ""));

async function setWage(page, amount) {
  await goTo(page, "settings");
  await page.click('[data-settings-tab-button="pay"]');
  await page.fill("#salary0", String(amount));
  await page.locator("#salary0").blur();
}

async function addEntry(page, { kind = "expense", desc, amount, category }) {
  await goTo(page, "expenses");
  await page.selectOption("#entryKind", kind);
  await page.fill("#exDesc", desc);
  await page.fill("#exAmount", String(amount));
  if (category) await page.selectOption("#exCat", category);
  await page.click("#expenseSave");
  await expect(page.locator("#allExpenses")).toContainText(desc);
}

test("expenses, income and savings change the month and are saved", async ({ page, request }) => {
  await openApp(page, request);
  await setWage(page, 1000);

  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(1000);

  await addEntry(page, { desc: "Kino", amount: 18.5 });
  await addEntry(page, { kind: "income", desc: "Babysitten", amount: 40 });
  await addEntry(page, { kind: "saving", desc: "Ferienkasse", amount: 100 });

  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(1040);
  await expect.poll(async () => chf(await page.locator("#mSpent").textContent())).toBe(18.5);
  await expect.poll(async () => chf(await page.locator("#mSaved").textContent())).toBe(100);
  await expect.poll(async () => chf(await page.locator("#mAvail").textContent())).toBe(921.5);

  await expect(page.locator("#mIncomeSplit")).toContainText("000.00");
  await expect(page.locator("#mIncomeSplit")).toContainText("40.00");

  // The dashboard shows the same "available" first; the savings account shows the transfer.
  await goTo(page, "dashboard");
  await expect.poll(async () => chf(await page.locator("#heroAmount").textContent())).toBe(921.5);
  await expect(page.locator("#currentSummary")).toContainText("40.00");
  await expect(page.locator("#accountCards .saving").first()).toContainText("100.00");

  // Everything is stored on the server.
  await page.waitForTimeout(1500);
  await page.reload();
  await goTo(page, "expenses");
  for (const desc of ["Kino", "Babysitten", "Ferienkasse"]) await expect(page.locator("#allExpenses")).toContainText(desc);
});

test("an entry can be edited and deleted", async ({ page, request }) => {
  await openApp(page, request);
  await addEntry(page, { desc: "Pizza", amount: 20 });

  const row = page.locator("#allExpenses tr", { hasText: "Pizza" });
  await row.locator('[data-action="edit-record"]').click();
  await expect(page.locator("#exDesc")).toHaveValue("Pizza");
  await page.fill("#exDesc", "Pizza mit Freunden");
  await page.fill("#exAmount", "25");
  await page.click("#expenseSave");
  await expect(page.locator("#allExpenses")).toContainText("Pizza mit Freunden");

  await page.locator("#allExpenses tr", { hasText: "Pizza mit Freunden" }).locator('[data-action="delete-record"]').click();
  await expect(page.locator("#allExpenses")).not.toContainText("Pizza");
});

test("income has no payment method and says where the money goes", async ({ page, request }) => {
  await openApp(page, request);
  await goTo(page, "expenses");
  await expect(page.locator("#exPay")).toBeVisible();
  await page.selectOption("#entryKind", "income");
  await expect(page.locator("#exPay")).toBeHidden();
  await expect(page.locator("#entryHint")).toContainText("Verfügbar");
  await page.selectOption("#entryKind", "saving");
  await expect(page.locator("#exPay")).toBeHidden();
});

test("an entry in another pay month says where it was booked", async ({ page, request }) => {
  await openApp(page, request);
  await goTo(page, "expenses");
  await page.fill("#exDate", "2030-01-15");
  await page.fill("#exDesc", "Konzert");
  await page.fill("#exAmount", "60");
  await page.click("#expenseSave");
  await expect(page.locator("#toast")).toContainText("15.01.2030");
});

test("a withdrawal cannot exceed the savings balance", async ({ page, request }) => {
  await openApp(page, request);
  await goTo(page, "expenses");
  await page.selectOption("#entryKind", "withdraw");
  await page.fill("#exDesc", "Velo");
  await page.fill("#exAmount", "500");
  await page.click("#expenseSave");
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#allExpenses")).not.toContainText("Velo");
});

test("standing orders appear in the month and can be marked as paid", async ({ page, request }) => {
  await openApp(page, request);
  await goTo(page, "recurring");
  await page.fill("#recName", "Handy-Abo");
  await page.fill("#recAmount", "25");
  await page.selectOption("#recInterval", "monthly");
  await page.click("#recurringSave");
  await expect(page.locator("#recurringRows")).toContainText("Handy-Abo");

  await goTo(page, "month");
  const planned = page.locator("#plannedPaymentsRows tr", { hasText: "Handy-Abo" });
  await expect(planned).toBeVisible();
  const toggle = planned.locator('[data-action="toggle-recurring-payment"]');
  const before = await toggle.textContent();
  await toggle.click();
  await expect(planned.locator('[data-action="toggle-recurring-payment"]')).not.toHaveText(before);
});

test("dashboard, month, entries, standing orders and settings can be opened", async ({ page, request }) => {
  await openApp(page, request);
  for (const id of ["month", "expenses", "recurring", "settings", "dashboard"]) await goTo(page, id);
  await page.click('#dashboard [data-action="new-entry"]');
  await expect(page.locator("#expenses")).toHaveClass(/active/);
});

test("another pay month can be chosen", async ({ page, request }) => {
  await openApp(page, request);
  const label = await page.locator("#activeMonthLabel").textContent();
  await page.click('.month-switch [data-action="change-month"]');
  await expect(page.locator("#monthEntry")).toBeVisible();
  const options = page.locator("#entryMonth option:not([value=''])");
  const other = await options.first().getAttribute("value");
  await page.selectOption("#entryMonth", other);
  await page.click("#monthEntryForm button[type=submit]");
  await expect(page.locator("#financeApp")).toBeVisible();
  await expect(page.locator("#activeMonthLabel")).not.toHaveText(label);
});
