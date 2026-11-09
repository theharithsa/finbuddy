import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 10_000,
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.FINBUDDY_BROWSER_CHANNEL,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { VITE_FIREBASE_EMULATORS: 'true', VITE_RELEASE_REVISION: 'local' },
  },
});
