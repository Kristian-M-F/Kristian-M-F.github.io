// Payday question: on payday the app asks what to do with the money left over from the last pay month.
const { test, expect, createUser, skipTour, goTo } = require("./fixtures");

// Pretends the question was already in use last month, so it is due for the pay month that just ended.
async function makePaydayDue(page) {
  return page.evaluate(() => {
    state.paydayStart = addMonths(payrollMonth(todayISO()), -1);
    checkPayday();
    return state.paydayStart;
  });
}

test("new users are not asked about months from before they used the app", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  const start = await page.evaluate(() => {
    checkPayday();
    return state.paydayStart;
  });
  expect(start).toBe(await page.evaluate(() => payrollMonth(todayISO())));
  await expect(page.locator("#paydayDialog")).not.toBeVisible();
});

test("the money left over can be taken into the new month or saved", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  const previous = await makePaydayDue(page);

  const dialog = page.locator("#paydayDialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#paydayAmount")).toHaveText("CHF 1’000.00");
  await expect(page.locator("#paydayInput")).toHaveValue("1000.00");

  // More than is left over is not possible
  await page.fill("#paydayInput", "1200");
  await page.click('[data-action="payday-confirm"]');
  await expect(page.locator("#paydayError")).toContainText("höchstens CHF 1’000.00");

  // Take 400 into the new month
  await page.click('[data-action="payday-choice"][data-value="carry"]');
  await expect(page.locator("#paydayAccountField")).toBeHidden();
  await page.fill("#paydayInput", "400");
  await page.click('[data-action="payday-confirm"]');
  await expect(dialog).not.toBeVisible();
  const sums = await page.evaluate((month) => {
    const next = addMonths(month, 1);
    return { old: monthSummary(month).available, carried: monthSummary(next).carriedIn, available: monthSummary(next).available };
  }, previous);
  expect(sums.old).toBeCloseTo(600);
  expect(sums.carried).toBeCloseTo(400);
  expect(sums.available).toBeCloseTo(1400);
  await expect(page.locator("#currentSummary")).toContainText("Übrig vom Vormonat");
  // In the new month's ledger: below the wage
  const carried = await page.evaluate(() => monthLedger(currentMonth).map((row) => row.text));
  expect(carried.at(-1)).toMatch(/^Übrig vom Vormonat/);

  // Asked only once per pay month
  await page.evaluate(() => checkPayday());
  await expect(dialog).not.toBeVisible();

  // "Rückgängig" in the month overview removes it, and the question comes again
  await goTo(page, "month");
  await page.click('#monthMath [data-action="undo-carry"]');
  expect(await page.evaluate(() => state.carryOvers.length)).toBe(0);
  await page.evaluate(() => checkPayday());
  await expect(dialog).toBeVisible();

  // This time save 250 on the savings account
  await page.fill("#paydayInput", "250");
  await page.click('[data-action="payday-confirm"]');
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate((month) => {
    const entry = state.savingEntries.find((item) => item.desc.startsWith("Übrig aus"));
    return { amount: entry.amount, date: entry.date, end: period(month).end, available: monthSummary(month).available };
  }, previous);
  expect(saved.amount).toBe(250);
  // The new month shows it for information, without counting it there
  const note = await page.evaluate((month) => {
    const next = addMonths(month, 1);
    return { row: monthLedger(next).find((row) => row.kind === "note"), available: monthSummary(next).available };
  }, previous);
  expect(note.row.text).toMatch(/^Übrig vom Vormonat/);
  expect(note.row.amount).toBe(250);
  expect(saved.date).toBe(saved.end);
  expect(saved.available).toBeCloseTo(750);
});

test("'Später' closes the question until the app is opened again", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await makePaydayDue(page);
  await expect(page.locator("#paydayDialog")).toBeVisible();
  await page.click('[data-action="payday-later"]');
  await expect(page.locator("#paydayDialog")).not.toBeVisible();
  // Not answered: saved with the account, the question comes again after reloading
  await page.evaluate(() => persist());
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("#paydayDialog")).toBeVisible();
});

test("an amount left at payday can never make the old month negative later", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  const previous = await makePaydayDue(page);
  // Save everything that is left, then change the month afterwards so less is left
  await page.click('[data-action="payday-confirm"]');
  const result = await page.evaluate((month) => {
    const before = monthSummary(month).available;
    state.extraSave[apprenticeYear(month)] += 30; // saving more after the payday answer
    const after = monthSummary(month);
    const entry = state.savingEntries.find((item) => item.payday === month);
    return { before, available: after.available, counted: paydayAmount(entry), stored: entry.amount };
  }, previous);
  expect(result.before).toBeCloseTo(0);
  expect(result.available).toBeCloseTo(0);
  expect(result.counted).toBeCloseTo(result.stored - 30);
});

test("an amount saved at payday can be undone in the new month", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await makePaydayDue(page);
  await page.click('[data-action="payday-confirm"]');
  await goTo(page, "month");
  await page.click('#monthMath [data-action="undo-payday-save"]');
  expect(await page.evaluate(() => state.savingEntries.filter((entry) => entry.payday).length)).toBe(0);
  // The question comes again, so it can be answered differently
  await page.evaluate(() => checkPayday());
  await expect(page.locator("#paydayDialog")).toBeVisible();
});

test("older entries 'Übrig aus …' (saved before the payday mark existed) can be undone too", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await page.evaluate(() => {
    state.savingEntries.push({ id: 777, date: todayISO(), desc: "Übrig aus September", cat: savingAccounts()[0].name, pay: "", amount: 40 });
    render();
  });
  await goTo(page, "month");
  await page.click('#monthMath [data-action="undo-payday-save"]');
  expect(await page.evaluate(() => state.savingEntries.some((entry) => entry.id === 777))).toBe(false);
});
