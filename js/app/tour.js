// Guided tour ("joyride") through the app. It starts once after the first login and can be
// restarted under Settings → Appearance. Each step highlights one element and explains it.
//
// Tour.start({ onFinish }) runs the tour; onFinish is called when it is finished or skipped.

const Tour = (() => {
  const t = I18N.t;

  // target: CSS selectors; the first visible one is highlighted (desktop and phone differ).
  // Without a target the step is shown in the middle of the screen.
  const STEPS = [
    {
      title: "Willkommen bei Finance OS",
      text: "In ein paar kurzen Schritten zeige ich dir, wo du was findest. Du kannst die Tour jederzeit überspringen.",
    },
    {
      target: ['.nav [data-page="settings"]'],
      title: "Zuerst einrichten",
      text: "Unter Einstellungen trägst du Lohntag, Lohn, Pauschalen und deine Konten ein. Damit rechnet Finance OS alles Weitere.",
    },
    {
      target: ['#dashboard [data-action="new-entry"]'],
      page: "dashboard",
      title: "Einnahmen und Ausgaben erfassen",
      text: "Mit „+/− Eintrag“ hältst du Ausgaben, Einnahmen und Sparbeträge fest.",
    },
    {
      target: ['.nav [data-page="recurring"]'],
      title: "Daueraufträge",
      text: "Handy-Abo, Fitness oder Nebenjob: einmal erfassen, Finance OS rechnet sie jeden Monat automatisch ein.",
    },
    {
      target: ['.nav [data-page="month"]'],
      title: "Monat",
      text: "Die Monatsrechnung: was reinkommt, was rausgeht und was noch verfügbar ist.",
    },
    {
      target: ['.nav [data-page="dashboard"]'],
      title: "Dashboard",
      text: "Wie viel du in diesem Lohnmonat noch ausgeben kannst – und deine Kontostände. Die Statistik seit Lehrbeginn klappst du unten auf.",
    },
    {
      target: [".mobile-month", '.month-switch [data-action="change-month"]'],
      title: "Lohnmonat wechseln",
      text: "Ein Lohnmonat läuft vom Lohntag bis zum Tag davor. Hier wechselst du zu einem anderen Monat.",
    },
    {
      target: ["#appBurger", ".sidebar-tools"],
      title: "Sprache und Darstellung",
      text: "Deutsch, English, Français oder Italiano – und hell oder dunkel, wie es dir gefällt.",
    },
    {
      title: "Alles bereit!",
      text: "Die Tour kannst du jederzeit unter Einstellungen → Darstellung wieder starten.",
    },
  ];

  const GAP = 12; // space between the highlighted element and the card
  let index = 0;
  let onFinish = null;
  let elements = null;
  let previousFocus = null;

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  };

  function targetOf(step) {
    if (!step.target) return null;
    for (const selector of step.target) {
      const element = [...document.querySelectorAll(selector)].find(isVisible);
      if (element) return element;
    }
    return null;
  }

  function build() {
    const spotlight = document.createElement("div");
    spotlight.className = "tour-spotlight";
    spotlight.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className = "tour-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "tourTitle");
    card.setAttribute("aria-describedby", "tourText");
    card.innerHTML = `
      <button type="button" class="tour-close" data-tour="skip" aria-label="${t("Tour beenden")}">×</button>
      <p class="tour-progress" id="tourProgress"></p>
      <h2 id="tourTitle"></h2>
      <p id="tourText"></p>
      <div class="tour-buttons">
        <button type="button" class="tour-skip" data-tour="skip">${t("Überspringen")}</button>
        <span class="tour-nav">
          <button type="button" class="secondary" data-tour="back">${t("Zurück")}</button>
          <button type="button" class="primary" data-tour="next"></button>
        </span>
      </div>`;

    const blocker = document.createElement("div");
    blocker.className = "tour-blocker"; // catches clicks on the page while the tour is open

    document.body.append(blocker, spotlight, card);
    card.addEventListener("click", (event) => {
      const action = event.target.closest("[data-tour]")?.dataset.tour;
      if (action === "next") go(index + 1);
      if (action === "back") go(index - 1);
      if (action === "skip") finish();
    });
    return { blocker, spotlight, card };
  }

  function show() {
    const step = STEPS[index];
    if (step.page && typeof showPage === "function") showPage(step.page);
    const target = targetOf(step);
    const { blocker, spotlight, card } = elements;

    card.querySelector("#tourProgress").textContent = t("Schritt {n} von {total}", { n: index + 1, total: STEPS.length });
    card.querySelector("#tourTitle").textContent = t(step.title);
    card.querySelector("#tourText").textContent = t(step.text);
    card.querySelector('[data-tour="back"]').hidden = index === 0;
    const last = index === STEPS.length - 1;
    card.querySelector('[data-tour="next"]').textContent = last ? t("Fertig") : t("Weiter");
    card.querySelector(".tour-skip").hidden = last;

    if (target) target.scrollIntoView({ block: "nearest", inline: "nearest" });
    spotlight.hidden = !target;
    blocker.classList.toggle("dim", !target);
    card.classList.toggle("centered", !target);
    place(target);
    card.querySelector('[data-tour="next"]').focus();
  }

  // Highlight the target and put the card below, above or next to it, inside the screen.
  function place(target) {
    const { spotlight, card } = elements;
    card.style.left = card.style.top = "";
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const pad = 6;
    Object.assign(spotlight.style, {
      left: `${rect.left - pad}px`,
      top: `${rect.top - pad}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
    });

    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const roomBelow = innerHeight - rect.bottom;
    const roomRight = innerWidth - rect.right;
    let left;
    let top;
    if (roomBelow >= height + GAP * 2) {
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - width / 2;
    } else if (rect.top >= height + GAP * 2) {
      top = rect.top - height - GAP;
      left = rect.left + rect.width / 2 - width / 2;
    } else if (roomRight >= width + GAP * 2) {
      left = rect.right + GAP;
      top = rect.top + rect.height / 2 - height / 2;
    } else {
      left = rect.left - width - GAP;
      top = rect.top + rect.height / 2 - height / 2;
    }
    card.style.left = `${Math.max(GAP, Math.min(left, innerWidth - width - GAP))}px`;
    card.style.top = `${Math.max(GAP, Math.min(top, innerHeight - height - GAP))}px`;
  }

  function go(next) {
    if (next < 0) return;
    if (next >= STEPS.length) return finish();
    index = next;
    show();
  }

  function onKey(event) {
    if (event.key === "Escape") finish();
    else if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "Tab") {
      // Keep the keyboard focus inside the card.
      const buttons = [...elements.card.querySelectorAll("button:not([hidden])")];
      const position = buttons.indexOf(document.activeElement);
      const next = (position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus();
      event.preventDefault();
    }
  }

  const reposition = () => elements && place(targetOf(STEPS[index]));

  function finish() {
    if (!elements) return;
    Object.values(elements).forEach((element) => element.remove());
    elements = null;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    previousFocus?.focus?.();
    onFinish?.();
  }

  function start(options = {}) {
    if (elements) return;
    onFinish = options.onFinish;
    previousFocus = document.activeElement;
    index = 0;
    elements = build();
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    show();
  }

  return { start, isOpen: () => Boolean(elements), steps: STEPS.length };
})();
