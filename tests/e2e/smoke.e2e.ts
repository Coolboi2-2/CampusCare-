import { test, expect, Page } from '@playwright/test';

/**
 * Smoke coverage for the CampusCare shell and the three portals.
 * Kept resilient: asserts roles/visibility, not exact copy.
 */

type PortalRole = 'student' | 'technician' | 'admin';

const PORTAL_NAMES: Record<PortalRole, { desktop: RegExp; mobile: string }> = {
  student: { desktop: /student portal/i, mobile: 'Student' },
  technician: { desktop: /maintenance portal/i, mobile: 'Maintenance' },
  admin: { desktop: /admin \/ warden/i, mobile: 'Admin / Warden' },
};

async function openPortal(page: Page, role: PortalRole) {
  const desktopNav = page.locator('nav[aria-label="Portal navigation"]');
  if (await desktopNav.isVisible()) {
    await desktopNav.getByRole('button', { name: PORTAL_NAMES[role].desktop }).click();
  } else {
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    await page
      .locator('#mobile-menu')
      .getByRole('button', { name: PORTAL_NAMES[role].mobile, exact: true })
      .click();
  }
}

test('shell renders the brand and a level-1 heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('CampusCare', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('tagline is shown on wide viewports', async ({ page, isMobile }) => {
  test.skip(isMobile, 'tagline is intentionally hidden on narrow screens');
  await page.goto('/');
  await expect(page.getByText(/Report it\. Route it\. Resolve it\. Verify it\./)).toBeVisible();
});

test('every portal is reachable from the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  for (const role of ['technician', 'admin', 'student'] as PortalRole[]) {
    await openPortal(page, role);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('report dialog opens and closes without losing the page', async ({ page }) => {
  await page.goto('/');
  await page.locator('header').getByRole('button', { name: /report/i }).first().click();

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
