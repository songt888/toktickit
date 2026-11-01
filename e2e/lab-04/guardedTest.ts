import { expect, test as base } from "@playwright/test";

// Labsheet 8.5: a Lab 4 test fails on any uncaught page error or browser console error it did not expect.
// A request that fails on purpose makes the browser log "Failed to load resource: ... status of N";
// a test lists each one it causes as "<status> <path>" with test.use({ expectedHttpErrors }).
// The session check on page load (401 /api/auth/me before signing in) is part of the Lab 3 auth contract.
const alwaysExpected = ["401 /api/auth/me"];

export const test = base.extend<{ expectedHttpErrors: string[]; browserErrorGuard: void }>({
  expectedHttpErrors: [[], { option: true }],
  browserErrorGuard: [
    async ({ page, expectedHttpErrors }, use) => {
      const allowed = new Set([...alwaysExpected, ...expectedHttpErrors]);
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const status = /^Failed to load resource: .*status of (\d{3})/.exec(message.text())?.[1];
        const url = message.location().url;
        if (status && url && allowed.has(`${status} ${new URL(url).pathname}`)) return;
        problems.push(`console.error: ${message.text()} (${url})`);
      });
      await use();
      expect(problems, "unexpected browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
