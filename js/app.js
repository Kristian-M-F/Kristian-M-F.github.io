"use strict";

// Finance OS app (app.html).
// Sections: constants, data, appearance, storage, helpers, pay months, calculations,
// accounts, rendering, navigation, forms, settings, categories, profile, events, start.

// Translate the static page text before any user data is rendered,
// so user-defined names (categories, accounts) are never translated.
const t = I18N.t;
I18N.translatePage();

// Constants

const STORAGE_KEY = "financeOS_v2";
const MAX_YEARS = 4; // longest apprenticeship (4-year EFZ); the actual length is a setting

// Entry kind in the form -> list in the data
const ENTRY_TYPES = {
  expense: "expenses",
  saving: "savingEntries",
  withdraw: "withdrawEntries",
  income: "incomeEntries",
};
const ENTRY_KINDS = {
  expenses: "expense",
  savingEntries: "saving",
  withdrawEntries: "withdraw",
  incomeEntries: "income",
};
const KIND_LABELS = {
  income: t("Eingenommen"),
  expense: t("Ausgegeben"),
  saving: t("Aufs Sparkonto"),
  withdraw: t("Vom Sparkonto"),
};
const AMOUNT_STYLES = {
  income: { sign: "+", className: "good" },
  expense: { sign: "−", className: "bad" },
  saving: { sign: "↗", className: "transfer" },
  withdraw: { sign: "↙", className: "good" },
};
// Standing order interval -> number of months between payments
const INTERVALS = {
  monthly: { label: t("Monatlich"), months: 1 },
  quarterly: { label: t("Vierteljährlich"), months: 3 },
  halfyearly: { label: t("Halbjährlich"), months: 6 },
  yearly: { label: t("Jährlich"), months: 12 },
};
// Shown under the entry form: what the chosen kind does with "available".
const ENTRY_HINTS = {
  expense: t("Wird vom Lohnkonto abgezogen und verringert „Verfügbar“."),
  income: t("Kommt direkt zu „Verfügbar“ dazu – zusätzlich zu Lohn und Pauschalen."),
  saving: t("Geht vom Lohnkonto aufs Sparkonto und ist danach nicht mehr verfügbar."),
  withdraw: t("Kommt vom Sparkonto zurück aufs Lohnkonto und erhöht „Verfügbar“."),
};
const RECURRING_KIND_LABELS = {
  expense: t("Ausgabe"),
  income: t("Einnahme"),
  saving: t("Sparen"),
};
const RECORD_LABELS = {
  expenses: t("Ausgabe"),
  savingEntries: t("Aufs Sparkonto"),
  withdrawEntries: t("Vom Sparkonto"),
  incomeEntries: t("Einnahme"),
  recurring: t("Dauerauftrag"),
};

const FORMS = {
  expenses: {
    page: "expenses",
    fields: ["exDate", "exDesc", "exCat", "exPay", "exAmount"],
    keepAfterSave: ["exDate", "exCat", "exPay"],
    saveButton: "expenseSave",
    cancelButton: "expenseCancel",
    saveLabel: t("Speichern"),
  },
  recurring: {
    page: "recurring",
    fields: ["recKind", "recName", "recAmount", "recInterval", "recStart", "recEnd", "recCat"],
    keepAfterSave: ["recKind", "recCat"],
    saveButton: "recurringSave",
    cancelButton: "recurringCancel",
    saveLabel: t("Hinzufügen"),
  },
};

const DATE_FIELDS = ["exDate", "recStart", "recEnd", "setStart"];
const DEFAULT_DATE_FIELDS = ["exDate", "recStart"];
const DRAFT_FIELDS = ["entryKind", ...Object.values(FORMS).flatMap((form) => form.fields)];
const SETTINGS_FIELD =
  /^(setStart|setYears|setPayday|setThirteenth|setAutoAccount|salary\d|extraSave\d)$/;

// Data

// Allowances are fixed amounts paid on top of the wage (meals, public transport, …).
// Each has an amount and a saved part per apprenticeship year.

// per: "month" (with every wage) or "year" (once, with the first wage of each apprenticeship year)
function newAllowance(id, name, enabled = false) {
  return { id, name, enabled, per: "month", amounts: Array(MAX_YEARS).fill(0), save: Array(MAX_YEARS).fill(0) };
}

// Default names in German; they are shown in the chosen language (see localizeDefaultNames).
const DEFAULT_ALLOWANCE_NAMES = {
  food: "Essenspauschale",
  transport: "Fahrkosten / ÖV",
  phone: "Handy",
  clothes: "Arbeitskleider / Werkzeug",
};
const DEFAULT_ACCOUNT_NAMES = { main: "Lohnkonto", save: "Sparkonto" };
const DEFAULT_LISTS = {
  categories: ["Essen", "Freizeit/Ausgang", "Motorrad/Auto", "Kleidung", "Abos", "Schule", "Technik", "Sport", "Ferien", "Sonstiges"],
  incomeCategories: ["Nebenjob", "Geschenk", "Rückzahlung", "Sonstiges"],
  payments: ["Karte", "TWINT", "Bar", "Überweisung"],
};

// New accounts start with public transport (on) and the meal allowance (off); more can be added.
const STARTING_ALLOWANCES = ["transport", "food"];

function defaultAllowances() {
  return STARTING_ALLOWANCES.map((id) => newAllowance(id, t(DEFAULT_ALLOWANCE_NAMES[id]), id === "transport"));
}

const enabledAllowances = () => state.allowances.filter((allowance) => allowance.enabled);

function createEmptyData() {
  return {
    start: "2026-08-01",
    years: 4, // apprenticeship length: 2, 3 or 4 years
    payday: 25, // a pay month runs from the payday to the day before it in the next month
    allowances: defaultAllowances(),
    // 13th-month salary: "none", "spread" (already in the 12 monthly wages),
    // "11" (extra wage with the November pay) or "12" (December)
    thirteenth: "none",
    // Exactly one spending account plus any number of savings accounts
    accounts: [
      { id: "main", name: t(DEFAULT_ACCOUNT_NAMES.main), kind: "spending", start: 0 },
      { id: "save", name: t(DEFAULT_ACCOUNT_NAMES.save), kind: "saving", start: 0 },
    ],
    autoAccount: "save", // receives automatic savings and the saved part of allowances
    salaries: [0, 0, 0, 0],
    extraSave: [0, 0, 0, 0],
    // Defaults in the current language; users can rename them.
    categories: DEFAULT_LISTS.categories.map((name) => t(name)),
    incomeCategories: DEFAULT_LISTS.incomeCategories.map((name) => t(name)),
    payments: DEFAULT_LISTS.payments.map((name) => t(name)),
    expenses: [],
    savingEntries: [],
    withdrawEntries: [],
    incomeEntries: [],
    recurring: [],
    paidRecurring: {},
    appearance: { ...DEFAULT_APPEARANCE },
    currentMonth: null,
    drafts: {},
    editing: {},
  };
}

// Appearance (accent colour, light/dark, text size, hidden amounts).
// Saved with the account and cached in the browser so the colours are right on load.
// The styles themselves are in css/themes.css.

const APPEARANCE_KEY = "financeOS_appearance";
const DEFAULT_APPEARANCE = {
  accent: "violet", // Lila; accounts that saved another colour keep it
  mode: "system", // follow the device
  text: "normal",
  startPage: "dashboard",
};
const APPEARANCE_FIELDS = ["accent", "mode", "text", "startPage"];
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
let appearance = { ...DEFAULT_APPEARANCE };

function applyAppearance(next) {
  appearance = { ...DEFAULT_APPEARANCE, ...next };
  const root = document.documentElement;
  const dark = appearance.mode === "dark" || (appearance.mode === "system" && darkQuery.matches);
  root.dataset.accent = appearance.accent;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.text = appearance.text;
  // The light bulb label describes what a click will do.
  const label = I18N.t(dark ? "Licht an (helles Design)" : "Licht aus (dunkles Design)");
  const themeButton = document.getElementById("appTheme");
  themeButton.setAttribute("aria-pressed", String(!dark));
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    // Private mode.
  }
}

// Fill the appearance form with the current values.
function renderAppearance() {
  for (const name of ["accent", "mode", "text"]) {
    const input = document.querySelector(`input[name="${name}"][value="${appearance[name]}"]`);
    if (input) input.checked = true;
  }
  $("startPage").value = appearance.startPage;
}

function changeAppearance(field) {
  const value = field.type === "checkbox" ? field.checked : field.value;
  state.appearance = { ...appearance, [field.name]: value };
  applyAppearance(state.appearance);
  save();
}

try {
  applyAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)) || {});
} catch {
  applyAppearance({});
}
darkQuery.addEventListener("change", () => applyAppearance(appearance));

// Served by Spring Boot (http://localhost:8080): login and data per user in the database.
// Opened as a file (file://): data stays in this browser only.
const ONLINE = location.protocol.startsWith("http") && typeof api === "function";

function readLocalData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function loadData(saved) {
  const data = { ...createEmptyData(), ...saved };

  // Older versions had a single meal allowance (food, foodSave, hasFood).
  if (!Array.isArray(saved.allowances) && ("food" in saved || "foodSave" in saved)) {
    const food = Array.isArray(saved.food) ? saved.food : Array(MAX_YEARS).fill(Number(saved.food) || 0);
    data.allowances[0] = {
      ...data.allowances[0],
      enabled: saved.hasFood !== false,
      amounts: food.map((value) => Number(value) || 0),
      save: (saved.foodSave || []).map((value) => Number(value) || 0),
    };
  }
  delete data.food;
  delete data.foodSave;
  delete data.hasFood;
  // Older versions had "saving categories"; the ones in use become savings accounts.
  if (!Array.isArray(saved.accounts)) {
    const used = new Set([
      ...data.savingEntries.map((entry) => entry.cat),
      ...data.recurring.filter((order) => order.kind === "saving").map((order) => order.cat),
    ]);
    // "Sparkonto" in any language is the default savings account.
    const defaultName = data.accounts[1].name;
    const isDefault = (name) => !name || spellingsOf(DEFAULT_ACCOUNT_NAMES.save).has(name);
    const names = [defaultName, ...[...used].filter((name) => !isDefault(name))];
    data.accounts = [
      data.accounts[0],
      ...names.map((name, i) => ({ id: i === 0 ? "save" : "s" + i, name, kind: "saving", start: 0 })),
    ];
    const savingRecords = [...data.savingEntries, ...data.recurring.filter((order) => order.kind === "saving")];
    savingRecords.forEach((record) => {
      if (isDefault(record.cat)) record.cat = defaultName;
    });
  }
  if (!data.accounts.some((account) => account.id === data.autoAccount && account.kind === "saving")) {
    data.autoAccount = data.accounts.find((account) => account.kind === "saving")?.id;
  }
  delete data.savingCategories;
  delete data.confirmedMonths;
  delete data.countFrom;
  data.recurring = data.recurring.map((order) => ({ kind: "expense", interval: "monthly", ...order }));
  return data;
}

// Renaming a list item or a savings account also renames it in all bookings.
function bookingsUsing(type) {
  const ofKind = (kind) => state.recurring.filter((order) => order.kind === kind);
  return {
    categories: [...state.expenses, ...ofKind("expense")],
    incomeCategories: [...state.incomeEntries, ...ofKind("income")],
    payments: [...state.expenses, ...state.savingEntries, ...state.withdrawEntries, ...state.incomeEntries],
    accounts: [...state.savingEntries, ...state.withdrawEntries, ...ofKind("saving")],
  }[type];
}

function renameInBookings(type, oldName, name) {
  const key = type === "payments" ? "pay" : "cat";
  bookingsUsing(type).forEach((record) => {
    if (record[key] === oldName) record[key] = name;
  });
}

// Half-filled forms keep pointing at the renamed item.
function renameInDrafts(oldName, name) {
  for (const id of ["exCat", "exPay", "recCat"]) {
    if (state.drafts?.[id] === oldName) state.drafts[id] = name;
  }
}

// The German name and all its translations.
function spellingsOf(germanName) {
  return new Set([germanName, ...(window.TRANSLATIONS?.[germanName] || [])]);
}

// Default names (categories, accounts, allowances …) follow the chosen language, also when the
// language is changed later. Names the user typed in are never touched.
function localizeDefaultNames() {
  // Every spelling of a default name (German and all translations) → its current translation.
  const localized = (germanName) => {
    const spellings = spellingsOf(germanName);
    return (name) => (spellings.has(name) ? t(germanName) : null);
  };
  let changed = false;

  for (const [type, defaults] of Object.entries(DEFAULT_LISTS)) {
    const list = state[type];
    defaults.forEach((germanName) => {
      const translate = localized(germanName);
      list.forEach((name, index) => {
        const next = translate(name);
        if (!next || next === name || list.includes(next)) return;
        list[index] = next;
        renameInBookings(type, name, next);
        renameInDrafts(name, next);
        changed = true;
      });
    });
  }

  for (const account of state.accounts) {
    const germanName = DEFAULT_ACCOUNT_NAMES[account.id];
    const next = germanName && localized(germanName)(account.name);
    if (!next || next === account.name || state.accounts.some((other) => other.name === next)) continue;
    if (account.kind === "saving") renameInBookings("accounts", account.name, next);
    renameInDrafts(account.name, next);
    account.name = next;
    changed = true;
  }

  for (const allowance of state.allowances) {
    const germanName = DEFAULT_ALLOWANCE_NAMES[allowance.id];
    const next = germanName && localized(germanName)(allowance.name);
    if (!next || next === allowance.name) continue;
    allowance.name = next;
    changed = true;
  }
  return changed;
}

function loadEditing() {
  const saved = state.editing || {};
  const result = {};
  for (const form of Object.keys(FORMS)) {
    const edit = saved[form];
    const exists = edit && state[edit.type]?.some((record) => record.id === edit.id);
    result[form] = exists ? edit : null;
  }
  return result;
}

let state = createEmptyData();
let editing = {};
let currentMonth = null;
let lastId = 0;
let ready = false;

function save() {
  state.editing = editing;
  if (ONLINE) return saveOnline();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    notify("Der Browser blockiert das Speichern. Deine Daten bleiben nur während dieser Sitzung erhalten.");
  }
}

function setSaveStatus(text, isError = false) {
  const status = $("saveStatus");
  status.textContent = text;
  status.classList.toggle("error", isError);
}

// Debounced: typing does not send a request for every key stroke.
function saveOnline() {
  clearTimeout(saveOnline.timer);
  saveOnline.pending = true;
  setSaveStatus(t("Speichert …"));
  saveOnline.timer = setTimeout(sendData, 400);
}

async function sendData() {
  saveOnline.pending = false;
  try {
    await api("/data", { method: "PUT", body: state });
    if (!saveOnline.pending) setSaveStatus(t("Alles gespeichert"));
  } catch (error) {
    setSaveStatus(t("Nicht gespeichert"), true);
    notify(t("Speichern fehlgeschlagen:") + " " + t(error.message));
  }
}

// Sends pending changes immediately when the tab is closed.
function flushData() {
  if (!ONLINE || !saveOnline.pending) return;
  clearTimeout(saveOnline.timer);
  saveOnline.pending = false;
  fetch(API_BASE + "/data", {
    method: "PUT",
    keepalive: true,
    credentials: "same-origin",
    headers: requestHeaders(true),
    body: JSON.stringify(state),
  }).catch(() => {});
}

function persist() {
  save();
  render();
}

function newId() {
  lastId = Math.max(Date.now(), lastId + 1);
  return lastId;
}

// Helpers

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (char) => map[char]);
}

function chf(amount) {
  const formatted = (Number(amount) || 0).toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "CHF " + formatted;
}

function percent(value) {
  return value.toFixed(1) + " %";
}

function sumBy(list, getValue) {
  return list.reduce((total, item) => total + (Number(getValue(item)) || 0), 0);
}

function parseAmount(text) {
  const value = String(text ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  return value === "" ? NaN : Number(value);
}

function readAmount(id, allowZero = false) {
  // An empty field counts as 0 where 0 is allowed.
  if (allowZero && $(id).value.trim() === "") return 0;
  const amount = parseAmount($(id).value);
  const valid = Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0);
  return valid ? amount : null;
}

// Shows a toast message; German texts (also from the server) are translated.
// Short message at the bottom. With undo, it shows a "Rückgängig" button and stays a bit longer.
function notify(message, params, undo = null) {
  message = t(message, params);
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.toggle("with-action", Boolean(undo));
  if (undo) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = t("Rückgängig");
    button.addEventListener("click", () => {
      toast.hidden = true;
      undo();
    });
    toast.append(" ", button);
  }
  toast.hidden = false;
  clearTimeout(notify.timer);
  // Longer messages stay visible longer.
  notify.timer = setTimeout(() => (toast.hidden = true), Math.max(undo ? 6000 : 3500, message.length * 60));
}

// Questions and new names in the page's own dialog (app.html #appDialog) instead of the
// browser's prompt()/confirm(). Resolves with the typed text (input), true (question) or null (cancelled).
function askUser({ title, text = "", label = "", value = null, okLabel = t("OK"), danger = false }) {
  const dialog = $("appDialog");
  const input = $("appDialogInput");
  $("appDialogTitle").textContent = title;
  $("appDialogText").textContent = text;
  $("appDialogField").hidden = value === null;
  $("appDialogLabel").textContent = label;
  input.value = value ?? "";
  $("appDialogOk").textContent = okLabel;
  $("appDialogOk").classList.toggle("danger-solid", danger);

  return new Promise((resolve) => {
    const finish = (result) => {
      dialog.removeEventListener("close", onClose);
      $("appDialogForm").removeEventListener("submit", onSubmit);
      $("appDialogCancel").removeEventListener("click", onCancel);
      dialog.removeEventListener("click", onBackdrop);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      finish(value === null ? true : input.value.trim());
    };
    const onCancel = () => finish(null);
    const onClose = () => finish(null); // Escape
    const onBackdrop = (event) => {
      if (event.target === dialog) finish(null);
    };
    $("appDialogForm").addEventListener("submit", onSubmit);
    $("appDialogCancel").addEventListener("click", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onBackdrop);
    dialog.showModal();
    (value === null ? $("appDialogOk") : input).focus();
    if (value !== null) input.select();
  });
}

const confirmAction = async (options) => (await askUser({ danger: true, ...options })) === true;

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

// "25.09.–24.10." (short enough for a phone)
function shortPeriod(month) {
  const { start, end } = period(month);
  return `${formatDate(start).slice(0, 6)}–${formatDate(end).slice(0, 6)}`;
}

function hasStarted(month) {
  return period(month).start <= todayISO();
}

// Last day of a month that already counts (today or the end of the month).
function cutoff(month) {
  const today = todayISO();
  const { end } = period(month);
  return today < end ? today : end;
}

function apprenticeYear(month) {
  const year = Math.floor(monthsBetween(firstMonth(), month) / 12);
  return Math.min(state.years - 1, Math.max(0, year));
}

// Months included in the totals: every started pay month of the apprenticeship.
function countedMonths() {
  return monthList().filter(hasStarted);
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
    return t("Dein Nettolohn enthält den 13. Monatslohn schon: Er wird nicht zusätzlich ausbezahlt. Die Spalte zeigt den Anteil in jedem Lohn (Nettolohn ÷ 13).");
  }
  if (state.thirteenth === "11") return t("Mit dem Novemberlohn kommt ein zusätzlicher Monatslohn dazu.");
  if (state.thirteenth === "12") return t("Mit dem Dezemberlohn kommt ein zusätzlicher Monatslohn dazu.");
  return "";
}

function monthSummary(month) {
  const year = apprenticeYear(month);
  const paid = hasStarted(month);
  const amount = (list) => (paid ? Number(list[year]) || 0 : 0);
  const salary = amount(state.salaries);
  const bonus = thirteenthSalary(month, salary);
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
    allowanceSave + extra + total(entriesIn(state.savingEntries, month)) + total(dueRecurring(month, "saving")) - withdrawn;
  const spent = total(entriesIn(state.expenses, month)) + total(dueRecurring(month, "expense"));
  return {
    salary, bonus, allowances, allowanceSave, extra, withdrawn, otherIncome,
    income, saved, spent, available: income + otherIncome - saved - spent,
  };
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
  for (const month of months.filter(hasStarted)) {
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
  for (const month of months.filter(hasStarted)) {
    const summary = monthSummary(month);
    add(spendingAccount().id, summary.available);
    add(autoId, summary.allowanceSave + summary.extra);
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

// Rendering

function amountCell(kind, amount) {
  const { sign, className } = AMOUNT_STYLES[kind];
  return `<td class="money ledger-amount ${className}">${sign} ${chf(Math.abs(amount))}</td>`;
}

// detail may contain HTML (the "planned" badge); text is escaped. No detail, no second line.
function descriptionCell(text, detail) {
  const second = detail ? `<div class="ledger-detail">${detail}</div>` : "";
  return `<td class="ledger-description"><div>${escapeHTML(text)}${second}</div></td>`;
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="empty">${text}</td></tr>`;
}

function plannedLabel(date, separator = "") {
  return date > todayISO() ? `${separator}<span class="planned-label">${t("Geplant")}</span>` : "";
}

function recordActions(type, id) {
  return `<div class="actions">
    <button class="secondary" data-action="edit-record" data-type="${type}" data-id="${id}">${t("Bearbeiten")}</button>
    <button class="danger" data-action="delete-record" data-type="${type}" data-id="${id}">${t("Löschen")}</button>
  </div>`;
}

function setValue(id, value) {
  const field = $(id);
  if (field !== document.activeElement) field.value = field.type === "date" ? parseDate(value) : value;
}

function setSelectValue(id, value, keepUnknown) {
  const select = $(id);
  const known = [...select.options].some((option) => option.value === value);
  if (!known && value && keepUnknown) {
    select.append(new Option(`${value} (${t("archiviert")})`, value));
  }
  if (known || keepUnknown) select.value = value;
}

function fillSelect(id, items, keepUnknown) {
  const current = $(id).value;
  $(id).innerHTML = items.map((item) => `<option>${escapeHTML(item)}</option>`).join("");
  setSelectValue(id, current, keepUnknown);
}

// Choices for an entry kind: expense or income categories, or the savings accounts.
function choicesFor(kind) {
  if (kind === "saving" || kind === "withdraw") return savingNames();
  return kind === "income" ? state.incomeCategories : state.categories;
}

function fillSelects() {
  const entryKind = $("entryKind").value;
  const recKind = $("recKind").value;
  const accountKind = (kind) => kind === "saving" || kind === "withdraw";
  $("exCatLabel").textContent = accountKind(entryKind) ? t("Sparkonto") : t("Kategorie");
  $("recCatLabel").textContent = accountKind(recKind) ? t("Sparkonto") : t("Kategorie");
  // Only expenses have a payment method: income always goes to the spending account,
  // transfers move money between the spending account and a savings account.
  $("exPay").closest(".field").hidden = entryKind !== "expense";
  $("entryHint").textContent = ENTRY_HINTS[entryKind] || "";
  fillSelect("exCat", choicesFor(entryKind), Boolean(editing.expenses));
  fillSelect("exPay", state.payments, Boolean(editing.expenses));
  fillSelect("recCat", choicesFor(recKind), Boolean(editing.recurring));
}

function yearCards() {
  const months = countedMonths();
  return yearIndexes().map((year) => {
    const saved = sumBy(
      months.filter((month) => apprenticeYear(month) === year),
      (month) => monthSummary(month).saved,
    );
    return `<div class="card kpi">
      <span class="label">${yearLabel(year)}</span>
      <strong>${chf(saved)}</strong>
      <div class="sub">${t("Gespart")}</div>
    </div>`;
  }).join("");
}

function renderDashboard() {
  renderAvailableHero();
  renderOnboarding();
  renderAccountCards();
  renderUpcoming();
  $("monthCategoryChart").innerHTML = categoryChart(categoryTotals([currentMonth]), t("Noch keine Ausgaben in diesem Lohnmonat."));

  // Statistics since the start of the apprenticeship (closed by default)
  const total = totals();
  $("dSaved").textContent = chf(total.saved);
  $("dIncome").textContent = chf(total.income);
  $("dSpent").textContent = chf(total.spent);
  $("dRate").textContent = percent(total.income ? (total.saved / total.income) * 100 : 0);
  renderSavingsChart();
  renderComparisonChart();
  $("categoryChart").innerHTML = categoryChart(categoryTotals(), t("Noch keine Ausgaben."));
  $("yearCards").innerHTML = yearCards();
}

// The big number: what is left in the selected pay month, and how it comes about.
function renderAvailableHero() {
  const month = currentMonth;
  const summary = monthSummary(month);
  const { end } = period(month);
  const today = todayISO();
  let status;
  if (!hasStarted(month)) status = t("Beginnt am {date}", { date: formatDate(period(month).start) });
  else if (today > end) status = t("Abgeschlossen");
  else {
    const days = Math.round((Date.parse(end) - Date.parse(today)) / 86400000) + 1;
    status = days === 1 ? t("Noch 1 Tag bis zum nächsten Lohn") : t("Noch {n} Tage bis zum nächsten Lohn", { n: days });
  }
  $("heroPeriod").textContent = `${monthName(month)} · ${periodLabel(month)} · ${status}`;

  $("heroAmount").textContent = chf(summary.available);
  $("heroAmount").classList.toggle("bad", summary.available < 0);
  const money = summary.income + summary.otherIncome;
  const used = money ? ((summary.saved + summary.spent) / money) * 100 : 0;
  $("heroBar").style.width = Math.min(100, Math.max(0, used)) + "%";
  $("heroBar").classList.toggle("over", summary.available < 0);
  $("heroUsed").textContent = money
    ? t("{percent} von {income} sind ausgegeben oder gespart.", { percent: percent(Math.max(0, used)), income: chf(money) })
    : t("Trage in den Einstellungen deinen Lohn ein, dann rechnet Finance OS aus, was verfügbar ist.");

  const line = (sign, label, amount, always = false) =>
    amount || always
      ? `<div class="summary-row"><span><span class="sign" aria-hidden="true">${sign}</span>${label}</span><b>${chf(amount)}</b></div>`
      : "";
  $("currentSummary").innerHTML = `
    ${line("+", t("Lohn + Pauschalen"), summary.income, true)}
    ${line("+", t("Weitere Einnahmen"), summary.otherIncome)}
    ${line("−", t("Ausgaben"), summary.spent, true)}
    ${line("−", t("Gespart"), summary.saved, true)}`;
}

// Standing orders in the selected pay month that are still open.
function renderUpcoming() {
  const upcoming = plannedRecurring(currentMonth)
    .filter((payment) => !isPaid(payment))
    .sort((a, b) => a.date.localeCompare(b.date));
  $("upcomingRows").innerHTML = upcoming.length
    ? upcoming
        .map(({ order, date }) => {
          const { sign, className } = AMOUNT_STYLES[order.kind] || AMOUNT_STYLES.expense;
          return `<li>
            <span class="upcoming-date">${formatDate(date).slice(0, 6)}</span>
            <span class="upcoming-name">${escapeHTML(order.name)}</span>
            <span class="money ${className}">${sign} ${chf(order.amount)}</span>
          </li>`;
        })
        .join("")
    : `<li><span class="empty">${t("Keine Daueraufträge mehr bis zum nächsten Lohn.")}</span></li>`;
  const counter = document.querySelector('[data-count-for="upcomingRows"]');
  if (counter) counter.textContent = upcoming.length || "";
}

// "First steps" card for new accounts; disappears once every step is done.
function renderOnboarding() {
  const steps = {
    stepSettings: state.salaries.some((amount) => Number(amount) > 0),
    stepRecurring: state.recurring.length > 0,
    stepEntries: state.expenses.length + state.incomeEntries.length + state.savingEntries.length + state.withdrawEntries.length > 0,
  };
  for (const [id, done] of Object.entries(steps)) $(id).classList.toggle("done", done);
  const allDone = Object.values(steps).every(Boolean);
  // After the first-time setup the questions are answered already, so the card is not needed.
  $("onboarding").hidden = allDone || Boolean(state.onboardingDismissed) || Boolean(state.setupDone);
}

function renderSavingsChart() {
  let running = 0;
  const points = countedMonths()
    .map((month) => ({ month, total: (running += monthSummary(month).saved) }))
    .slice(-12);
  const max = Math.max(1, ...points.map((point) => point.total));

  $("saveChart").innerHTML = points.length
    ? points
        .map(
          ({ month, total }) =>
            `<div class="bar" title="${monthName(month)}: ${chf(total)}" style="height:${Math.max(0, (total / max) * 100)}%"><i>${shortMonth(month)}</i></div>`,
        )
        .join("")
    : `<div class="empty">${t("Noch keine Daten.")}</div>`;
}

// Wage + allowances, expenses and savings per pay month as three bars.
function comparisonRows(months) {
  const summaries = months.map((month) => ({ month, ...monthSummary(month) }));
  const peak = Math.max(1, ...summaries.flatMap((summary) => [summary.income, summary.spent, summary.saved]));
  const bar = (kind, value) =>
    `<div class="compare-track ${kind}" aria-hidden="true"><span style="width:${(Math.max(0, value) / peak) * 100}%"></span></div>`;

  return summaries.length
    ? summaries
        .map(
          (summary) => `<div class="compare-row">
            <div class="compare-title">${monthName(summary.month)}</div>
            <div class="compare-values">
              <span class="income-value" title="${t("Lohn + Pauschalen")}">${chf(summary.income)}</span>
              <span class="spent-value" title="${t("Ausgaben")}">${chf(summary.spent)}</span>
              <span class="saved-value" title="${t("Gespart")}">${chf(summary.saved)}</span>
            </div>
            ${bar("income", summary.income)}
            ${bar("spent", summary.spent)}
            ${bar("saved", summary.saved)}
          </div>`,
        )
        .join("")
    : `<div class="empty">${t("Noch keine Monate erfasst.")}</div>`;
}

// Dashboard: the last three pay months; "Seit Lehrbeginn" opens all of them in a pop-up.
function renderComparisonChart() {
  $("comparisonChart").innerHTML = comparisonRows(countedMonths().slice(-3));
}

function showComparison() {
  $("comparisonAll").innerHTML = comparisonRows(countedMonths());
  $("comparisonDialog").showModal();
  $("comparisonAll").scrollTop = $("comparisonAll").scrollHeight; // newest month at the bottom
}

function categoryChart(totalsByCategory, emptyText) {
  const categories = Object.entries(totalsByCategory)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = sumBy(categories, ([, value]) => value);

  return categories.length
    ? categories
        .map(([label, value]) => {
          const share = (value / total) * 100;
          return `<div class="category-row">
            <div class="category-label"><span>${escapeHTML(label)}</span><b>${chf(value)}</b></div>
            <div class="progress" aria-hidden="true"><span style="width:${share}%"></span></div>
            <div class="note">${percent(share)}</div>
          </div>`;
        })
        .join("")
    : `<div class="empty">${emptyText}</div>`;
}

function renderMonthPage() {
  const month = currentMonth;
  const summary = monthSummary(month);
  $("monthPickerLabel").textContent = monthName(month);

  let status = "";
  if (!hasStarted(month)) status = " · " + t("Noch nicht begonnen");
  $("monthPeriod").textContent = `${t("Lohnmonat")} ${periodLabel(month)} · ${yearLabel(apprenticeYear(month))}${status}`;

  const availableClass = summary.available < 0 ? "bad" : "good";
  $("mIncome").textContent = chf(summary.income);
  $("mAvailExtra").textContent = summary.otherIncome
    ? t("inkl. weitere Einnahmen {amount}", { amount: chf(summary.otherIncome) })
    : "";
  $("mSaved").textContent = chf(summary.saved);
  $("mSpent").textContent = chf(summary.spent);
  $("mAvail").textContent = chf(summary.available);
  $("mAvail").className = availableClass;
  $("ledgerBalance").textContent = chf(summary.available);
  $("ledgerBalance").className = availableClass;

  const ledger = monthLedger(month);
  $("monthMath").innerHTML = ledger.length
    ? ledger
        .map(
          (row) => `<tr>
            <td class="ledger-date">${formatDate(row.date)}</td>
            ${descriptionCell(row.text, row.label)}
            ${amountCell(row.kind, row.amount)}
          </tr>`,
        )
        .join("")
    : emptyRow(3, t("Noch keine Buchungen."));

  const plannedPayments = plannedRecurring(month);
  $("plannedPaymentsRows").innerHTML = plannedPayments.length
    ? plannedPayments
        .map(({ order, date }) => {
          const paid = isPaid({ order, date });
          return `<tr>
            <td>${formatDate(date)}</td>
            <td class="item-name">${escapeHTML(order.name)}</td>
            <td class="money">${chf(order.amount)}</td>
            <td class="row-status"><span class="payment-status ${paid ? "paid" : "open"}">${paid ? t("Bezahlt") : t("Offen")}</span></td>
            <td class="row-actions"><button class="secondary payment-toggle" data-action="toggle-recurring-payment" data-id="${order.id}" data-date="${date}">${paid ? t("Als offen markieren") : t("Als bezahlt markieren")}</button></td>
          </tr>`;
        })
        .join("")
    : emptyRow(5, t("Keine geplanten Daueraufträge in diesem Lohnmonat."));

  const money = summary.income + summary.otherIncome;
  const used = money ? ((summary.saved + summary.spent) / money) * 100 : 0;
  $("budgetBar").style.width = Math.min(100, Math.max(0, used)) + "%";
  $("budgetBar").classList.toggle("over", summary.available < 0);
  if (!money) {
    $("budgetText").textContent = t("Noch keine Einnahmen erfasst.");
  } else {
    const over = summary.available < 0 ? " " + t("Budget um {amount} überschritten.", { amount: chf(-summary.available) }) : "";
    $("budgetText").textContent = t("{percent} der Einnahmen sind ausgegeben oder gespart.", { percent: percent(used) }) + over;
  }
}

// Only the entries of the selected pay month; other months show theirs when chosen.
function renderEntryList() {
  const entries = allEntries().filter((entry) => payrollMonth(entry.date) === currentMonth);
  $("entriesMonth").textContent = `${monthName(currentMonth)} · ${periodLabel(currentMonth)}`;
  $("allExpenses").innerHTML = entries.length
    ? entries
        .map(
          (entry) => `<tr>
            <td>${formatDate(entry.date)}</td>
            ${descriptionCell(entry.desc, entry.kind === "expense" ? plannedLabel(entry.date) : KIND_LABELS[entry.kind] + plannedLabel(entry.date, " · "))}
            <td>${escapeHTML(entry.cat)}</td>
            <td>${entry.kind === "expense" ? escapeHTML(entry.pay) : ""}</td>
            <td class="entry-meta">${[formatDate(entry.date).slice(0, 6), escapeHTML(entry.cat), entry.kind === "expense" ? escapeHTML(entry.pay) : ""].filter(Boolean).join(" · ")}</td>
            ${amountCell(entry.kind, entry.amount)}
            <td class="row-actions">${recordActions(entry.type, entry.id)}</td>
          </tr>`,
        )
        .join("")
    : emptyRow(6, t("Noch keine Einträge in diesem Lohnmonat."));
}

// With the status in the selected pay month: the amount only counts (− CHF 80.00) once it is paid.
function renderRecurringList() {
  const payments = plannedRecurring(currentMonth);
  $("recurringMonth").textContent = `${monthName(currentMonth)} · ${periodLabel(currentMonth)}`;
  const orders = [...state.recurring].sort((a, b) => a.start.localeCompare(b.start));
  $("recurringRows").innerHTML = orders.length
    ? orders
        .map((order) => {
          const payment = payments.find((item) => item.order === order);
          const paid = payment && isPaid(payment);
          const status = payment
            ? `<span class="payment-status ${paid ? "paid" : "open"}">${paid ? t("Bezahlt") : t("Offen")}</span>
               <span class="ledger-detail">${paid ? t("am {date}", { date: formatDate(payment.date) }) : t("fällig am {date}", { date: formatDate(payment.date) })}</span>`
            : `<span class="ledger-detail">${t("Nicht in diesem Lohnmonat")}</span>`;
          return `<tr>
            ${descriptionCell(order.name, order.kind !== "expense" ? RECURRING_KIND_LABELS[order.kind] : "")}
            <td>${escapeHTML(order.cat)}</td>
            <td>${(INTERVALS[order.interval] || INTERVALS.monthly).label}</td>
            <td>${formatDate(order.start)}</td>
            <td class="${order.end ? "" : "no-end"}">${order.end ? formatDate(order.end) : "–"}</td>
            <td class="recurring-meta">${[escapeHTML(order.cat), (INTERVALS[order.interval] || INTERVALS.monthly).label, t("ab {date}", { date: formatDate(order.start) }), order.end ? t("bis {date}", { date: formatDate(order.end) }) : ""].filter(Boolean).join(" · ")}</td>
            <td class="row-status recurring-status">${status}</td>
            ${paid ? amountCell(order.kind, order.amount) : `<td class="money not-counted">${chf(order.amount)}</td>`}
            <td class="row-actions">${recordActions("recurring", order.id)}</td>
          </tr>`;
        })
        .join("")
    : emptyRow(8, t("Noch keine Daueraufträge."));
}

// Wage table with one row per apprenticeship year. Rebuilt only when the length changes,
// otherwise typed values would be lost.
let yearTableShape = "";

function buildYearSettings() {
  const shape = String(state.years);
  if (shape === yearTableShape) return;
  yearTableShape = shape;

  const input = (id, label) =>
    `<input id="${id}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="${label}">`;
  $("yearSettingsHead").innerHTML = `<tr><th>${t("Lehrjahr")}</th><th>${t("Nettolohn CHF")}</th><th>${t("Automatisch sparen CHF")}</th><th id="thirteenthHead"></th></tr>`;
  $("yearSettings").innerHTML = yearIndexes()
    .map((i) => {
      const year = yearLabel(i);
      return `<tr>
        <td><b>${year}</b></td>
        <td>${input("salary" + i, `${t("Nettolohn")} ${year}`)}</td>
        <td>${input("extraSave" + i, `${t("Automatisch sparen")} ${year}`)}</td>
        <td class="money computed" id="thirteenth${i}" aria-live="polite"></td>
      </tr>`;
    })
    .join("");
  addMobileLabels();
}

// Allowance list: one switch per allowance; enabled ones show amount and saved part per year.
// Rebuilt only when the list or the apprenticeship length changes.
let allowanceShape = "";

function renderAllowances() {
  const shape = JSON.stringify([state.years, state.allowances.map((allowance) => [allowance.id, allowance.name, allowance.enabled, allowance.per])]);
  if (shape !== allowanceShape) {
    allowanceShape = shape;
    const input = (allowance, field, i, label) =>
      `<input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="${label}"
        id="al-${allowance.id}-${field}-${i}" data-allowance="${allowance.id}" data-field="${field}" data-year="${i}">`;
    $("allowanceList").innerHTML = state.allowances
      .map((allowance) => {
        const name = escapeHTML(allowance.name);
        const yearly = allowance.per === "year";
        const amountLabel = yearly ? t("CHF pro Jahr") : t("CHF pro Monat");
        const years = allowance.enabled
          ? `<div class="allowance-years">${yearIndexes()
              .map(
                (i) => `<div class="allowance-year">
                  <b>${yearLabel(i)}</b>
                  <label>${amountLabel} ${input(allowance, "amounts", i, `${name} ${yearLabel(i)}`)}</label>
                  <label>${t("davon sparen")} ${input(allowance, "save", i, `${t("{name} sparen", { name })} ${yearLabel(i)}`)}</label>
                </div>`,
              )
              .join("")}</div>`
          : "";
        return `<div class="allowance ${allowance.enabled ? "on" : ""}">
          <div class="allowance-head">
            <label class="switch">
              <span class="switch-text"><span translate="no">${name}</span></span>
              <input type="checkbox" data-allowance-toggle="${allowance.id}" ${allowance.enabled ? "checked" : ""}>
            </label>
            ${allowance.enabled ? `<select class="allowance-per" data-allowance-per="${allowance.id}" aria-label="${t("Wie oft? {name}", { name })}">
              <option value="month" ${yearly ? "" : "selected"}>${t("monatlich")}</option>
              <option value="year" ${yearly ? "selected" : ""}>${t("jährlich")}</option>
            </select>` : ""}
            <button class="danger" data-action="delete-allowance" data-id="${allowance.id}" aria-label="${t("{name} entfernen", { name })}">${t("Entfernen")}</button>
          </div>
          ${years}
        </div>`;
      })
      .join("");
  }
  for (const allowance of enabledAllowances()) {
    for (const i of yearIndexes()) {
      setValue(`al-${allowance.id}-amounts-${i}`, allowance.amounts[i]);
      setValue(`al-${allowance.id}-save-${i}`, allowance.save[i]);
    }
  }
}

function changeAllowance(field) {
  const id = field.dataset.allowance || field.dataset.allowanceToggle || field.dataset.allowancePer;
  const allowance = state.allowances.find((allowance) => allowance.id === id);
  if (!allowance) return;
  if (field.dataset.allowancePer) {
    allowance.per = field.value === "year" ? "year" : "month";
    return persist();
  }
  if (field.dataset.allowanceToggle) {
    allowance.enabled = field.checked;
    return persist();
  }
  const year = Number(field.dataset.year);
  const value = readAmount(field.id, true);
  if (value === null) return notify("Bitte einen gültigen Betrag ab 0 eingeben.");
  const list = allowance[field.dataset.field];
  // A first value in year 1 is copied to all years; each can be changed afterwards.
  const othersEmpty = list.every((amount, i) => i === year || !amount);
  if (year === 0 && othersEmpty) list.fill(value);
  else list[year] = value;
  if (allowance.save.some((amount, i) => amount > allowance.amounts[i])) {
    allowance.save = allowance.save.map((amount, i) => Math.min(amount, allowance.amounts[i]));
    notify("„davon sparen“ kann nicht grösser sein als die Pauschale – angepasst.");
  }
  persist();
}

function addAllowance() {
  const name = $("allowanceName").value.trim();
  if (!name) return notify("Bitte einen Namen für die Pauschale eingeben.");
  if (state.allowances.some((allowance) => allowance.name.toLowerCase() === name.toLowerCase())) {
    return notify("Diese Pauschale gibt es schon.");
  }
  state.allowances.push(newAllowance("p" + newId(), name, true));
  $("allowanceName").value = "";
  persist();
  notify("Pauschale hinzugefügt");
}

async function deleteAllowance(id) {
  const allowance = state.allowances.find((allowance) => allowance.id === id);
  if (!allowance) return;
  if (!(await confirmAction({ title: t("Pauschale „{name}“ entfernen?", { name: allowance.name }), okLabel: t("Entfernen") }))) return;
  state.allowances = state.allowances.filter((allowance) => allowance.id !== id);
  persist();
}

// Account cards on the dashboard and account management in the settings

// Dashboard: one block per account with what happened on it in the selected pay month.
// Each account can be moved and resized on its own while arranging.
function renderAccountCards() {
  syncAccountBlocks();
  const moves = accountMoves([currentMonth]);
  for (const account of state.accounts) {
    const spending = account.kind === "spending";
    const amount = moves[account.id] || 0;
    const block = document.querySelector(`[data-block="account-${account.id}"]`);
    block.dataset.blockName = account.name;
    block.querySelector("[data-block-bar] .block-name").textContent = account.name;
    block.querySelector(".account-card").outerHTML = `<div class="account-card ${spending ? "spending" : "saving"}">
        <span class="account-type">${spending ? t("Übrig im Lohnmonat") : t("Gespart im Lohnmonat")}</span>
        <b translate="no">${escapeHTML(account.name)}</b>
        <strong class="${amount < 0 ? "bad" : ""}">${chf(amount)}</strong>
      </div>`;
  }
}

// Adds a block for a new account and removes the block of a deleted one.
function syncAccountBlocks() {
  const container = document.querySelector('[data-sortable="dashboard"]');
  const ids = state.accounts.map((account) => "account-" + account.id);
  container.querySelectorAll('[data-block^="account-"]').forEach((block) => {
    if (!ids.includes(block.dataset.block)) block.remove();
  });
  let added = false;
  for (const account of state.accounts) {
    if (container.querySelector(`[data-block="account-${account.id}"]`)) continue;
    const block = document.createElement("div");
    block.className = "block";
    block.dataset.block = "account-" + account.id;
    block.dataset.blockName = account.name;
    block.dataset.blockPlain = "true"; // the user's own name, not translated
    block.dataset.defaultSize = "narrow";
    block.innerHTML = '<div class="account-card"></div>';
    container.append(block);
    addBlockBar(block);
    added = true;
  }
  if (added) applyLayout();
}

let accountShape = "";

function renderAccounts() {
  const shape = JSON.stringify(state.accounts.map((account) => [account.id, account.name]));
  const balance = accountBalances();
  if (shape !== accountShape) {
    accountShape = shape;
    $("accountList").innerHTML = state.accounts
      .map((account) => {
        const spending = account.kind === "spending";
        const removable = !spending && savingAccounts().length > 1;
        return `<div class="account-row">
          <div class="account-row-name">
            <span class="account-badge ${spending ? "spending" : "saving"}">${spending ? t("Ausgaben") : t("Sparen")}</span>
            <b translate="no">${escapeHTML(account.name)}</b>
            <span class="note" id="acc-balance-${account.id}"></span>
          </div>
          <label class="account-start">${t("Anfangsbestand CHF")}
            <input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"
              id="acc-start-${account.id}" data-account-start="${account.id}">
          </label>
          <div class="actions">
            <button class="secondary" data-action="rename-account" data-id="${account.id}">${t("Umbenennen")}</button>
            ${removable ? `<button class="danger" data-action="delete-account-item" data-id="${account.id}">${t("Löschen")}</button>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }
  for (const account of state.accounts) {
    setValue(`acc-start-${account.id}`, account.start);
    $(`acc-balance-${account.id}`).textContent = t("Stand heute: {amount}", { amount: chf(balance[account.id] || 0) });
  }
}

function addAccount() {
  const name = $("accountNewName").value.trim();
  if (!name) return notify("Bitte einen Namen für das Konto eingeben.");
  if (state.accounts.some((account) => account.name.toLowerCase() === name.toLowerCase())) return notify("Dieses Konto gibt es schon.");
  state.accounts.push({ id: "s" + newId(), name, kind: "saving", start: 0 });
  $("accountNewName").value = "";
  persist();
  notify("Sparkonto hinzugefügt");
}

async function renameAccount(id) {
  const account = state.accounts.find((account) => account.id === id);
  if (!account) return;
  const name = await askUser({ title: t("Umbenennen"), label: t("Neuer Name für das Konto"), value: account.name, okLabel: t("Speichern") });
  if (!name || name === account.name) return;
  if (state.accounts.some((other) => other !== account && other.name.toLowerCase() === name.toLowerCase())) {
    return notify("Dieses Konto gibt es schon.");
  }
  if (account.kind === "saving") renameInBookings("accounts", account.name, name);
  account.name = name;
  persist();
  notify("Umbenannt");
}

async function deleteMoneyAccount(id) {
  const account = state.accounts.find((account) => account.id === id);
  if (!account || account.kind !== "saving" || savingAccounts().length <= 1) return;
  if (!(await confirmAction({ title: t("Sparkonto „{name}“ löschen? Bisherige Buchungen bleiben erhalten.", { name: account.name }), okLabel: t("Löschen") }))) return;
  state.accounts = state.accounts.filter((account) => account.id !== id);
  if (state.autoAccount === id) state.autoAccount = savingAccounts()[0].id;
  persist();
  notify("Konto gelöscht");
}

function changeAccountStart(field) {
  const account = state.accounts.find((account) => account.id === field.dataset.accountStart);
  const value = readAmount(field.id, true);
  if (!account) return;
  if (value === null) return notify("Bitte einen gültigen Betrag ab 0 eingeben.");
  account.start = value;
  persist();
}

function renderSettings() {
  setValue("setStart", state.start);
  setValue("setYears", String(state.years));
  setValue("setPayday", String(state.payday));
  setValue("setThirteenth", state.thirteenth);
  $("setAutoAccount").innerHTML = savingAccounts()
    .map((account) => `<option value="${account.id}">${escapeHTML(account.name)}</option>`)
    .join("");
  setValue("setAutoAccount", state.autoAccount);
  $("paydayNote").textContent = paydayText();

  buildYearSettings();
  for (const i of yearIndexes()) {
    setValue("salary" + i, state.salaries[i]);
    setValue("extraSave" + i, state.extraSave[i]);
  }
  for (const i of yearIndexes()) {
    const amount = thirteenthPerYear(Number(state.salaries[i]) || 0);
    $("thirteenth" + i).textContent = state.thirteenth === "none" ? "–" : chf(amount);
  }
  $("thirteenthNote").textContent = thirteenthText();
  $("yearSettings").closest("table").classList.toggle("no-thirteenth", state.thirteenth === "none");
  $("thirteenthHead").textContent = state.thirteenth === "spread" ? t("Davon 13. Monatslohn") : t("13. Monatslohn pro Jahr");
  renderAllowances();
  renderAccounts();
}

function renderLists() {
  for (const type of Object.keys(LIST_SELECTS)) {
    document.querySelector(`[data-list-items="${type}"]`).innerHTML = state[type]
      .map(
        (name, index) => `<li class="chip">
          <span>${escapeHTML(name)}</span>
          <button class="chip-button" data-action="rename-list-item" data-list="${type}" data-index="${index}"
            aria-label="${t("{name} umbenennen", { name: escapeHTML(name) })}" title="${t("Umbenennen")}">✎</button>
          <button class="chip-button remove" data-action="delete-list-item" data-list="${type}" data-index="${index}"
            aria-label="${t("{name} entfernen", { name: escapeHTML(name) })}" title="${t("Entfernen")}">×</button>
        </li>`,
      )
      .join("");
  }
}

// On phones tables are shown as cards; the column names come from data-label.
function addMobileLabels() {
  document.querySelectorAll("table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
    table.classList.add("mobile-cards");
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell, i) => cell.setAttribute("data-label", labels[i] || ""));
    });
  });
}

// Long lists show only the newest rows (5 on phones, 10 otherwise) plus a "show all" button.

const SHORT_LISTS = ["monthMath", "plannedPaymentsRows", "allExpenses", "recurringRows"];
const expandedLists = new Set();
const isPhone = () => window.matchMedia("(max-width: 760px)").matches;

function shortenLists() {
  const maxRows = isPhone() ? 5 : 10;
  for (const id of SHORT_LISTS) {
    const tableBody = $(id);
    const rows = [...tableBody.rows].filter((row) => !row.querySelector(".empty"));
    const counter = document.querySelector(`[data-count-for="${id}"]`);
    if (counter) counter.textContent = rows.length || "";
    if (rows.length <= maxRows + 2) continue; // not worth a button for one or two more rows

    const open = expandedLists.has(id);
    rows.forEach((row, i) => (row.hidden = !open && i >= maxRows));
    tableBody.insertAdjacentHTML(
      "beforeend",
      `<tr class="more-row"><td colspan="9"><button class="more-button" data-action="toggle-list" data-list="${id}" aria-expanded="${open}">
        ${open ? t("Weniger anzeigen") : t("Alle {n} anzeigen", { n: rows.length })}</button></td></tr>`,
    );
  }
}

// Collapsible sections: each <details class="fold"> remembers its state in this browser.
// Defaults: data-default="closed" starts closed, data-mobile="closed" starts closed on phones.

const FOLD_KEY = "financeos.folds";

function readFolds() {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY)) || {};
  } catch {
    return {};
  }
}

function initFolds() {
  const saved = readFolds();
  const phone = isPhone();
  document.querySelectorAll("details.fold").forEach((fold) => {
    const key = fold.dataset.fold;
    const closed = fold.dataset.default === "closed" || (phone && fold.dataset.mobile === "closed");
    fold.open = key in saved ? saved[key] : !closed;
    fold.addEventListener("toggle", () => {
      const foldStates = readFolds();
      foldStates[key] = fold.open;
      try {
        localStorage.setItem(FOLD_KEY, JSON.stringify(foldStates));
      } catch {
        // Private mode: state is not remembered.
      }
    });
  });
}

function updateEditButtons() {
  for (const [name, form] of Object.entries(FORMS)) {
    $(form.cancelButton).hidden = !editing[name];
    $(form.saveButton).textContent = editing[name] ? t("Änderungen speichern") : form.saveLabel;
  }
}

function render() {
  fillSelects();
  $("activeMonthLabel").textContent = monthName(currentMonth);
  $("mobileMonthLabel").textContent = monthName(currentMonth);
  renderDashboard();
  renderMonthPage();
  renderEntryList();
  renderRecurringList();
  renderSettings();
  renderLists();
  updateEditButtons();
  addMobileLabels();
  shortenLists();
}

// Arranging blocks on the dashboard and the month page.
// "Anordnen" shows a bar on every block: drag it (mouse or finger), move it with ↑ ↓ and make
// it wide or narrow with ↔. Saved with the account:
// state.layout = { dashboard: [ids], month: [ids], sizes: { "dashboard:available": "wide" | "narrow" } }

const DEFAULT_LAYOUT = {};
document.querySelectorAll("[data-sortable]").forEach((container) => {
  DEFAULT_LAYOUT[container.dataset.sortable] = [...container.children].map((block) => block.dataset.block);
  [...container.children].forEach((block) => (block.dataset.defaultSize = block.classList.contains("span-2") ? "wide" : "narrow"));
});

function blocksOf(name) {
  return [...document.querySelector(`[data-sortable="${name}"]`).children];
}

// Default order; the account blocks come right after "still available".
function defaultOrder(name) {
  const order = [...DEFAULT_LAYOUT[name]];
  if (name === "dashboard") order.splice(order.indexOf("available") + 1, 0, ...state.accounts.map((account) => "account-" + account.id));
  return order;
}

// Puts the blocks in the saved order and size; blocks without a saved place keep their default place.
function applyLayout() {
  for (const name of Object.keys(DEFAULT_LAYOUT)) {
    const container = document.querySelector(`[data-sortable="${name}"]`);
    const byId = Object.fromEntries(blocksOf(name).map((block) => [block.dataset.block, block]));
    const saved = (state.layout?.[name] || []).filter((id) => byId[id]);
    const defaults = defaultOrder(name).filter((id) => byId[id]);
    // Unsaved blocks (e.g. a new savings account) are put after the block before them by default.
    const order = [...saved];
    defaults.forEach((id, i) => {
      if (order.includes(id)) return;
      const previous = defaults.slice(0, i).reverse().find((other) => order.includes(other));
      order.splice(previous ? order.indexOf(previous) + 1 : 0, 0, id);
    });
    order.forEach((id) => container.append(byId[id]));
    for (const block of blocksOf(name)) {
      const size = state.layout?.sizes?.[`${name}:${block.dataset.block}`] || block.dataset.defaultSize;
      block.classList.toggle("span-2", size === "wide");
    }
  }
}

function saveLayout(name) {
  state.layout = { ...state.layout, [name]: blocksOf(name).map((block) => block.dataset.block) };
  save();
}

// The bar shown while arranging; added once per block.
function addBlockBar(block) {
  if (block.querySelector(":scope > [data-block-bar]")) return;
  const name = escapeHTML(block.dataset.blockPlain ? block.dataset.blockName : t(block.dataset.blockName));
  block.insertAdjacentHTML(
    "afterbegin",
    `<div class="block-bar" data-block-bar>
      <span class="block-grip" aria-hidden="true">⠿</span>
      <span class="block-name">${name}</span>
      <button type="button" class="secondary" data-action="resize-block" aria-label="${t("{name} breiter oder schmaler", { name })}" title="${t("Breiter oder schmaler")}">↔</button>
      <button type="button" class="secondary" data-action="move-block" data-step="-1" aria-label="${t("{name} nach oben", { name })}">↑</button>
      <button type="button" class="secondary" data-action="move-block" data-step="1" aria-label="${t("{name} nach unten", { name })}">↓</button>
    </div>`,
  );
}

const addBlockBars = () => document.querySelectorAll("[data-sortable] > .block").forEach(addBlockBar);

function setArranging(name, on) {
  const container = document.querySelector(`[data-sortable="${name}"]`);
  container.classList.toggle("arranging", on);
  document.querySelector(`[data-arrange-help="${name}"]`).hidden = !on;
  const toggle = document.querySelector(`[data-action="arrange"][data-sortable-for="${name}"]`);
  toggle.setAttribute("aria-pressed", String(on));
  toggle.textContent = on ? t("Fertig") : t("Anordnen");
}

function toggleArranging(data) {
  const container = document.querySelector(`[data-sortable="${data.sortableFor}"]`);
  setArranging(data.sortableFor, !container.classList.contains("arranging"));
}

function moveBlock(button) {
  const block = button.closest(".block");
  const container = block.parentElement;
  if (Number(button.dataset.step) < 0) block.previousElementSibling?.before(block);
  else block.nextElementSibling?.after(block);
  saveLayout(container.dataset.sortable);
  button.focus();
}

function resizeBlock(button) {
  const block = button.closest(".block");
  const name = block.parentElement.dataset.sortable;
  const wide = !block.classList.contains("span-2");
  block.classList.toggle("span-2", wide);
  state.layout = { ...state.layout, sizes: { ...state.layout?.sizes, [`${name}:${block.dataset.block}`]: wide ? "wide" : "narrow" } };
  saveLayout(name);
  button.focus();
}

function resetLayout(data) {
  const name = data.sortableFor;
  if (state.layout) {
    delete state.layout[name];
    for (const key of Object.keys(state.layout.sizes || {})) if (key.startsWith(name + ":")) delete state.layout.sizes[key];
  }
  applyLayout();
  save();
}

// Dragging with the mouse or a finger (pointer events also work on phones).
document.addEventListener("pointerdown", (event) => {
  const bar = event.target.closest("[data-block-bar]");
  if (!ready || !bar || event.target.closest("button") || !bar.closest(".arranging")) return;
  const block = bar.closest(".block");
  const container = block.parentElement;
  event.preventDefault();
  block.classList.add("dragging");

  const onMove = (move) => {
    // Near the top or bottom edge the page scrolls along, so far places can be reached.
    if (move.clientY < 70) window.scrollBy(0, -18);
    else if (move.clientY > innerHeight - 70) window.scrollBy(0, 18);
    const target = [...container.children].find((other) => {
      if (other === block) return false;
      const box = other.getBoundingClientRect();
      return move.clientX >= box.left && move.clientX <= box.right && move.clientY >= box.top && move.clientY <= box.bottom;
    });
    if (!target) return;
    const box = target.getBoundingClientRect();
    const before = target.classList.contains("span-2") || block.classList.contains("span-2")
      ? move.clientY < box.top + box.height / 2
      : move.clientX < box.left + box.width / 2;
    if (before) target.before(block);
    else target.after(block);
  };
  // Listen on the whole page: the pointer leaves the bar while dragging.
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    block.classList.remove("dragging");
    saveLayout(container.dataset.sortable);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
});

// Navigation

function showPage(id) {
  setMenuOpen(false);
  Object.keys(DEFAULT_LAYOUT).forEach((name) => setArranging(name, false));
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === id));
  document
    .querySelectorAll(".nav button")
    .forEach((button) => button.classList.toggle("active", button.dataset.page === id));
  window.scrollTo(0, 0);
}

// Settings tabs

const SETTINGS_TAB_KEY = "financeOS_settingsTab";

function showSettingsTab(tab) {
  document.querySelectorAll("[data-settings-tab]").forEach((element) => {
    element.classList.toggle("tab-hidden", element.dataset.settingsTab !== tab);
  });
  document.querySelectorAll("[data-settings-tab-button]").forEach((button) => {
    const active = button.dataset.settingsTabButton === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    if (active) button.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  try {
    localStorage.setItem(SETTINGS_TAB_KEY, tab);
  } catch {
    // Not remembered.
  }
}

document.querySelectorAll("[data-settings-tab-button]").forEach((button) =>
  button.addEventListener("click", () => showSettingsTab(button.dataset.settingsTabButton)),
);
try {
  showSettingsTab(localStorage.getItem(SETTINGS_TAB_KEY) || "pay");
} catch {
  showSettingsTab("pay");
}

// Burger menu on phones

function setMenuOpen(open) {
  $("appBurger").setAttribute("aria-expanded", String(open));
  $("appMenu").classList.toggle("open", open);
}

// Clicking beside a pop-up closes it
for (const id of ["comparisonDialog", "monthEntry"]) {
  $(id).addEventListener("click", (event) => {
    if (event.target === $(id)) $(id).close();
  });
}
$("appBurger").addEventListener("click", () => setMenuOpen($("appBurger").getAttribute("aria-expanded") !== "true"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".sidebar")) setMenuOpen(false);
});

// Light bulb button: switches between light and dark and saves it like the appearance settings.
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  state.appearance = { ...appearance, mode: dark ? "light" : "dark" };
  applyAppearance(state.appearance);
  renderAppearance();
  save();
}

// First-time setup (js/setup.js): new accounts answer a few questions first; the answers are
// written into the settings and standing orders. Accounts that already have a wage skip it.
const needsSetup = () => !state.setupDone && !state.salaries.some((amount) => Number(amount) > 0);

function openSetup() {
  Setup.open({ categories: state.categories, onFinish: applySetup });
}

function applySetup(answers) {
  const money = (value) => Math.round(Math.max(0, Number(String(value).replace(",", ".")) || 0) * 100) / 100;
  const perYear = (value) => Array.from({ length: MAX_YEARS }, (_, i) => (i < answers.years ? money(value) : 0));

  state.start = `${answers.startYear}-${pad2(answers.startMonth)}-01`;
  state.years = answers.years;
  state.payday = answers.payday;
  state.thirteenth = answers.thirteenth;
  state.salaries = Array.from({ length: MAX_YEARS }, (_, i) => (i < answers.years ? money(answers.wages[i]) : 0));

  const wanted = answers.allowances === "yes";
  for (const item of answers.allowanceItems) {
    const allowance = state.allowances.find((entry) => entry.id === item.id);
    if (!allowance) continue;
    allowance.enabled = wanted && item.on;
    if (allowance.enabled) Object.assign(allowance, { amounts: perYear(item.amount), per: item.per });
  }
  const own = answers.ownAllowance;
  if (wanted && own.name.trim()) {
    state.allowances.push({ ...newAllowance("p" + newId(), own.name.trim(), true), amounts: perYear(own.amount), per: own.per });
  }

  for (const order of answers.orders) {
    state.recurring.push({
      id: newId(),
      kind: "expense",
      name: order.name.trim(),
      amount: money(order.amount),
      interval: order.interval,
      start: order.start,
      end: "",
      cat: order.cat,
    });
  }

  state.setupDone = true;
  setCurrentMonth(todaysMonth());
  persist();
  showPage("dashboard");
  if (!state.tourDone) startTour();
}

// Guided tour (js/tour.js): shown once per account, can be restarted in the settings.
function startTour() {
  const page = document.querySelector(".page.active")?.id;
  Tour.start({
    onFinish: () => {
      state.tourDone = true;
      if (page) showPage(page);
      persist();
    },
  });
}

// "Monat ändern": a pop-up with a year switch (‹ 2026 ›) and the twelve months as buttons.
// Months outside the apprenticeship cannot be chosen; a click opens the month right away.
let pickerYear = null;

function openMonthEntry() {
  setMenuOpen(false);
  pickerYear = Number(currentMonth.slice(0, 4));
  renderMonthGrid();
  if (!$("monthEntry").open) $("monthEntry").showModal();
  $("monthGrid").querySelector(".selected")?.focus();
}

function renderMonthGrid() {
  const months = monthList();
  const years = months.map((month) => Number(month.slice(0, 4)));
  const today = todaysMonth();
  $("pickerYear").textContent = pickerYear;
  document.querySelector('[data-action="picker-year"][data-step="-1"]').disabled = pickerYear <= Math.min(...years);
  document.querySelector('[data-action="picker-year"][data-step="1"]').disabled = pickerYear >= Math.max(...years);
  $("monthGrid").innerHTML = Array.from({ length: 12 }, (_, i) => {
    const month = `${pickerYear}-${pad2(i + 1)}`;
    const label = new Date(pickerYear, i).toLocaleDateString(I18N.locale, { month: "short" }).replace(".", "");
    const classes = ["month-cell", month === currentMonth ? "selected" : "", month === today ? "today" : ""].join(" ");
    return `<button type="button" class="${classes}" data-action="pick-month" data-month="${month}"
      aria-pressed="${month === currentMonth}" aria-label="${monthName(month)}" ${months.includes(month) ? "" : "disabled"}>${label}</button>`;
  }).join("");
  $("pickerPeriod").textContent = `${monthName(currentMonth)} · ${periodLabel(currentMonth)}`;
}

function changePickerYear(data) {
  pickerYear += Number(data.step);
  renderMonthGrid();
}

function pickMonth(data) {
  if (!monthList().includes(data.month)) return;
  setCurrentMonth(data.month);
  for (const id of DEFAULT_DATE_FIELDS) {
    const form = formOfField(id);
    if (!editing[form]) {
      $(id).value = defaultDate();
      state.drafts[id] = $(id).value;
    }
  }
  $("monthEntry").close();
  persist();
}

// Forms and drafts

function formOf(type) {
  return ENTRY_KINDS[type] ? "expenses" : type;
}

function formOfField(id) {
  return Object.keys(FORMS).find((name) => FORMS[name].fields.includes(id));
}

function saveDrafts(form) {
  for (const id of FORMS[form].fields) state.drafts[id] = $(id).value;
}

function restoreDrafts() {
  const drafts = state.drafts;
  for (const id of ["entryKind", "recKind"]) {
    if (drafts[id]) setSelectValue(id, drafts[id], false);
  }
  fillSelects();
  for (const id of DRAFT_FIELDS) {
    if (!(id in drafts)) continue;
    const field = $(id);
    const value = (DATE_FIELDS.includes(id) && parseDate(drafts[id])) || drafts[id];
    if (field.tagName === "SELECT") setSelectValue(id, value, Boolean(editing[formOfField(id)]));
    else field.value = value;
  }
}

function resetForm(form, keep = []) {
  for (const id of FORMS[form].fields) {
    if (keep.includes(id)) continue;
    const field = $(id);
    if (field.tagName === "SELECT") field.selectedIndex = 0;
    else field.value = DEFAULT_DATE_FIELDS.includes(id) ? defaultDate() : "";
  }
}

function finishEdit(form, keep = []) {
  editing[form] = null;
  // A kind that can no longer be chosen (old saving orders) only stays while it is edited.
  [...$("recKind").options].filter((option) => option.value === "saving").forEach((option) => option.remove());
  resetForm(form, keep);
  fillSelects();
  saveDrafts(form);
  updateEditButtons();
}

function cancelEdit(form) {
  finishEdit(form);
  save();
}

function saveRecord(type, record) {
  const form = formOf(type);
  const edit = editing[form];

  if (edit && edit.type === type) {
    const index = state[type].findIndex((record) => record.id === edit.id);
    if (index >= 0) state[type][index] = { ...state[type][index], ...record };
    else state[type].push({ id: edit.id, ...record });
  } else if (edit) {
    // The entry kind was changed, e.g. from expense to income.
    state[edit.type] = state[edit.type].filter((record) => record.id !== edit.id);
    state[type].push({ id: edit.id, ...record });
  } else {
    state[type].push({ id: newId(), ...record });
  }

  finishEdit(form, edit ? [] : FORMS[form].keepAfterSave);
  persist();
  notify("Gespeichert");
}

function saveEntry() {
  const date = readDate("exDate");
  const desc = $("exDesc").value.trim();
  const amount = readAmount("exAmount");
  if (!date || !desc || amount === null) {
    return notify("Bitte Datum, Beschreibung und einen Betrag grösser als 0 eingeben.");
  }
  // A withdrawal cannot exceed the savings balance (checked for new entries up to today).
  if ($("entryKind").value === "withdraw" && !editing.expenses && date <= todayISO()) {
    const account = savingAccounts().find((savings) => savings.name === $("exCat").value);
    const available = account ? accountBalances()[account.id] || 0 : 0;
    if (amount > available + 0.001) {
      return notify("Auf „{name}“ sind nur {amount} – so viel kannst du höchstens nehmen.", {
        name: $("exCat").value,
        amount: chf(available),
      });
    }
  }
  const kind = $("entryKind").value;
  saveRecord(ENTRY_TYPES[kind], {
    date,
    desc,
    cat: $("exCat").value,
    pay: kind === "expense" ? $("exPay").value : "",
    amount,
  });
  explainBooking(date);
}

// After saving: say so when the entry counts in another pay month or only from a later date,
// otherwise it seems to be missing from "available".
function explainBooking(date) {
  if (date > todayISO()) {
    notify("Gespeichert – zählt erst ab {date} (geplant).", { date: formatDate(date) });
  } else if (payrollMonth(date) !== currentMonth) {
    notify("Gespeichert im Lohnmonat {month} – der gewählte Monat ist {current}.", {
      month: monthName(payrollMonth(date)),
      current: monthName(currentMonth),
    });
  }
}

function saveRecurring() {
  const name = $("recName").value.trim();
  const amount = readAmount("recAmount");
  const start = readDate("recStart");
  const end = readDate("recEnd");
  if (!name || amount === null || !start) {
    return notify("Bitte Name, positiven Betrag und Startdatum eingeben.");
  }
  if ($("recEnd").value.trim() && !end) return notify("Bitte ein gültiges Enddatum eingeben.");
  if (end && end < start) return notify("Das Enddatum darf nicht vor dem Startdatum liegen.");
  const interval = INTERVALS[$("recInterval").value] ? $("recInterval").value : "monthly";
  // Saving orders are made in the settings; existing ones can still be edited.
  const kind = [...$("recKind").options].some((option) => option.value === $("recKind").value) ? $("recKind").value : "expense";
  saveRecord("recurring", { kind, name, amount, interval, start, end, cat: $("recCat").value });
}

function editRecord(type, id) {
  const record = state[type]?.find((item) => item.id === id);
  if (!record) return;
  const form = formOf(type);
  editing[form] = { type, id };
  showPage(FORMS[form].page);

  let values;
  if (form === "expenses") {
    $("entryKind").value = ENTRY_KINDS[type];
    state.drafts.entryKind = ENTRY_KINDS[type];
    values = { exDate: record.date, exDesc: record.desc, exCat: record.cat, exPay: record.pay, exAmount: record.amount };
  } else if (form === "recurring") {
    const kind = record.kind || "expense";
    if (![...$("recKind").options].some((option) => option.value === kind)) {
      $("recKind").append(new Option(`${RECURRING_KIND_LABELS[kind]} (${t("archiviert")})`, kind));
    }
    $("recKind").value = kind;
    values = {
      recName: record.name,
      recAmount: record.amount,
      recInterval: record.interval || "monthly",
      recStart: record.start,
      recEnd: record.end,
      recCat: record.cat,
    };
  }

  fillSelects();
  for (const [fieldId, value] of Object.entries(values)) {
    if ($(fieldId).tagName === "SELECT") setSelectValue(fieldId, value ?? "", true);
    else $(fieldId).value = value ?? "";
  }
  saveDrafts(form);
  updateEditButtons();
  save();

  const firstField = $(FORMS[form].fields[0]);
  firstField.scrollIntoView({ block: "center" });
  firstField.focus({ preventScroll: true });
}

// Deletes right away; "Rückgängig" in the message brings the entry back at the same place.
function deleteRecord(type, id) {
  const index = state[type].findIndex((item) => item.id === id);
  if (index < 0) return;
  const [removed] = state[type].splice(index, 1);
  const form = formOf(type);
  if (editing[form]?.id === id) finishEdit(form);
  persist();
  notify("Eintrag gelöscht", null, () => {
    if (state[type].some((item) => item.id === id)) return;
    state[type].splice(Math.min(index, state[type].length), 0, removed);
    persist();
    notify("Eintrag wiederhergestellt");
  });
}

function openNewEntry() {
  showPage("expenses");
  if (editing.expenses) finishEdit("expenses");
  $("entryKind").value = "expense";
  state.drafts.entryKind = "expense";
  fillSelects();
  save();
  $("exDesc").focus();
}

// Settings

function saveSettings() {
  const start = readDate("setStart");
  if (!start) return notify("Bitte ein gültiges Datum im Format TT.MM.JJJJ eingeben.");

  // Read only the visible year fields and keep the values of hidden years.
  const read = (prefix, list) =>
    list.map((value, i) => ($(prefix + i) ? readAmount(prefix + i, true) : Number(value) || 0));
  const salaries = read("salary", state.salaries);
  const extraSave = read("extraSave", state.extraSave);
  if ([...salaries, ...extraSave].includes(null)) return notify("Bitte gültige Beträge ab 0 eingeben.");

  const years = [2, 3, 4].includes(Number($("setYears").value)) ? Number($("setYears").value) : 4;
  const payday = Math.min(28, Math.max(1, Number($("setPayday").value) || 25));
  const thirteenth = ["none", "spread", "11", "12"].includes($("setThirteenth").value) ? $("setThirteenth").value : "none";
  const autoAccount = $("setAutoAccount").value;

  Object.assign(state, { start, years, payday, thirteenth, salaries, extraSave });
  if (savingAccounts().some((account) => account.id === autoAccount)) state.autoAccount = autoAccount;
  if (!monthList().includes(currentMonth)) {
    setCurrentMonth(initialMonth());
    persist();
    openMonthEntry();
  } else {
    persist();
  }
  notify("Einstellungen gespeichert");
}

async function resetAll() {
  if (!(await confirmAction({ title: t("Wirklich alle Finanzwerte und Einträge auf 0 zurücksetzen?"), okLabel: t("Zurücksetzen") }))) return;
  // Keep appearance and layout; the first-time setup is not shown again.
  state = { ...createEmptyData(), appearance: state.appearance, layout: state.layout, setupDone: true };
  editing = loadEditing();
  setCurrentMonth(initialMonth());
  $("entryKind").value = "expense";
  fillSelects();
  Object.keys(FORMS).forEach((form) => resetForm(form));
  persist();
  openMonthEntry();
}

// Categories and payment methods

const LIST_SELECTS = {
  categories: ["exCat", "recCat"],
  incomeCategories: ["exCat", "recCat"],
  payments: ["exPay"],
};

function addListItem(type) {
  if (!LIST_SELECTS[type]) return;
  const input = $("listName-" + type);
  const name = input.value.trim();
  if (!name) return notify("Bitte eine Bezeichnung eingeben.");
  if (state[type].some((item) => item.toLowerCase() === name.toLowerCase())) {
    return notify("Diese Bezeichnung besteht bereits.");
  }
  state[type].push(name);
  input.value = "";
  persist();
  notify("Hinzugefügt");
}

async function renameListItem(type, index) {
  if (!LIST_SELECTS[type]) return;
  const oldName = state[type][index];
  const name = await askUser({ title: t("Umbenennen"), label: t("Neue Bezeichnung"), value: oldName, okLabel: t("Speichern") });
  if (!name || name === oldName) return;
  if (state[type].some((item, i) => i !== index && item.toLowerCase() === name.toLowerCase())) {
    return notify("Diese Bezeichnung besteht bereits.");
  }

  state[type][index] = name;
  renameInBookings(type, oldName, name);

  // Rename the selected values in the forms too.
  const selected = LIST_SELECTS[type].filter((id) => $(id).value === oldName);
  fillSelects();
  for (const id of selected) {
    $(id).value = name;
    state.drafts[id] = name;
  }
  persist();
  notify("Umbenannt");
}

async function deleteListItem(type, index) {
  if (!LIST_SELECTS[type]) return;
  if (state[type].length <= 1) return notify("Mindestens eine Bezeichnung muss erhalten bleiben.");
  if (!(await confirmAction({ title: t("Bezeichnung aus der Auswahl entfernen? Bestehende Buchungen bleiben erhalten."), okLabel: t("Entfernen") }))) return;
  state[type].splice(index, 1);
  persist();
  notify("Entfernt");
}

// Profile and privacy (only with login)

function showAccount(me) {
  $("accountName").textContent = me.username;
  $("accountEmail").textContent = me.email;
  $("newUsername").value = me.username;
}

async function changeUsername() {
  const username = $("newUsername").value.trim();
  if (!username) return notify("Bitte einen Benutzernamen eingeben.");
  try {
    const result = await api("/account/username", { method: "PUT", body: { username } });
    $("accountName").textContent = result.username;
    notify("Benutzername gespeichert");
  } catch (error) {
    notify(error.message);
  }
}

// Downloads all stored data as a file (Art. 25/28 FADP).
async function exportAccount() {
  try {
    const data = await api("/account/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `finance-os-${todayISO()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify("Deine Daten wurden heruntergeladen");
  } catch (error) {
    notify(error.message);
  }
}

// Deleting needs two steps: the password here sends an email, and only the link in it
// (login.html?delete=…) deletes the account with all data.
async function deleteAccount() {
  const password = $("deletePassword").value;
  if (!password) return notify("Bitte zur Bestätigung dein Passwort eingeben.");
  if (!(await confirmAction({ title: t("Konto löschen? Wir schicken dir zuerst eine E-Mail zur Bestätigung."), okLabel: t("E-Mail schicken") }))) return;
  try {
    const result = await api("/account", { method: "DELETE", body: { password } });
    $("deletePassword").value = "";
    $("deleteSent").textContent = t(result.message);
    $("deleteSent").hidden = false;
    notify(result.message);
  } catch (error) {
    $("deletePassword").value = "";
    notify(error.message);
  }
}

// Events

const actions = {
  "change-month": openMonthEntry,
  "close-month-entry": () => $("monthEntry").close(),
  "pick-month": pickMonth,
  "picker-year": changePickerYear,
  arrange: toggleArranging,
  "reset-layout": resetLayout,
  "start-tour": startTour,
  "show-comparison": showComparison,
  "close-comparison": () => $("comparisonDialog").close(),
  "new-entry": openNewEntry,
  "toggle-recurring-payment": toggleRecurringPayment,
  "toggle-theme": toggleTheme,
  "add-allowance": addAllowance,
  "add-account": addAccount,
  "rename-account": (data) => renameAccount(data.id),
  "delete-account-item": (data) => deleteMoneyAccount(data.id),
  "delete-allowance": (data) => deleteAllowance(data.id),
  "save-entry": saveEntry,
  "save-recurring": saveRecurring,
  "save-settings": saveSettings,
  "cancel-edit": (data) => cancelEdit(data.form),
  "edit-record": (data) => editRecord(data.type, Number(data.id)),
  "delete-record": (data) => deleteRecord(data.type, Number(data.id)),
  "add-list-item": (data) => addListItem(data.list),
  "rename-list-item": (data) => renameListItem(data.list, Number(data.index)),
  "delete-list-item": (data) => deleteListItem(data.list, Number(data.index)),
  "reset-all": resetAll,
  "toggle-list": (data) => {
    const id = data.list;
    if (expandedLists.has(id)) expandedLists.delete(id);
    else expandedLists.add(id);
    render();
    if (!expandedLists.has(id)) $(id).closest(".fold").scrollIntoView({ block: "nearest" });
  },
  "dismiss-onboarding": () => {
    state.onboardingDismissed = true;
    persist();
  },
  "change-username": changeUsername,
  "export-account": exportAccount,
  "delete-account": deleteAccount,
  logout: async () => {
    // Save pending changes first, then log out.
    if (saveOnline.pending) {
      clearTimeout(saveOnline.timer);
      await sendData();
    }
    logoutAndRedirect();
  },
};

// No input is accepted until the data has loaded; otherwise an empty state
// could overwrite the saved data.
document.addEventListener("click", (event) => {
  if (!ready) return;
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.page) showPage(button.dataset.page);
  if (button.dataset.action === "move-block") return moveBlock(button);
  if (button.dataset.action === "resize-block") return resizeBlock(button);
  const action = actions[button.dataset.action];
  if (action) action(button.dataset);
});

document.addEventListener("input", (event) => {
  if (!ready) return;
  const field = event.target;
  if (DRAFT_FIELDS.includes(field.id)) {
    state.drafts[field.id] = field.value;
    save();
  }
});

document.addEventListener("change", (event) => {
  if (!ready) return;
  const field = event.target;
  if (APPEARANCE_FIELDS.includes(field.name)) return changeAppearance(field);
  if (field.dataset.allowance || field.dataset.allowanceToggle || field.dataset.allowancePer) return changeAllowance(field);
  if (field.dataset.accountStart) return changeAccountStart(field);
  if (SETTINGS_FIELD.test(field.id)) return saveSettings();

  if (field.id === "entryKind" || field.id === "recKind") fillSelects();
  if (DRAFT_FIELDS.includes(field.id)) {
    state.drafts[field.id] = field.value;
    if (field.id === "entryKind") state.drafts.exCat = $("exCat").value;
    if (field.id === "recKind") state.drafts.recCat = $("recCat").value;
    save();
  }
});

// Number fields: a 0 disappears on focus so the user can type right away;
// an empty settings field shows 0 again on blur.
document.addEventListener("focusin", (event) => {
  const field = event.target;
  if (field.type === "number" && field.value !== "" && Number(field.value) === 0) field.value = "";
});
document.addEventListener("focusout", (event) => {
  const field = event.target;
  const settingsNumber = SETTINGS_FIELD.test(field.id) || field.dataset.allowance || field.dataset.accountStart;
  if (field.type === "number" && field.value === "" && settingsNumber) {
    field.value = "0";
  }
});

// Enter in a form field saves the entry or standing order.
document.addEventListener("keydown", (event) => {
  if (!ready || event.key !== "Enter" || event.target.tagName !== "INPUT") return;
  if (event.target.id === "allowanceName") return addAllowance();
  if (event.target.id === "accountNewName") return addAccount();
  if (event.target.dataset.listInput) return addListItem(event.target.dataset.listInput);
  const form = formOfField(event.target.id);
  if (form === "expenses") saveEntry();
  else if (form === "recurring") saveRecurring();
});


// Recalculate after midnight and when returning to the tab.
let calculationDate = todayISO();
setInterval(() => {
  if (ready && todayISO() !== calculationDate) {
    calculationDate = todayISO();
    render();
  }
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (ready && !document.hidden) {
    calculationDate = todayISO();
    render();
  }
});

window.addEventListener("pagehide", flushData);

// Start

async function loadSavedData() {
  if (!ONLINE) return readLocalData();
  const me = await api("/auth/me"); // api() redirects to the login page when not logged in
  const saved = await api("/data"); // null if nothing has been saved yet
  showAccount(me);
  $("accountBox").hidden = false;
  $("accountCard").hidden = false;
  $("privacyCard").hidden = false;
  setSaveStatus(t("Alles gespeichert"));
  $("storageNote").textContent = t("Deine Eingaben werden automatisch in deinem Konto gespeichert.");
  return saved || {};
}

async function start() {
  initFolds();
  let saved;
  try {
    saved = await loadSavedData();
  } catch (error) {
    // Without login (401) api() redirects; the app stays hidden meanwhile.
    if (error.message !== "Bitte neu einloggen") {
      document.documentElement.classList.remove("checking-login");
      notify(error.message); // e.g. backend not reachable
    }
    return;
  }
  document.documentElement.classList.remove("checking-login"); // login confirmed, show the app

  state = loadData(saved);
  localizeDefaultNames();
  addBlockBars();
  syncAccountBlocks();
  applyLayout();
  editing = loadEditing();
  $("setPayday").innerHTML = Array.from({ length: 28 }, (_, i) => i + 1)
    .map((day) => `<option value="${day}">${day}.${day === 1 ? ` (= ${t("Kalendermonat")})` : ""}</option>`)
    .join("");
  buildYearSettings();
  // Always start in today's pay month; otherwise a month chosen earlier stays open after payday
  // and new entries seem to be missing.
  setCurrentMonth(todaysMonth());
  fillSelects();
  Object.keys(FORMS).forEach((form) => resetForm(form));
  restoreDrafts();
  ready = true;
  applyAppearance(state.appearance);
  renderAppearance();
  render();
  if (appearance.startPage !== "dashboard") showPage(appearance.startPage);
  if (needsSetup()) return openSetup();
  if (!state.setupDone) state.setupDone = true; // accounts from before the setup existed
  save();
  if (!state.tourDone) startTour();
}

start();
