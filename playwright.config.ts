import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const revision = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

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
    env: { VITE_FIREBASE_EMULATORS: 'true', VITE_RELEASE_REVISION: revision },
  },
});
