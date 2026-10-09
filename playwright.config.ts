import { defineConfig, devices } from '@playwright/test';

/**
 * Browser flow tests for the CampusCare SPA.
 * `bun run dev` serves both the Express API and the Vite frontend on one port.
 * Files use the `.e2e.ts` suffix so Vitest (`bun run test`) ignores them.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'off',
  },
  webServer: {
    command: 'PORT=3100 bun run dev',
    url: 'http://127.0.0.1:3100/api/tickets',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // The API/RBAC suite shares in-memory demo state, so it runs once (desktop).
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      testIgnore: '**/auth-api.e2e.ts',
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
      testIgnore: '**/auth-api.e2e.ts',
    },
  ],
});
