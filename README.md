# Finance OS – Website

Die Website von Finance OS (HTML / CSS / JavaScript), veröffentlicht mit **GitHub Pages** unter
**https://kristian-m-f.github.io**. Das Backend (Login, Speichern, E-Mails) liegt im Repository
[finance-tracker-backend](https://github.com/Kristian-M-F/finance-tracker-backend).

## Ordnerstruktur

```
Kristian-M-F.github.io/
├── index.html              Startseite für neue Besucher
├── login.html              Login, Registrieren, Passwort vergessen/ändern, E-Mail ändern
├── app.html                Finance OS (Dashboard, Monat, Einträge, Daueraufträge, Einstellungen)
├── datenschutz.html        Datenschutzerklärung
├── impressum.html          Impressum (wer die Seite betreibt)
├── nutzungsbedingungen.html  Nutzungsbedingungen (werden bei der Registrierung akzeptiert)
├── kontakt.html            Kontaktformular
├── manifest.webmanifest    App auf dem Home-Bildschirm (Name, Icons, Farben)
├── version.json            Aktuelle Versionsnummer der Website (für den Hinweis „Neu laden“)
├── css/
│   ├── base.css            Farben, Schrift, Buttons, Felder, Sidebar (gilt überall)
│   ├── dashboard.css       Seite Dashboard
│   ├── month.css           Seite Monat
│   ├── month-entry.css     Popup „Lohnmonat wählen“ (Monat ändern)
│   ├── settings.css        Seite Einstellungen
│   ├── themes.css          Darstellung: Akzentfarben (Standard Lila), dunkler Modus, grosse Schrift
│   ├── tour.css            Geführte Tour durch die App
│   ├── setup.css           Einrichtung für neue Konten (Fragen beim ersten Login)
│   ├── responsive.css      Handy/Tablet in der App (wird zuletzt geladen)
│   ├── landing.css         Startseite
│   ├── login.css           Login, Datenschutz, Impressum, Nutzungsbedingungen, Kontakt
│   └── contact.css         Kontaktformular
├── js/
│   ├── app.js              Logik von Finance OS (Konten, Lohn, Pauschalen, Einträge …)
│   ├── setup.js            Einrichtung für neue Konten: Lehre, Lohn, 13. Monatslohn, Pauschalen, Abos
│   ├── tour.js             Geführte Tour (startet nach der Einrichtung)
│   ├── login.js            Login-Seite inkl. Passwort-Regeln
│   ├── contact.js          Kontaktformular prüfen und senden
│   ├── landing.js          Animationen der Startseite
│   ├── site.js             Startseite/Login/Datenschutz/Kontakt: Hell/Dunkel, Burger-Menü,
│   │                       merkt Herkunft und Scroll-Position jeder Seite
│   ├── back.js             „← Zurück“ an die gleiche Stelle
│   ├── i18n.js             Sprachen DE/EN/FR/IT: übersetzt die Seiten
│   ├── translations.js     Alle Übersetzungen – neue Texte hier ergänzen
│   ├── update.js           Hinweis „Neue Version – Neu laden“, wenn version.json sich ändert
│   └── api.js              Verbindung zum Backend (Adresse, Login-Schlüssel)
├── fonts/                  Schrift Inter (lokal, keine Google-Server)
├── img/                    Symbol im Browser-Tab, App-Icons (icon-*.png, apple-touch-icon.png), Screenshots
├── e2e/                    End-to-End-Tests (werden nicht veröffentlicht)
│   ├── fixtures.js         Gemeinsame Hilfen: Registrieren, Login, E-Mails lesen …
│   ├── serve.js            Kleiner Webserver für die Tests (Port 5510)
│   ├── landing.spec.js     Startseite, Sprachen, Hell/Dunkel
│   ├── auth.spec.js        Registrieren, Bestätigen, Login, Passwort-Regeln, Passwort vergessen
│   ├── setup.spec.js       Einrichtung für neue Konten
│   ├── tour.spec.js        Geführte Tour
│   ├── app.spec.js         Einträge, Sparen, Daueraufträge, Monat wechseln
│   ├── settings.spec.js    Pauschalen, Konten, Kategorien, Darstellung
│   ├── account.spec.js     Benutzername, Passwort, E-Mail ändern, Daten herunterladen, Konto löschen
│   ├── contact.spec.js     Kontaktformular
│   ├── navigation.spec.js  „Zurück“ an die gleiche Stelle
│   ├── i18n.spec.js        Alles auf Englisch, Französisch und Italienisch
│   └── mobile.spec.js      Handy-Ansicht
├── playwright.config.js    Einstellungen der Tests
├── package.json            Test-Werkzeug Playwright
└── _config.yml             Sagt GitHub Pages, welche Dateien nicht veröffentlicht werden
```

## Lokal ausprobieren

1. Backend in IntelliJ starten (Repository *finance-tracker-backend*, läuft auf `http://localhost:8080`).
2. Diesen Ordner in VS Code öffnen → `index.html` mit **Live Server** öffnen (`http://127.0.0.1:5500`).

Die Website merkt selbst, ob sie lokal läuft (dann Backend `localhost:8080`) oder online
(dann Backend bei Render). Die Adressen stehen oben in `js/api.js`.

## Veröffentlichen

Änderungen committen und auf `main` pushen – GitHub Pages ist nach 1–2 Minuten aktualisiert.
Läuft das Backend bei Render unter einer anderen Adresse als `https://finance-tracker-backend-5rru.onrender.com`,
diese an zwei Stellen anpassen: `PUBLIC_API_URL` in `js/api.js` und `connect-src` im
`<meta http-equiv="Content-Security-Policy">` oben in jeder HTML-Datei.

## Sprachen

Deutsch ist die Grundsprache. Jeder deutsche Text hat in `js/translations.js` eine Zeile
`"Deutscher Text": ["English", "Français", "Italiano"]`. Neue Texte dort ergänzen.
Standard-Kategorien, Konten und Pauschalen wechseln die Sprache mit; selbst eingetippte Namen
bleiben, wie sie sind. Die E-Mails des Backends kommen in der Sprache der Website.

## Einrichtung für neue Konten

Beim ersten Login erscheint ein Fenster mit Fragen (`js/setup.js`); die App dahinter ist verschwommen
und nicht bedienbar. Pflicht: Lehrbeginn, Dauer der Lehre, Lohntag, 13. Monatslohn, Lohn pro Lehrjahr
und Pauschalen. Überspringbar: Abos/feste Zahlungen. Die Antworten werden direkt in die Einstellungen
und als Daueraufträge gespeichert (`applySetup` in `js/app.js`) und können dort jederzeit geändert werden.
Konten, die schon einen Lohn eingetragen haben, sehen die Einrichtung nicht.

## Geführte Tour

Startet nach der Einrichtung automatisch und kann unter *Einstellungen → Darstellung → Tour starten*
wiederholt werden. Die Schritte stehen oben in `js/tour.js` (Ziel-Element, Titel, Text).

## End-to-End-Tests

Ein echter Browser klickt sich durch die ganze Website: Registrieren, E-Mail bestätigen,
Einträge, Einstellungen, Tour, Kontaktformular, alle Sprachen, Handy-Ansicht.
Die Tests nutzen ein **eigenes Test-Backend** (Port 8081, Datenbank nur im Speicher,
E-Mails landen in einem Test-Postfach) – deine echten Daten werden nie verändert.

Einmalig (Node.js muss installiert sein):

```bash
npm install
npx playwright install chromium
```

Tests starten:

```bash
npm run test:e2e
```

Das Test-Backend startet automatisch über Maven, wenn das Backend-Repository unter
`C:\Projects\projects\backen-finance` liegt (sonst `BACKEND_DIR` setzen). Ohne Maven: in IntelliJ im
Backend-Projekt `src/test/java/.../e2e/E2eServer.java` öffnen → Rechtsklick → *Run 'E2eServer.main()'*,
dann `npm run test:e2e`.

- `npm run test:e2e:ui` – Tests im Fenster ansehen und einzeln starten
- `npm run test:e2e:report` – Bericht der letzten Ausführung (mit Screenshots bei Fehlern)

## Neue Version veröffentlichen

Alle CSS- und JS-Dateien werden mit einer Versionsnummer eingebunden, z. B. `css/base.css?v=2026100806`,
und dieselbe Nummer steht in `version.json`. Bei jeder Änderung an der Website die Nummer überall erhöhen:
in IntelliJ **Strg+Shift+R** (Ersetzen in Dateien) → `2026100806` durch die neue Nummer ersetzen
(z. B. Datum + laufende Nummer: `2026100806`), dann pushen.

- Handys laden dadurch sicher die neuen Dateien statt der alten aus dem Zwischenspeicher.
- Wer die Seite oder die App auf dem Home-Bildschirm gerade offen hat, bekommt innerhalb von
  ein paar Minuten ein Fenster in der Mitte „Neue Version verfügbar“; der Rest ist verschwommen,
  weiter geht es nur mit „Neu laden“ (`js/update.js`).

## App auf dem Home-Bildschirm

`manifest.webmanifest` und die Icons in `img/` machen Finance OS installierbar:
iPhone (Safari) → Teilen → „Zum Home-Bildschirm“; Android (Chrome) → ⋮ → „App installieren“.
Die App öffnet dann ohne Browser-Leiste direkt `app.html`.
