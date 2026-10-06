// Shared by the landing, login, privacy and contact pages. Loaded in <head> so the colour
// theme is applied before the first paint.
//  - Light/dark follows the device; the light bulb button overrides it.
//  - Remembers where the visitor came from and the scroll position of every page,
//    so "back" returns to exactly the same place (see js/back.js).
//  - Burger menu on small screens.
//  - The language select is wired up in js/i18n.js.

const THEME_KEY = "financeOS_theme"; // "light", "dark" or empty (follow the device)
const deviceDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "";
  } catch {
    return "";
  }
}

function applyTheme() {
  const theme = savedTheme();
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

const isDark = () => (savedTheme() || (deviceDarkQuery.matches ? "dark" : "light")) === "dark";

applyTheme();

// Navigation memory (per browser tab, in sessionStorage):
//  lastPage: the page that was open before this one
//  backTo:   for each page, the page it was opened from
//  scroll:   the last scroll position of each page
const NAVIGATION_KEY = "financeOS_navigation";
const RETURN_KEY = "financeOS_returnTo";
const pageKey = () => location.pathname + location.search;

function readNavigation() {
  try {
    return { backTo: {}, scroll: {}, ...JSON.parse(sessionStorage.getItem(NAVIGATION_KEY) || "{}") };
  } catch {
    return { backTo: {}, scroll: {} };
  }
}

function saveNavigation(navigation) {
  try {
    sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(navigation));
  } catch {
    // Private mode: "back" then simply follows the link.
  }
}

// A reload keeps the original origin; only a different page counts as "came from".
const navigation = readNavigation();
if (navigation.lastPage && new URL(navigation.lastPage, location.href).pathname !== location.pathname) {
  navigation.backTo[location.pathname] = navigation.lastPage;
  saveNavigation(navigation);
}

/** The page this one was opened from in the same tab, or null. */
function cameFromPage() {
  return readNavigation().backTo[location.pathname] || null;
}

window.addEventListener("pagehide", () => {
  const current = readNavigation();
  current.lastPage = pageKey();
  current.scroll[pageKey()] = Math.round(window.scrollY);
  saveNavigation(current);
});

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// Going back (browser button, reload or our "back" link): restore the scroll position.
function isReturning() {
  const type = performance.getEntriesByType("navigation")[0]?.type;
  let returnTo = null;
  try {
    returnTo = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing stored.
  }
  return type === "back_forward" || type === "reload" || returnTo === pageKey();
}

function restoreScroll() {
  const savedY = readNavigation().scroll[pageKey()] || 0;
  if (savedY <= 0) return;
  let userScrolled = false;
  const stop = () => (userScrolled = true);
  for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, stop, { once: true, passive: true });
  window.scrollTo({ top: savedY, behavior: "instant" });
  // Images, fonts and the hero animation can still change the page height a little;
  // correct the position again once they are done (unless the visitor scrolled already).
  const correct = () => {
    if (!userScrolled && Math.abs(window.scrollY - savedY) > 2) window.scrollTo({ top: savedY, behavior: "instant" });
  };
  document.fonts?.ready.then(correct);
  window.addEventListener("load", () => {
    correct();
    setTimeout(correct, 400);
  });
}

const returning = isReturning();
document.addEventListener("DOMContentLoaded", () => {
  if (returning) restoreScroll();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) restoreScroll(); // restored from the back/forward cache
});

// The button label describes what a click will do.
function updateThemeButtons() {
  const dark = isDark();
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(!dark));
    const text = dark ? "Licht an (helles Design)" : "Licht aus (dunkles Design)";
    const label = typeof I18N === "undefined" ? text : I18N.t(text);
    button.setAttribute("aria-label", label);
    button.title = label;
  });
}

deviceDarkQuery.addEventListener("change", updateThemeButtons);

document.addEventListener("DOMContentLoaded", () => {
  updateThemeButtons();

  document.querySelectorAll("[data-theme-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      try {
        // If the choice matches the device, store nothing so the page keeps following the device.
        if ((next === "dark") === deviceDarkQuery.matches) localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
      } catch {
        // Private mode: only for this page view.
        document.documentElement.dataset.theme = next;
      }
      applyTheme();
      updateThemeButtons();
    }),
  );

  const burger = document.querySelector("[data-burger]");
  const menu = burger && document.getElementById(burger.getAttribute("aria-controls"));
  if (burger && menu) {
    const setMenuOpen = (open) => {
      burger.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("open", open);
    };
    burger.addEventListener("click", () => setMenuOpen(burger.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", () => setMenuOpen(false));
  }
});
