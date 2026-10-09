"use strict";

// Finance OS app, part: Sparzukunft page. Per apprenticeship year: what is saved every month
// (automatic saving, saved allowances, 13th-month salary when its switch is on) out of the
// monthly income, what is left to spend, and what is saved once a year (yearly allowances,
// 13th-month salary with the November/December pay). On top: the total until the end of the
// apprenticeship. The amounts are set under Einstellungen → Lohn & Pauschalen.

function futureYear(i) {
  const salary = Number(state.salaries[i]) || 0;
  const saveThirteenth = Boolean((state.thirteenthSave || [])[i]);
  const parts = [];
  const yearly = [];
  let income = salary;
  let saved = 0;
  const addSaved = (label, amount) => {
    if (amount > 0) {
      saved += amount;
      parts.push([label, amount]);
    }
  };
  addSaved(t("Automatisch sparen"), Number(state.extraSave[i]) || 0);
  for (const allowance of enabledAllowances()) {
    const amount = Number(allowance.amounts[i]) || 0;
    const save = Number(allowance.save[i]) || 0;
    if (allowance.per === "year") {
      if (amount) yearly.push({ label: allowance.name, amount, save });
      continue;
    }
    income += amount;
    addSaved(allowance.name, save);
  }
  if (state.thirteenth === "spread" && saveThirteenth) addSaved(t("13. Lohn (Anteil)"), Math.round((salary / 13) * 100) / 100);
  if (["11", "12"].includes(state.thirteenth) && salary) {
    yearly.push({ label: t("13. Monatslohn"), amount: salary, save: saveThirteenth ? salary : 0 });
  }
  const perYear = saved * 12 + yearly.reduce((sum, item) => sum + item.save, 0);
  return { income, saved, left: income - saved, parts, yearly, perYear };
}

function renderFuture() {
  const years = yearIndexes().map((i) => ({ i, ...futureYear(i) }));
  const total = years.reduce((sum, year) => sum + year.perYear, 0);
  const biggest = Math.max(...years.map((year) => year.perYear), 1);

  $("futureTotal").textContent = chf(total);
  $("futureTotalNote").textContent = t("in {years} Lehrjahren, wenn alles so bleibt wie eingestellt", { years: years.length });
  $("futureYears").innerHTML = years
    .map(
      (year) => `<li>
        <span>${yearLabel(year.i)}</span>
        <span class="future-bar"><span style="width:${Math.round((year.perYear / biggest) * 100)}%"></span></span>
        <b>${chf(year.perYear)}</b>
      </li>`,
    )
    .join("");

  $("saveOverview").innerHTML = years
    .map((year) => {
      const share = year.income ? Math.round((year.saved / year.income) * 100) : 0;
      const parts = year.parts.length
        ? year.parts.map(([label, amount]) => `<li><span>${escapeHTML(label)}</span><b>${chf(amount)}</b></li>`).join("")
        : `<li class="empty-line"><span>${t("Noch nichts eingestellt")}</span></li>`;
      const yearly = year.yearly
        .map(
          (item) => `<p class="save-yearly">${t("Einmal pro Jahr")}: ${escapeHTML(item.label)} ${chf(item.amount)}${
            item.save ? ` – ${t("davon gespart")} <b>${chf(item.save)}</b>` : ""
          }</p>`,
        )
        .join("");
      return `<article class="card save-year">
        <h2>${yearLabel(year.i)}</h2>
        <p class="save-headline">${t("Du sparst {saved} von {income} pro Monat", {
          saved: `<b>${chf(year.saved)}</b>`,
          income: chf(year.income),
        })}</p>
        <div class="save-meter" aria-hidden="true"><span style="width:${Math.min(100, share)}%"></span></div>
        <p class="save-left">${share} % ${t("gespart")} · ${t("zum Ausgeben bleiben {amount}", { amount: `<b>${chf(year.left)}</b>` })}</p>
        <ul class="save-parts">${parts}</ul>
        ${yearly}
      </article>`;
    })
    .join("");
}

// "Beträge ändern": to Einstellungen → Lohn & Pauschalen
function editSaving() {
  showPage("settings");
  showSettingsTab("pay");
}
