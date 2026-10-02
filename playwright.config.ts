import { defineConfig, devices } from "@playwright/test";

const e2eApiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const e2eApiPort = new URL(e2eApiURL).port || "3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "artifacts/lab-02/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /requester-ticket-flow\.spec\.ts$/,
    },
    {
      name: "responsive",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /responsive\.spec\.ts$/,
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1000 } },
      testMatch: /responsive\.spec\.ts$/,
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
      testMatch: /responsive\.spec\.ts$/,
    },
    {
      name: "auth-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /lab-03\/authentication\.spec\.ts$/,
    },
    {
      name: "auth-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1000 } },
      testMatch: /lab-03\/authentication\.spec\.ts$/,
    },
    {
      name: "auth-mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
      testMatch: /lab-03\/authentication\.spec\.ts$/,
    },
    {
      name: "requester-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /lab-03\/requester-flow\.spec\.ts$/,
    },
    {
      name: "accessibility",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /lab-03\/accessibility\.spec\.ts$/,
    },
    {
      name: "staff-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /staff-ticket-flow\.spec\.ts$/,
    },
    {
      name: "admin-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /user-administration\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      url: `${e2eApiURL}/api/health`,
      env: { PORT: e2eApiPort },
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      cwd: "client",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
