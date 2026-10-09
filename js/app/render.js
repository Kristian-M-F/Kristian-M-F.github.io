"use strict";

// Finance OS app, part: Showing the data: dashboard, statistics, month page, entry and standing-order lists.
// Loaded by app.html in this order: state.js → calc.js → render.js → render-settings.js → layout.js → navigation.js → forms.js → main.js

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
    // A year that lies completely before "Tracken ab" was not tracked.
    const lastOfYear = addMonths(firstMonth(), year * 12 + 11);
    if (!isTracked(lastOfYear)) {
      return `<div class="card kpi untracked">
      <span class="label">${yearLabel(year)}</span>
      <strong>–</strong>
      <div class="sub">${t("Nicht erfasst")}</div>
    </div>`;
    }
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
  if (!isTracked(month)) status = t("Nicht erfasst (vor „Tracken ab“)");
  else if (!hasStarted(month)) status = t("Beginnt am {date}", { date: formatDate(period(month).start) });
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
  if (!isTracked(month)) status = " · " + t("Nicht erfasst (vor „Tracken ab“)");
  else if (!hasStarted(month)) status = " · " + t("Noch nicht begonnen");
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
  // Spent (red) and saved (orange) as a share of the income; together at most the full bar.
  const spentPercent = money ? (Math.max(0, summary.spent) / money) * 100 : 0;
  const savedPercent = money ? (Math.max(0, summary.saved) / money) * 100 : 0;
  const spentWidth = Math.min(100, spentPercent);
  $("budgetSpent").style.width = spentWidth + "%";
  $("budgetSaved").style.width = Math.min(100 - spentWidth, savedPercent) + "%";
  $("budgetSpentPercent").textContent = percent(spentPercent);
  $("budgetSavedPercent").textContent = percent(savedPercent);
  $("budgetLegend").hidden = !money;
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
