import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: process.env.ASCN_TEST_URL || "http://127.0.0.1:4187",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: process.env.ASCN_TEST_URL ? undefined : {
    command: "npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port 4187 --compatibility-date=2026-06-20",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
