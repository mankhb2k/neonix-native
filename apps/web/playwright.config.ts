import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // CapCut timeline e2e still deferred; new AI Studio acceptance lives in smoke.spec.ts.
  testIgnore: [
    "**/timeline/**",
    "**/editor-timeline.spec.ts",
    "**/vite-phase0-screenshots.spec.ts",
  ],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Use node entrypoint so Windows spawn does not hang on .cmd shims.
        command: `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/app`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          // Keep smoke export test fast — real jobs are covered by /api/export/jobs.
          NEXT_PUBLIC_EXPORT_MOCK: "1",
        },
      },
});
