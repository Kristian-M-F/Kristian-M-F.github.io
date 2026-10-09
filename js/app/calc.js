"use strict";

// Finance OS app, part: Pay months and calculations: dates, wage, 13th-month salary, standing orders, totals, account balances, "Tracken ab".
// Loaded by app.html in this order: state.js → calc.js → render.js → render-settings.js → layout.js → navigation.js → forms.js → main.js

// Dates and pay months

const zurichDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function todayISO() {
  const parts = zurichDate.formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Accepts "DD.MM.YYYY" (older saved drafts) or "YYYY-MM-DD" and returns an ISO date or "".
function parseDate(text) {
  const value = String(text ?? "").trim();
  const swiss = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso = swiss ? `${swiss[3]}-${swiss[2]}-${swiss[1]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(iso + "T00:00:00Z");
  return !isNaN(date) && date.toISOString().slice(0, 10) === iso ? iso : "";
}

function formatDate(iso) {
  return iso ? iso.split("-").reverse().join(".") : "";
}

function readDate(id) {
  return parseDate($(id).value);
}

function addMonths(month, count) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + count, 1)).toISOString().slice(0, 7);
}

function monthsBetween(from, to) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

// "1. Lehrjahr" in the current language
const yearLabel = (index) => t("{n}. Lehrjahr", { n: index + 1 });

const yearIndexes = () => Array.from({ length: state.years }, (_, i) => i);

// First pay month = first payday on or after the start (start 1 Aug, payday 25 -> 25 Aug).
function firstMonth() {
  const day = Number(state.start.slice(8, 10));
  return addMonths(state.start.slice(0, 7), day <= state.payday ? 0 : 1);
}

// All pay months of the apprenticeship plus the month after it ends.
function monthList() {
  const first = firstMonth();
  return Array.from({ length: state.years * 12 + 1 }, (_, i) => addMonths(first, i));
}

function monthName(month) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1).toLocaleDateString(I18N.locale, { month: "long", year: "numeric" });
}

function shortMonth(month) {
  return `${month.slice(5)}.${month.slice(2, 4)}`;
}

const pad2 = (n) => String(n).padStart(2, "0");

// A pay month runs from the payday (e.g. the 25th) to the day before it in the next month.
// With payday 1 it is exactly the calendar month.
function payrollMonth(date) {
  const day = Number(date.slice(8, 10));
  return addMonths(date.slice(0, 7), day < state.payday ? -1 : 0);
}

function period(month) {
  const next = addMonths(month, 1);
  const end = state.payday === 1 ? dateInMonth(month, 31) : `${next}-${pad2(state.payday - 1)}`;
  return { start: `${month}-${pad2(state.payday)}`, end };
}

function paydayText() {
  return state.payday === 1
    ? t("Jeder Lohnmonat ist ein Kalendermonat (1. bis Monatsende).")
    : t("Jeder Lohnmonat beginnt am {start}. und endet am {end}. des nächsten Monats.", {
        start: state.payday,
        end: state.payday - 1,
      });
}

function periodLabel(month) {
  const { start, end } = period(month);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function hasStarted(month) {
  return period(month).start <= todayISO();
}

function apprenticeYear(month) {
  const year = Math.floor(monthsBetween(firstMonth(), month) / 12);
  return Math.min(state.years - 1, Math.max(0, year));
}

// "Tracken ab": the first pay month that counts. Months before it are not tracked:
// no wage, no saving, no standing orders, nothing in the statistics.
function trackStart() {
  const first = firstMonth();
  return state.trackFrom && state.trackFrom > first ? state.trackFrom : first;
}

const isTracked = (month) => month >= trackStart();
const counts = (month) => hasStarted(month) && isTracked(month);

// Months included in the totals: every started and tracked pay month of the apprenticeship.
function countedMonths() {
  return monthList().filter(counts);
}

// The pay month of today, or the nearest month of the apprenticeship.
function todaysMonth() {
  const months = monthList();
  const thisMonth = payrollMonth(todayISO());
  if (months.includes(thisMonth)) return thisMonth;
  return thisMonth > months.at(-1) ? months.at(-1) : months[0];
}

function initialMonth() {
  const months = monthList();
  if (months.includes(state.currentMonth)) return state.currentMonth;
  const thisMonth = payrollMonth(todayISO());
  if (months.includes(thisMonth)) return thisMonth;
  return thisMonth > months.at(-1) ? months.at(-1) : months[0];
}

function setCurrentMonth(month) {
  currentMonth = month;
  state.currentMonth = month;
}

// Today if it lies in the selected pay month, otherwise the first day of that month.
function defaultDate() {
  const today = todayISO();
  const { start, end } = period(currentMonth);
  return today >= start && today <= end ? today : start;
}

// Calculations

function entriesIn(list, month) {
  const today = todayISO();
  return list.filter((entry) => payrollMonth(entry.date) === month && entry.date <= today);
}

// Day in a month, capped at its last day (e.g. 31 -> 28 February).
function dateInMonth(yearMonth, day) {
  const [year, monthNumber] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${yearMonth}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

// Due date of a standing order within a pay month, or null if it is not due.
// A pay month spans two calendar months, so both are checked.
function recurringDueDate(order, month) {
  const day = Number(order.start.slice(8, 10));
  const intervalMonths = (INTERVALS[order.interval] || INTERVALS.monthly).months;
  const startMonth = order.start.slice(0, 7);
  return (
    [month, addMonths(month, 1)]
      .filter((calendarMonth) => {
        const elapsed = monthsBetween(startMonth, calendarMonth);
        return elapsed >= 0 && elapsed % intervalMonths === 0;
      })
      .map((calendarMonth) => dateInMonth(calendarMonth, day))
      .find((date) => payrollMonth(date) === month) ?? null
  );
}

// Standing orders that count in a month: the paid ones. kind filters "expense", "income" or "saving".
function dueRecurring(month, kind) {
  return plannedRecurring(month)
    .filter((payment) => isPaid(payment) && (!kind || payment.order.kind === kind))
    .map((payment) => payment.order);
}

function plannedRecurring(month) {
  const { start, end } = period(month);
  return state.recurring.flatMap((order) => {
    const date = recurringDueDate(order, month);
    return date && date >= start && date <= end && date >= order.start && (!order.end || date <= order.end)
      ? [{ order, date }]
      : [];
  });
}

function recurringPaymentKey(id, date) {
  return `${id}:${date}`;
}

// A payment is paid automatically from its due date on (the same day included) and then
// counts against "available". Before that it is open. Under "Geplante Zahlungen" it can be
// marked the other way; state.paidRecurring only keeps such changes (true = paid, false = open).
function isPaid({ order, date }) {
  const changed = state.paidRecurring[recurringPaymentKey(order.id, date)];
  return typeof changed === "boolean" ? changed : date <= todayISO();
}

function toggleRecurringPayment(data) {
  const id = Number(data.id);
  const order = state.recurring.find((item) => item.id === id);
  if (!order) return;
  const key = recurringPaymentKey(id, data.date);
  const paid = !isPaid({ order, date: data.date });
  const automatic = data.date <= todayISO();
  if (paid === automatic) delete state.paidRecurring[key];
  else state.paidRecurring[key] = paid;
  persist();
}

// 13th-month salary: one extra monthly wage with the November or December pay.
// "spread": already contained in the monthly wage, so nothing extra is paid out.
function thirteenthSalary(month, salary) {
  return ["11", "12"].includes(state.thirteenth) && month.slice(5, 7) === state.thirteenth ? salary : 0;
}

// 13th-month salary for the column in the wage table.
// Spread over the 12 wages: the part of the 13th in each net wage is net wage ÷ 13.
// Paid in November or December: one extra monthly wage per year.
function thirteenthPerYear(monthlyWage) {
  if (state.thirteenth === "spread") return monthlyWage / 13;
  if (state.thirteenth === "11" || state.thirteenth === "12") return monthlyWage;
  return 0;
}

function thirteenthText() {
  if (state.thirteenth === "spread") {
    return (
      t("Dein Nettolohn enthält den 13. Monatslohn schon: Er wird nicht zusätzlich ausbezahlt. Die Spalte zeigt den Anteil in jedem Lohn (Nettolohn ÷ 13).") +
      " " +
      t("Mit dem Schalter sparst du diesen Anteil jeden Monat direkt aufs Sparkonto.")
    );
  }
  const saveHint = " " + t("Mit dem Schalter beim 13. Monatslohn sparst du ihn direkt aufs Sparkonto.");
  if (state.thirteenth === "11") return t("Mit dem Novemberlohn kommt ein zusätzlicher Monatslohn dazu.") + saveHint;
  if (state.thirteenth === "12") return t("Mit dem Dezemberlohn kommt ein zusätzlicher Monatslohn dazu.") + saveHint;
  return "";
}

function monthSummary(month) {
  if (!isTracked(month)) {
    return { salary: 0, bonus: 0, bonusSave: 0, allowances: [], allowanceSave: 0, extra: 0, withdrawn: 0, otherIncome: 0, carriedIn: 0, carriedOut: 0, income: 0, saved: 0, spent: 0, available: 0 };
  }
  const year = apprenticeYear(month);
  const paid = hasStarted(month);
  const amount = (list) => (paid ? Number(list[year]) || 0 : 0);
  const salary = amount(state.salaries);
  const bonus = thirteenthSalary(month, salary);
  // 13th-month salary saved straight away (switch in the settings, per apprenticeship year):
  // paid in November/December -> the whole extra wage once; spread over 12 wages -> the part in
  // every wage (net wage ÷ 13) each month.
  const saveThirteenth = Boolean((state.thirteenthSave || [])[year]);
  const bonusSave = !saveThirteenth
    ? 0
    : state.thirteenth === "spread"
      ? Math.round((salary / 13) * 100) / 100
      : bonus;
  // A yearly allowance comes once, with the first wage of each apprenticeship year.
  const firstOfYear = monthsBetween(firstMonth(), month) % 12 === 0;
  const allowances = enabledAllowances()
    .filter((allowance) => allowance.per !== "year" || firstOfYear)
    .map((allowance) => ({
      name: allowance.name,
      per: allowance.per === "year" ? "year" : "month",
      amount: amount(allowance.amounts),
      save: amount(allowance.save),
    }));
  const allowanceTotal = sumBy(allowances, (allowance) => allowance.amount);
  const allowanceSave = sumBy(allowances, (allowance) => allowance.save);
  const extra = amount(state.extraSave);
  const total = (list) => sumBy(list, (item) => item.amount);

  // Income = wage, 13th-month salary and allowances (automatic on payday). Further income
  // (side job, gifts …) from entries and standing orders is added straight to "available".
  const income = salary + bonus + allowanceTotal;
  const otherIncome = total(entriesIn(state.incomeEntries, month)) + total(dueRecurring(month, "income"));
  const withdrawn = total(entriesIn(state.withdrawEntries, month));
  const saved =
    allowanceSave + extra + bonusSave + total(entriesIn(state.savingEntries, month)) + total(dueRecurring(month, "saving")) - withdrawn;
  const spent = total(entriesIn(state.expenses, month)) + total(dueRecurring(month, "expense"));
  // Left over at the last payday and taken along into this month, or from this month into the next.
  const carriedIn = carriedFrom(addMonths(month, -1));
  const carriedOut = carriedFrom(month);
  return {
    salary, bonus, bonusSave, allowances, allowanceSave, extra, withdrawn, otherIncome, carriedIn, carriedOut,
    income, saved, spent, available: income + otherIncome + carriedIn - carriedOut - saved - spent,
  };
}

// Amount taken from this pay month into the next one (payday question, js/app/payday.js)
function carriedFrom(month) {
  return sumBy((state.carryOvers || []).filter((carry) => carry.from === month), (carry) => carry.amount);
}

function totals() {
  const total = { income: 0, saved: 0, spent: 0, allowanceSave: 0 };
  for (const month of countedMonths()) {
    const summary = monthSummary(month);
    total.income += summary.income;
    total.saved += summary.saved;
    total.spent += summary.spent;
    total.allowanceSave += summary.allowanceSave;
  }
  return total;
}

function categoryTotals(months = countedMonths()) {
  const result = {};
  const add = (category, amount) => {
    const key = category || t("Sonstiges");
    result[key] = (result[key] || 0) + (Number(amount) || 0);
  };
  for (const month of months.filter(counts)) {
    entriesIn(state.expenses, month).forEach((entry) => add(entry.cat, entry.amount));
    dueRecurring(month, "expense").forEach((order) => add(order.cat, order.amount));
  }
  return result;
}

// Accounts

const spendingAccount = () => state.accounts.find((account) => account.kind === "spending");
const savingAccounts = () => state.accounts.filter((account) => account.kind === "saving");
const savingNames = () => savingAccounts().map((account) => account.name);

// Money moved on each account in the given months; with opening balances = balance today.
function accountMoves(months, withOpening = false) {
  const balance = Object.fromEntries(state.accounts.map((account) => [account.id, withOpening ? Number(account.start) || 0 : 0]));
  const idByName = Object.fromEntries(savingAccounts().map((account) => [account.name, account.id]));
  const autoId = state.autoAccount in balance ? state.autoAccount : savingAccounts()[0]?.id;
  const add = (id, amount) => {
    if (id in balance) balance[id] += Number(amount) || 0;
  };
  for (const month of months.filter(counts)) {
    const summary = monthSummary(month);
    add(spendingAccount().id, summary.available);
    add(autoId, summary.allowanceSave + summary.extra + summary.bonusSave);
    entriesIn(state.savingEntries, month).forEach((entry) => add(idByName[entry.cat] ?? autoId, entry.amount));
    dueRecurring(month, "saving").forEach((order) => add(idByName[order.cat] ?? autoId, order.amount));
    entriesIn(state.withdrawEntries, month).forEach((entry) => add(idByName[entry.cat] ?? autoId, -entry.amount));
  }
  return balance;
}

// Balance today: opening balance plus every movement since the start of the apprenticeship.
const accountBalances = () => accountMoves(countedMonths(), true);

function monthLedger(month) {
  const summary = monthSummary(month);
  const start = period(month).start;
  const rows = [];
  const add = (date, text, amount, kind, label) => {
    if (amount) rows.push({ date, text, amount, kind, label });
  };

  // label: small second line under the description, only where it adds information
  const year = yearLabel(apprenticeYear(month));
  const automatic = t("Automatisch");
  add(start, t("Lohn"), summary.salary, "income", `${automatic} · ${year}`);
  add(start, t("13. Monatslohn"), summary.bonus, "income", automatic);
  const autoName = state.accounts.find((account) => account.id === state.autoAccount)?.name || "";
  const toSavings = t("Aufs Sparkonto „{name}“", { name: autoName });
  for (const allowance of summary.allowances) {
    add(start, allowance.name, allowance.amount, "income", allowance.per === "year" ? t("Pauschale · jährlich") : t("Pauschale · automatisch"));
    add(start, t("{name} sparen", { name: allowance.name }), allowance.save, "saving", toSavings);
  }
  add(start, t("Automatisch sparen"), summary.extra, "saving", toSavings);
  add(start, t("13. Monatslohn sparen"), summary.bonusSave, "saving", toSavings);
  for (const payment of plannedRecurring(month).filter(isPaid)) {
    add(payment.date, payment.order.name, payment.order.amount, payment.order.kind, t("Dauerauftrag"));
  }
  for (const entry of entriesIn(state.expenses, month)) {
    add(entry.date, entry.desc, entry.amount, "expense", "");
  }
  for (const entry of entriesIn(state.savingEntries, month)) {
    add(entry.date, entry.desc, entry.amount, "saving", t("Aufs Sparkonto „{name}“", { name: entry.cat }));
  }
  for (const entry of entriesIn(state.withdrawEntries, month)) {
    add(entry.date, entry.desc, entry.amount, "withdraw", t("Vom Sparkonto „{name}“", { name: entry.cat }));
  }
  for (const entry of entriesIn(state.incomeEntries, month)) {
    add(entry.date, entry.desc, entry.amount, "income", "");
  }
  // Payday question: left over from the last pay month / taken into the next one
  for (const carry of (state.carryOvers || []).filter((item) => addMonths(item.from, 1) === month)) {
    add(start, t("Übertrag aus {month}", { month: monthName(carry.from) }), carry.amount, "carryIn", carryUndo(carry));
  }
  for (const carry of (state.carryOvers || []).filter((item) => item.from === month)) {
    add(period(month).end, t("In den {month} mitgenommen", { month: monthName(addMonths(month, 1)) }), carry.amount, "carryOut", carryUndo(carry));
  }

  // Newest first; on the same day the most recently added row comes first.
  return rows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
}

function allEntries() {
  return Object.keys(ENTRY_KINDS)
    .flatMap((type) => state[type].map((entry) => ({ ...entry, type, kind: ENTRY_KINDS[type] })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}
