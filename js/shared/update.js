// Tells visitors when a newer version of the website is online.
//
// Every page loads this file as js/shared/update.js?v=<version>. version.json contains the version that
// is online right now. If they differ (after a push with a new ?v= number), a pop-up in the
// middle of the screen asks to reload; the page behind is blurred until then. Checked shortly after opening, every 5 minutes and when the tab or the
// home-screen app becomes visible again.
//
// New version: replace the number in all files at once (IntelliJ: Ctrl+Shift+R), including version.json.

(() => {
  const script = document.currentScript;
  const current = script && new URL(script.src).searchParams.get("v");
  if (!current) return;
  const t = (text) => (window.I18N ? I18N.t(text) : text);
  let shown = false;

  async function check() {
    if (shown || document.hidden) return;
    try {
      const response = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const { version } = await response.json();
      if (version && String(version) !== current) show();
    } catch {
      // Offline or file missing: try again later.
    }
  }

  // Loads the page itself fresh first, so the reload does not show the cached old version.
  async function reload(button) {
    button.disabled = true;
    try {
      await fetch(location.pathname, { cache: "reload" });
    } catch {
      // Reload anyway.
    }
    location.reload();
  }

  // A pop-up in the middle; the page behind is blurred and cannot be used until it is reloaded.
  function show() {
    shown = true;
    const overlay = document.createElement("div");
    overlay.className = "update-overlay";
    overlay.innerHTML = `<div class="update-card" role="alertdialog" aria-modal="true" aria-labelledby="updateTitle" aria-describedby="updateText">
        <img src="img/icons/icon-192.png" alt="" width="56" height="56" />
        <h2 id="updateTitle">${t("Neue Version verfügbar")}</h2>
        <p id="updateText">${t("Finance OS wurde aktualisiert. Lade die Seite neu, um weiterzumachen. Deine Daten bleiben gespeichert.")}</p>
        <button type="button" class="update-reload">${t("Neu laden")}</button>
      </div>`;
    const button = overlay.querySelector(".update-reload");
    button.addEventListener("click", () => reload(button));
    // Keep the keyboard on the button (Tab, Escape do nothing else)
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Tab" || event.key === "Escape") {
        event.preventDefault();
        button.focus();
      }
    });
    document.body.append(overlay);
    document.body.classList.add("update-open");
    button.focus({ focusVisible: false });
  }

  setTimeout(check, 4000);
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", check);
})();
