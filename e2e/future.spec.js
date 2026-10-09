// Sparzukunft page, salary and allowances as one row, renaming allowances
const { test, expect, createUser, skipTour, goTo } = require("./fixtures");

async function setUp(page) {
  await page.evaluate(() => {
    state.salaries = [650, 950, 1200, 1500];
    state.extraSave = [100, 150, 200, 300];
    state.thirteenth = "12";
    state.thirteenthSave = [true, false, false, false];
    const allowance = state.allowances[0];
    allowance.enabled = true;
    allowance.per = "month";
    allowance.amounts = [120, 120, 200, 200];
    allowance.save = [50, 50, 0, 0];
    render();
  });
}

test("Sparzukunft shows what is saved per year and until the end of the apprenticeship", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await setUp(page);
  await goTo(page, "future");
  // Year 1: 100 + 50 per month of 770, plus the 13th (650) once
  const first = page.locator("#saveOverview .save-year").first();
  await expect(first).toContainText("CHF 150.00");
  await expect(first).toContainText("CHF 770.00");
  await expect(first).toContainText("CHF 620.00");
  await expect(first.locator(".save-yearly")).toContainText("CHF 650.00");
  // (150×12 + 650) + 200×12 + 200×12 + 300×12
  await expect(page.locator("#futureTotal")).toHaveText("CHF 10’850.00");
  await expect(page.locator("#futureYears li")).toHaveCount(4);

  await page.click('[data-action="edit-saving"]');
  await expect(page.locator("#settings")).toHaveClass(/active/);
  await expect(page.locator('[data-settings-tab-button="pay"]')).toHaveClass(/active/);
});

test("salary and allowances are one row; the name is only shown where something is saved", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await setUp(page);
  const texts = await page.evaluate(() => monthLedger(currentMonth).map((row) => row.text));
  const name = await page.evaluate(() => state.allowances[0].name);
  expect(texts).toContain("Lohn + Pauschale");
  expect(texts).not.toContain("Lohn");
  expect(texts).not.toContain(name);
  expect(texts).toContain(`${name} sparen`);

  // Two allowances: "Lohn + Pauschalen"
  const plural = await page.evaluate(() => {
    const second = state.allowances[1];
    second.enabled = true;
    second.per = "month";
    second.amounts = [30, 30, 30, 30];
    return monthLedger(currentMonth).find((row) => row.kind === "income" && row.text.startsWith("Lohn"));
  });
  expect(plural.text).toBe("Lohn + Pauschalen");
  expect(plural.amount).toBe(800);

  // No allowances: just "Lohn"
  const alone = await page.evaluate(() => {
    state.allowances.forEach((allowance) => (allowance.enabled = false));
    return monthLedger(currentMonth).map((row) => row.text);
  });
  expect(alone).toContain("Lohn");
});

test("an allowance can be renamed", async ({ page, request }) => {
  await createUser(page, request);
  await skipTour(page);
  await setUp(page);
  await goTo(page, "settings");
  await page.click('[data-settings-tab-button="pay"]');
  const id = await page.evaluate(() => state.allowances[0].id);
  page.answerDialog("Essen");
  await page.click(`[data-action="rename-allowance"][data-id="${id}"]`);
  await expect(page.locator("#allowanceList")).toContainText("Essen");
  expect(await page.evaluate(() => state.allowances[0].name)).toBe("Essen");
});
