// Contact form: checks, 30-character limits, sending.
const { test, expect, mailsTo } = require("./fixtures");

test("the form checks the input and limits name, email and subject to 30 characters", async ({ page }) => {
  await page.goto("/kontakt.html");
  await page.click("#contactSubmit");
  await expect(page.locator("#contactError")).toHaveText("Bitte deinen Vor- und Nachnamen eingeben");

  for (const id of ["#contactName", "#contactEmail", "#contactSubject"]) {
    await page.fill(id, "x".repeat(45));
    await expect(page.locator(id)).toHaveValue("x".repeat(30));
  }
  await expect(page.locator('[data-count-for="contactSubject"]')).toHaveText("30/30");

  await page.fill("#contactName", "Lea Muster");
  await page.fill("#contactEmail", "keine-adresse");
  await page.fill("#contactSubject", "Frage");
  await page.fill("#contactMessage", "Hallo");
  await page.click("#contactSubmit");
  await expect(page.locator("#contactError")).toHaveText("E-Mail ist ungültig");
});

test("a message is sent to the operator", async ({ page, request }) => {
  const subject = `Frage ${Date.now().toString(36)}`;
  await page.goto("/kontakt.html");
  await page.fill("#contactName", "Lea Muster");
  await page.fill("#contactEmail", "lea@e2e.test");
  await page.fill("#contactSubject", subject);
  await page.fill("#contactMessage", "Wie erfasse ich meinen 13. Monatslohn?");
  await page.click("#contactSubmit");
  await expect(page.locator("#contactNotice")).toContainText("Nachricht wurde gesendet");
  await expect(page.locator("#contactName")).toHaveValue("");

  const mails = await mailsTo(request, "kontakt@e2e.test");
  const mail = mails.find((m) => m.subject === `Kontaktformular: ${subject}`);
  expect(mail).toBeTruthy();
  expect(mail.replyTo).toBe("lea@e2e.test");
  expect(mail.text).toContain("13. Monatslohn");
});
