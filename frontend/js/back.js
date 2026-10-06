// "Back" links on the privacy and contact pages: return to the exact place the visitor
// came from (same page, same view, same scroll position; see js/site.js).

document.querySelectorAll("[data-back]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const origin = cameFromPage();
    event.preventDefault();

    if (origin && history.length > 1) {
      history.back();
      return;
    }
    if (origin) {
      try {
        sessionStorage.setItem(RETURN_KEY, origin);
      } catch {
        // Without storage the page opens at the top.
      }
      location.href = origin;
      return;
    }
    // Opened in a new tab (e.g. from the app): close it, which shows the previous tab again.
    if (history.length === 1) {
      window.close();
      setTimeout(() => (location.href = link.href), 200); // the browser refused to close the tab
      return;
    }
    location.href = link.href;
  });
});
