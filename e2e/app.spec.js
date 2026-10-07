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
  // Income from entries is not part of "wage + allowances"; it goes straight to "available".
  await expect.poll(async () => chf(await page.locator("#mIncome").textContent())).toBe(1000);
  await expect.poll(async () => chf(await page.locator("#mSpent").textContent())).toBe(18.5);
  await expect.poll(async () => chf(await page.locator("#mSaved").textContent())).toBe(100);
  await expect.poll(async () => chf(await page.locator("#mAvail").textContent())).toBe(921.5);

  await expect(page.locator("#mAvailExtra")).toContainText("40.00");

  // The dashboard shows the same "available" first; the savings account shows the transfer.
  await goTo(page, "dashboard");
  await expect.poll(async () => chf(await page.locator("#heroAmount").textContent())).toBe(921.5);
  await expect(page.locator("#currentSummary")).toContainText("40.00");
  await expect(page.locator("#dashboard .account-card.saving").first()).toContainText("100.00");

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

test("dashboard and month blocks can be arranged, resized and keep their order", async ({ page, request }) => {
  await openApp(page, request);
  const order = () => page.locator('[data-sortable="dashboard"] > .block').evaluateAll((blocks) => blocks.map((block) => block.dataset.block));
  const start = ["available", "account-main", "account-save", "upcoming", "categories", "stats"];
  expect(await order()).toEqual(start);

  // Every account is its own block
  await page.click('#dashboard [data-action="arrange"]');
  const savings = page.locator('[data-block="account-save"]');
  await savings.locator('[data-action="move-block"][data-step="-1"]').click();
  await savings.locator('[data-action="move-block"][data-step="-1"]').click();
  expect(await order()).toEqual(["account-save", "available", "account-main", "upcoming", "categories", "stats"]);

  // ↔ makes a block wide or narrow
  await expect(savings).not.toHaveClass(/span-2/);
  await savings.locator('[data-action="resize-block"]').click();
  await expect(savings).toHaveClass(/span-2/);
  const available = page.locator('[data-block="available"]');
  await available.locator('[data-action="resize-block"]').click();
  await expect(available).not.toHaveClass(/span-2/);
  await page.click('#dashboard [data-action="arrange"]'); // done

  // Dragging the bar also works: statistics onto the upper half of the categories
  await page.click('#dashboard [data-action="arrange"]');
  await page.locator('[data-block="stats"]').scrollIntoViewIfNeeded();
  await page.locator('[data-block="stats"] .block-name').hover();
  const categories = await page.locator('[data-block="categories"]').boundingBox();
  await page.mouse.down();
  await page.mouse.move(categories.x + 30, categories.y + 20, { steps: 10 });
  await page.mouse.up();
  const arranged = ["account-save", "available", "account-main", "upcoming", "stats", "categories"];
  expect(await order()).toEqual(arranged);

  await page.waitForTimeout(1500); // saved with the account
  await page.reload();
  await expect(page.locator("#financeApp")).toBeVisible();
  expect(await order()).toEqual(arranged);
  await expect(page.locator('[data-block="account-save"]')).toHaveClass(/span-2/);
  await expect(page.locator('[data-block="available"]')).not.toHaveClass(/span-2/);

  await page.click('#dashboard [data-action="arrange"]');
  await page.click('#dashboard [data-action="reset-layout"]');
  expect(await order()).toEqual(start);
  await expect(page.locator('[data-block="available"]')).toHaveClass(/span-2/);

  await goTo(page, "month");
  await page.click('#month [data-action="arrange"]');
  await page.locator('[data-block="planned"] [data-action="move-block"][data-step="-1"]').click();
  await expect(page.locator('[data-sortable="month"] > .block').nth(2)).toHaveAttribute("data-block", "planned");
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
  await expect(page.locator('#recKind option[value="saving"]')).toHaveCount(0); // saving is set up in the settings
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

test("a standing order counts from its due date and can be marked open again", async ({ page, request }) => {
  await openApp(page, request);
  await goTo(page, "recurring");
  // Due today: paid automatically and taken off "available"
  await page.fill("#recName", "Fitness");
  await page.fill("#recAmount", "80");
  await page.click("#recurringSave");
  // Starts later: open, not counted yet
  await page.fill("#recName", "Halbtax");
  await page.fill("#recAmount", "190");
  await page.fill("#recStart", "2030-03-01");
  await page.click("#recurringSave");

  const fitness = page.locator("#recurringRows tr", { hasText: "Fitness" });
  await expect(fitness).toContainText("Bezahlt");
  await expect(fitness.locator("td.money")).toContainText("− CHF 80.00");
  await expect(page.locator("#recurringRows tr", { hasText: "Halbtax" })).toContainText("Nicht in diesem Lohnmonat");

  await goTo(page, "month");
  await expect.poll(async () => chf(await page.locator("#mSpent").textContent())).toBe(80);

  // Marked as open: no longer taken off
  const planned = page.locator("#plannedPaymentsRows tr", { hasText: "Fitness" });
  await planned.locator('[data-action="toggle-recurring-payment"]').click();
  await expect(planned).toContainText("Offen");
  await expect.poll(async () => chf(await page.locator("#mSpent").textContent())).toBe(0);
  await goTo(page, "recurring");
  await expect(fitness).toContainText("Offen");
  await expect(fitness.locator("td.money")).not.toContainText("−");
  await goTo(page, "dashboard");
  await expect(page.locator("#upcomingRows")).toContainText("Fitness");
});

test("the entries page shows only the selected pay month", async ({ page, request }) => {
  await openApp(page, request);
  await addEntry(page, { desc: "Znüni", amount: 4 });
  await page.click('.month-switch [data-action="change-month"]');
  const options = page.locator("#entryMonth option:not([value=''])");
  await page.selectOption("#entryMonth", await options.first().getAttribute("value"));
  await page.click('#monthEntryForm button[type="submit"]');
  await goTo(page, "expenses");
  await expect(page.locator("#allExpenses")).not.toContainText("Znüni");
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

test("the dashboard compares wage, expenses and savings; all months open in a pop-up", async ({ page, request }) => {
  await openApp(page, request, { setup: { startYear: new Date().getFullYear() - 1 } });
  await page.locator("#dashboard details", { hasText: "Statistik seit Lehrbeginn" }).locator("summary").click();

  // Last three pay months, each with wage, expenses and savings
  const rows = page.locator("#comparisonChart .compare-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.first().locator(".saved-value")).toBeVisible();
  await expect(rows.first().locator(".compare-track.saved")).toHaveCount(1);

  // "Seit Lehrbeginn": every pay month in a pop-up
  await page.click('[data-action="show-comparison"]');
  await expect(page.locator("#comparisonDialog")).toBeVisible();
  expect(await page.locator("#comparisonAll .compare-row").count()).toBeGreaterThan(3);
  await page.click('[data-action="close-comparison"]');
  await expect(page.locator("#comparisonDialog")).toBeHidden();
});
