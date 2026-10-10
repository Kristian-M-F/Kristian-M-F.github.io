"use strict";

// Finance OS app, part: Payday question. On the chosen payday (or the first time the app is
// opened after it), a pop-up asks what to do with the money left over from the pay month that
// just ended: save it on a savings account, or take it along into the new pay month.
//
// - "Sparen" adds a normal savings entry on the last day of the old month (can be deleted under Einträge).
// - "Mitnehmen" adds state.carryOvers[]: the old month gives the amount away, the new month gets it
//   (see monthSummary in calc.js), so the account balances stay the same.
// - Every pay month is asked about only once (state.paydayAnswered, saved with the account).
// - The question starts with the pay month after the one in which it was first used
//   (state.paydayStart), so new users are not asked about months from before they used the app.

let paydayChoice = "save";

// Month name without the year ("Oktober")
function monthOnly(month) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1).toLocaleDateString(I18N.locale, { month: "long" });
}

// The pay month that ended at the last payday, if the question is due for it; otherwise null.
function paydayMonthToAsk() {
  const current = payrollMonth(todayISO());
  if (!state.paydayStart) {
    state.paydayStart = current;
    save();
    return null;
  }
  const previous = addMonths(current, -1);
  if (previous < state.paydayStart || (state.paydayAnswered || []).includes(previous)) return null;
  if (!monthList().includes(previous) || !counts(previous)) return null;
  return monthSummary(previous).available >= 0.01 ? previous : null;
}

// Called after the start and when coming back to the tab.
function checkPayday() {
  if (!ready || needsSetup() || Tour.isOpen() || document.querySelector("dialog[open]")) return;
  const month = paydayMonthToAsk();
  if (month) openPayday(month);
}

function openPayday(month) {
  const left = Math.round(monthSummary(month).available * 100) / 100;
  const accounts = savingAccounts();
  const next = monthOnly(addMonths(month, 1));
  paydayChoice = accounts.length ? "save" : "carry";

  const dialog = $("paydayDialog");
  dialog.dataset.month = month;
  dialog.dataset.left = left;
  $("paydayText").textContent = t("Im Lohnmonat {month} ist dir Geld übrig geblieben:", { month: monthOnly(month) });
  $("paydayAmount").textContent = chf(left);
  $("paydayInput").value = left.toFixed(2);
  $("paydayError").textContent = "";

  const choices = [
    accounts.length ? ["save", t("Sparen"), t("Kommt auf dein Sparkonto")] : null,
    ["carry", t("In den {month} mitnehmen", { month: next }), t("Ist im neuen Lohnmonat zusätzlich verfügbar")],
  ].filter(Boolean);
  $("paydayChoices").innerHTML = choices
    .map(
      ([value, label, hint]) => `<button type="button" class="setup-choice" role="radio" data-action="payday-choice" data-value="${value}"
        aria-checked="${value === paydayChoice}"><b>${escapeHTML(label)}</b><small>${escapeHTML(hint)}</small></button>`,
    )
    .join("");
  $("paydayAccount").innerHTML = accounts
    .map((account) => `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)}</option>`)
    .join("");
  if (accounts.some((account) => account.id === state.autoAccount)) $("paydayAccount").value = state.autoAccount;
  showPaydayChoice();
  dialog.showModal();
}

function choosePayday(data) {
  paydayChoice = data.value;
  document.querySelectorAll('[data-action="payday-choice"]').forEach((button) =>
    button.setAttribute("aria-checked", String(button.dataset.value === paydayChoice)),
  );
  showPaydayChoice();
}

// The savings account is only asked for when saving (and when there is more than one).
function showPaydayChoice() {
  $("paydayAccountField").hidden = paydayChoice !== "save" || savingAccounts().length < 2;
}

function confirmPayday() {
  const dialog = $("paydayDialog");
  const month = dialog.dataset.month;
  const left = Number(dialog.dataset.left);
  const amount = parseAmount($("paydayInput").value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > left + 0.001) {
    $("paydayError").textContent = t("Bitte einen Betrag grösser als 0 und höchstens {max} eingeben.", { max: chf(left) });
    return;
  }
  const rounded = Math.round(amount * 100) / 100;
  let undo;
  if (paydayChoice === "save") {
    const account = savingAccounts().find((item) => item.id === $("paydayAccount").value) || savingAccounts()[0];
    const entry = {
      id: newId(),
      date: period(month).end,
      desc: t("Übrig aus {month}", { month: monthOnly(month) }),
      cat: account.name,
      pay: "",
      amount: rounded,
      payday: month, // shown as "Übrig vom Vormonat" in the next pay month
    };
    state.savingEntries.push(entry);
    undo = () => (state.savingEntries = state.savingEntries.filter((item) => item.id !== entry.id));
  } else {
    const carry = { id: newId(), from: month, amount: rounded };
    state.carryOvers = [...(state.carryOvers || []), carry];
    undo = () => (state.carryOvers = state.carryOvers.filter((item) => item.id !== carry.id));
  }
  state.paydayAnswered = [...(state.paydayAnswered || []), month];
  dialog.close();
  persist();
  notify(paydayChoice === "save" ? "Gespart" : "Mitgenommen", undefined, () => {
    undo();
    state.paydayAnswered = state.paydayAnswered.filter((item) => item !== month);
    persist();
  });
}

// "Rückgängig" next to a carried amount in the month overview
function undoCarry(data) {
  const carry = (state.carryOvers || []).find((item) => String(item.id) === data.id);
  if (!carry) return;
  state.carryOvers = state.carryOvers.filter((item) => item !== carry);
  // The question may come again for this month, so it can be answered differently.
  state.paydayAnswered = (state.paydayAnswered || []).filter((item) => item !== carry.from);
  persist();
  notify("Übertrag entfernt");
}

// Small "Rückgängig" button in the month ledger (detail line of a carried amount)
function carryUndo(carry) {
  return `<button type="button" class="link-button" data-action="undo-carry" data-id="${carry.id}">${escapeHTML(t("Rückgängig"))}</button>`;
}
