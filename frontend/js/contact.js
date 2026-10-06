// Contact page: checks the form, shows how many characters are left and sends the
// message to the backend (POST /api/contact), which emails it to the operator.

const t = I18N.t;
const form = document.getElementById("contactForm");
const submitButton = document.getElementById("contactSubmit");
const errorBox = document.getElementById("contactError");
const noticeBox = document.getElementById("contactNotice");

// Field id → name in the request. Typed text survives a visit to the privacy page.
const FIELDS = {
  contactName: "name",
  contactEmail: "email",
  contactSubject: "subject",
  contactMessage: "message",
};
const DRAFT_KEY = "financeOS_contactDraft";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = (id) => document.getElementById(id);

function showMessage(box, message) {
  box.textContent = message ? t(message) : "";
  box.hidden = !message;
}

function updateCounter(id) {
  const input = field(id);
  const counter = document.querySelector(`[data-count-for="${id}"]`);
  counter.textContent = `${input.value.length}/${input.maxLength}`;
  counter.classList.toggle("full", input.value.length >= input.maxLength);
}

function saveDraft() {
  const draft = {};
  for (const id of Object.keys(FIELDS)) draft[id] = field(id).value;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode.
  }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
    for (const id of Object.keys(FIELDS)) if (draft[id]) field(id).value = draft[id];
  } catch {
    // Nothing stored.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing stored.
  }
}

/** Same checks as the backend; returns the first problem or "". */
function validate(values) {
  if (!values.name) return "Bitte deinen Vor- und Nachnamen eingeben";
  if (!values.email) return "Bitte deine E-Mail-Adresse eingeben";
  if (!EMAIL_PATTERN.test(values.email)) return "E-Mail ist ungültig";
  if (!values.subject) return "Bitte einen Betreff eingeben";
  if (!values.message) return "Bitte eine Nachricht eingeben";
  return "";
}

async function send() {
  const values = {};
  for (const [id, name] of Object.entries(FIELDS)) values[name] = field(id).value.trim();
  values.website = field("contactWebsite").value;

  showMessage(noticeBox, "");
  const problem = validate(values);
  showMessage(errorBox, problem);
  if (problem) return;

  submitButton.disabled = true;
  submitButton.textContent = t("Bitte warten …");
  try {
    const result = await api("/contact", { method: "POST", body: values, redirectOn401: false });
    form.reset();
    clearDraft();
    Object.keys(FIELDS).forEach(updateCounter);
    showMessage(noticeBox, result.message);
    noticeBox.scrollIntoView({ block: "nearest" });
  } catch (error) {
    showMessage(errorBox, error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = t("Nachricht senden");
  }
}

restoreDraft();
for (const id of Object.keys(FIELDS)) {
  updateCounter(id);
  field(id).addEventListener("input", () => {
    updateCounter(id);
    saveDraft();
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  send();
});
