import { test, expect, Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The dedicated admin sign-in experience, exercised in the browser on desktop,
 * tablet and mobile. Credentials come from `.env`; nothing is hardcoded.
 */

function envValue(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim() : '';
}

const ADMIN_EMAIL = envValue('ADMIN_EMAIL');
const ADMIN_PASSWORD = envValue('ADMIN_PASSWORD');

test.beforeAll(() => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to run the auth UI suite.');
  }
});

/** Reach the staff sign-in from the header (works on every viewport). */
async function openAdminPortal(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /staff sign in/i }).click();
  await expect(page.getByRole('heading', { name: /admin \/ warden sign-in/i })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('button', { name: /^sign out$/i }).click();
}

test.describe('admin sign-in UI', () => {
  test('shows a dedicated admin sign-in and rejects a bad password', async ({ page }) => {
    await openAdminPortal(page);

    await page.getByLabel('Institutional email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  });

  test('a valid admin signs in to the command centre and can sign out', async ({ page }) => {
    await openAdminPortal(page);
    await page.getByLabel('Institutional email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByRole('heading', { name: /maintenance operations/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent administrative activity/i })).toBeVisible();

    await signOut(page);

    // Signing out returns to the public shell; the admin area asks for credentials again.
    await openAdminPortal(page);
  });
});
