import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 360, height: 800 },
    launchOptions: existsSync(localChrome) ? { executablePath: localChrome } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-preview.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
