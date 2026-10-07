// Shared helpers for the end-to-end tests.
const base = require("@playwright/test");

const API_URL = process.env.E2E_API_URL || "http://localhost:8081/api";
const MAILBOX_URL = API_URL.replace("localhost", "127.0.0.1") + "/e2e/mails";
const PASSWORD = "Velo-Berg-7!";

/** A new, unused email address per test (the backend keeps users until it is restarted). */
function uniqueEmail(prefix = "user") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

const test = base.test.extend({
  // Language of the website for the test; set once per browser tab, so a language
  // the test chooses itself is kept.
  language: ["de", { option: true }],

  page: async ({ page, language }, use) => {
    await page.addInitScript(
      ([apiUrl, lang]) => {
        window.FINANCE_OS_API_URL = apiUrl;
        if (!sessionStorage.getItem("e2eLanguageSet")) {
          localStorage.setItem("financeOS_lang", lang);
          sessionStorage.setItem("e2eLanguageSet", "1");
        }
      },
      [API_URL, language],
    );
    // The app asks in its own dialog (#appDialog). It is answered like a person would:
    // a queued text (answerDialog) is typed in, then "OK" is clicked.
    // Browser pop-ups are not used any more; page.browserDialogs records any that appear.
    const answers = [];
    page.answerDialog = (text) => answers.push(text);
    page.browserDialogs = [];
    page.on("dialog", (dialog) => {
      page.browserDialogs.push(dialog.message());
      dialog.accept(answers.shift()).catch(() => {});
    });
    await page.exposeFunction("e2eNextAnswer", () => answers.shift() ?? null);
    await page.addInitScript(() => {
      new MutationObserver(async (changes) => {
        for (const change of changes) {
          const dialog = change.target;
          if (dialog.id !== "appDialog" || !dialog.open) continue;
          const text = await window.e2eNextAnswer();
          const input = document.getElementById("appDialogInput");
          if (text !== null) input.value = text;
          document.getElementById("appDialogOk").click();
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["open"] });
    });
    await use(page);
  },
});

/** All emails the test backend "sent" to an address, oldest first. */
async function mailsTo(request, email) {
  const response = await request.get(`${MAILBOX_URL}?to=${encodeURIComponent(email)}`);
  base.expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Waits for the newest email to an address that contains ?param=… and returns that link's path. */
async function linkFromMail(request, email, param) {
  let link = null;
  await base.expect
    .poll(async () => {
      const mails = await mailsTo(request, email);
      for (const mail of [...mails].reverse()) {
        const match = mail.text.match(new RegExp(`https?://[^\\s]+\\?${param}=[^\\s]+`));
        if (match) {
          link = match[0];
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  const url = new URL(link);
  return url.pathname + url.search;
}

async function register(page, { email, username = "Lea", password = PASSWORD }) {
  await page.goto("/login.html?register");
  await page.fill("#username", username);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.check("#acceptTerms");
  await page.click("#submitBtn");
  await base.expect(page.locator("#authNotice")).toBeVisible();
}

async function verifyEmail(page, request, email) {
  await page.goto(await linkFromMail(request, email, "verify"));
  await base.expect(page.locator("#authNotice")).toBeVisible();
}

async function logIn(page, { email, password = PASSWORD }) {
  if (!page.url().includes("/login.html")) await page.goto("/login.html");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("#submitBtn");
  await page.waitForURL("**/app.html");
  await base.expect(page.locator("#financeApp")).toBeVisible();
}

/** Registers, confirms the email and logs in. The app is open afterwards (tour still showing). */
async function createUser(page, request, options = {}) {
  const user = { email: uniqueEmail(options.prefix), password: PASSWORD, username: "Lea", ...options };
  await register(page, user);
  await verifyEmail(page, request, user.email);
  await logIn(page, user);
  return user;
}

async function skipTour(page) {
  const card = page.locator(".tour-card");
  await base.expect(card).toBeVisible();
  await card.locator('[data-tour="skip"]').first().click();
  await base.expect(card).toHaveCount(0);
}

/** New user with the app open and the tour closed. */
async function openApp(page, request, options) {
  const user = await createUser(page, request, options);
  await skipTour(page);
  return user;
}

async function goTo(page, pageId) {
  const button = page.locator(`.nav [data-page="${pageId}"]`);
  await button.click();
  await base.expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
}

/** No element makes the page wider than the screen. */
async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  base.expect(overflow).toBeLessThanOrEqual(1);
}

module.exports = {
  test,
  expect: base.expect,
  PASSWORD,
  uniqueEmail,
  mailsTo,
  linkFromMail,
  register,
  verifyEmail,
  logIn,
  createUser,
  skipTour,
  openApp,
  goTo,
  expectNoHorizontalScroll,
};
