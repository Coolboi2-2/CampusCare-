import { test, expect, Page } from '@playwright/test';

/**
 * Smoke coverage for the CampusCare shell and the student entry point.
 * Kept resilient: asserts roles/visibility, not exact copy.
 */

async function visibleCount(page: Page, name: RegExp): Promise<number> {
  const loc = page.getByRole('button', { name });
  let visible = 0;
  for (let i = 0; i < (await loc.count()); i++) {
    if (await loc.nth(i).isVisible()) visible++;
  }
  return visible;
}

test('shell renders the brand and a level-1 heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('CampusCare', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the student view shows exactly one report action per viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await visibleCount(page, /report an issue/i)).toBe(1);
});

test('students do not see staff navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /maintenance portal/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /admin \/ warden/i })).toHaveCount(0);
  // No demo student account and no notification bell on the public view.
  await expect(page.getByRole('button', { name: /account menu/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /notifications/i })).toHaveCount(0);
  await expect(page.getByText('Aarav Patel')).toHaveCount(0);
});

test('staff sign-in is reachable from the header', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /staff sign in/i }).click();
  await expect(page.getByRole('heading', { name: /admin \/ warden sign-in/i })).toBeVisible();

  await page.getByRole('button', { name: /back to student view/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('report dialog opens and closes without losing the page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /report an issue/i }).filter({ visible: true }).first().click();

  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /close/i }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('no horizontal overflow on the loaded portal', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
