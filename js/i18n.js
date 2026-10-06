// Translations: German is the source language, English, French and Italian are looked up
// in js/translations.js ("German text": ["English", "Français", "Italiano"]).
//
// I18N.t(text, params) translates a single text and fills placeholders such as {n}.
// Static page text is translated on load; elements with translate="no" are skipped.

const LANGUAGES = ["de", "en", "fr", "it"];
const LANGUAGE_KEY = "financeOS_lang";

const I18N = (() => {
  function detectLanguage() {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (LANGUAGES.includes(saved)) return saved;
    } catch {
      // Storage is blocked; fall back to the browser language.
    }
    const browserLanguage = (navigator.language || "de").slice(0, 2).toLowerCase();
    return LANGUAGES.includes(browserLanguage) ? browserLanguage : "de";
  }

  const language = detectLanguage();
  const column = LANGUAGES.indexOf(language) - 1; // index into the translation arrays
  const dictionary = window.TRANSLATIONS || {};
  const normalize = (text) => text.replace(/\s+/g, " ").trim();

  document.documentElement.lang = language;
  // Hide the page until it is translated so German text does not flash up.
  if (language !== "de") document.documentElement.classList.add("i18n-wait");

  // Keys with placeholders also match texts with filled-in values, e.g. server messages
  // like "Zu viele Fehlversuche – bitte in 12 Minuten erneut versuchen".
  const escapeRegex = (text) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const patterns = Object.keys(dictionary)
    .filter((key) => /\{\w+\}/.test(key))
    .map((key) => {
      const names = [...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      const source = escapeRegex(key).replace(/\\\{\w+\\\}|\{\w+\}/g, "(.+?)");
      return { key, names, regex: new RegExp(`^${source}$`) };
    });

  function lookup(text) {
    if (language === "de") return null;
    const clean = normalize(text);
    const exact = dictionary[clean]?.[column];
    if (exact) return exact;

    for (const { key, names, regex } of patterns) {
      const match = clean.match(regex);
      if (!match) continue;
      let result = dictionary[key][column];
      names.forEach((name, i) => (result = result.replaceAll(`{${name}}`, match[i + 1])));
      return result;
    }

    // The backend joins several validation messages with ", ".
    if (clean.includes(", ")) {
      const parts = clean.split(", ").map((part) => dictionary[part]?.[column]);
      if (parts.every(Boolean)) return parts.join(", ");
    }
    return null;
  }

  function t(text, params) {
    let result = lookup(text) ?? text;
    if (params) {
      for (const [key, value] of Object.entries(params)) result = result.replaceAll(`{${key}}`, value);
    }
    return result;
  }

  const TRANSLATED_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt", "content"];

  function translatePage(root = document.documentElement) {
    if (language !== "de") {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest("[translate=no], script, style")) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        const translated = lookup(node.nodeValue);
        if (translated !== null) {
          const [, leading, , trailing] = node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
          node.nodeValue = leading + translated + trailing;
        }
      }

      root.querySelectorAll("*").forEach((element) => {
        if (element.closest("[translate=no]")) return;
        for (const name of TRANSLATED_ATTRIBUTES) {
          const value = element.getAttribute(name);
          const translated = value && lookup(value);
          if (translated) element.setAttribute(name, translated);
        }
      });

      const title = lookup(document.title);
      if (title) document.title = title;
    }
    document.querySelectorAll("[data-lang-select]").forEach((select) => (select.value = language));
    document.documentElement.classList.remove("i18n-wait");
  }

  // Changing the language reloads the page; open forms save their drafts on pagehide.
  function setLanguage(next) {
    if (!LANGUAGES.includes(next) || next === language) return;
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      return;
    }
    location.reload();
  }

  // Swiss locale for numbers and month names, e.g. "fr-CH".
  const locale = `${language}-CH`;

  document.addEventListener("DOMContentLoaded", () => {
    // app.html translates itself before it renders user data (data-i18n-manual).
    if (!document.documentElement.hasAttribute("data-i18n-manual")) translatePage();
    document.querySelectorAll("[data-lang-select]").forEach((select) => {
      select.value = language;
      select.addEventListener("change", () => setLanguage(select.value));
    });
  });

  return { language, locale, t, translatePage };
})();
