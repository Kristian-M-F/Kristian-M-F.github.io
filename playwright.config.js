// End-to-end tests: a real browser clicks through the website like a visitor.
//
// Starts automatically:
//   1. the website on http://localhost:5510 (e2e/serve.js)
//   2. the test backend on http://localhost:8081 (E2eServer in the backend repository:
//      in-memory database, emails stay in a test mailbox)
// If the test backend is already running (e.g. started in IntelliJ), it is reused.
//
// Run: npm install → npx playwright install chromium → npm run test:e2e

const { defineConfig, devices } = require("@playwright/test");

const BACKEND_DIR = process.env.BACKEND_DIR || "../../projects/backen-finance";

module.exports = defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "e2e/report", open: "never" }]],
  outputDir: "e2e/results",
  use: {
    baseURL: "http://localhost:5510",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.js/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.js/ },
  ],
  webServer: [
    {
      command: "node e2e/serve.js",
      url: "http://127.0.0.1:5510/index.html",
      reuseExistingServer: true,
    },
    {
      command: "mvn -q spring-boot:test-run -Dspring-boot.run.main-class=ch.blj.financetracker.e2e.E2eServer",
      cwd: BACKEND_DIR,
      url: "http://127.0.0.1:8081/api/health",
      reuseExistingServer: true,
      timeout: 240000,
    },
  ],
});
