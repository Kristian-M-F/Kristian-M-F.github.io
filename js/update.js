// Tells visitors when a newer version of the website is online.
//
// Every page loads this file as js/update.js?v=<version>. version.json contains the version that
// is online right now. If they differ (after a push with a new ?v= number), a note with
// "Neu laden" appears. Checked shortly after opening, every 5 minutes and when the tab or the
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

  function show() {
    shown = true;
    const note = document.createElement("div");
    note.className = "update-note";
    note.setAttribute("role", "status");
    note.innerHTML = `<span>${t("Eine neue Version von Finance OS ist da.")}</span>
      <button type="button" class="update-reload">${t("Neu laden")}</button>
      <button type="button" class="update-close" aria-label="${t("Schliessen")}">×</button>`;
    note.querySelector(".update-reload").addEventListener("click", (event) => reload(event.currentTarget));
    note.querySelector(".update-close").addEventListener("click", () => note.remove());
    document.body.append(note);
  }

  setTimeout(check, 4000);
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", check);
})();
