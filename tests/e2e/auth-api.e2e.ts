import { test, expect, APIRequestContext } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * API-level authentication, session and server-side RBAC coverage.
 * Runs serial and desktop-only (configured in playwright.config.ts) because the
 * demo backend keeps all state in memory and these cases share ticket state.
 * Staff credentials are read from `.env`; nothing is hardcoded in source.
 */
test.describe.configure({ mode: 'serial' });

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
const TECH_EMAIL = envValue('TECHNICIAN_EMAIL');
const TECH_PASSWORD = envValue('TECHNICIAN_PASSWORD');

test.beforeAll(() => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to run the auth suite.');
  }
});

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status(), `login as ${email}`).toBe(200);
  return (await res.json()).csrfToken as string;
}

const ADMIN_ROUTES = ['/api/analytics', '/api/admin/audit', '/api/admin/users'];

test.describe('unauthenticated and low-privilege access', () => {
  test('1. unauthenticated requests to admin routes are rejected', async ({ request }) => {
    for (const route of ADMIN_ROUTES) {
      expect((await request.get(route)).status(), route).toBe(401);
    }
    expect((await request.post('/api/demo/reset')).status()).toBe(401);
  });

  test('2. a student actor cannot reach admin endpoints', async ({ request }) => {
    for (const route of ADMIN_ROUTES) {
      const res = await request.get(route, { headers: { 'x-actor-role': 'student' } });
      expect(res.status(), route).toBe(401);
    }
  });

  test('3. a technician session cannot perform admin-only operations', async ({ request }) => {
    test.skip(!TECH_PASSWORD, 'technician credentials not configured');
    const csrf = await apiLogin(request, TECH_EMAIL, TECH_PASSWORD);
    for (const route of ADMIN_ROUTES) {
      expect((await request.get(route)).status(), route).toBe(403);
    }
    const assign = await request.put('/api/tickets/CC-2026-1042/assign', {
      data: { department: 'HVAC' },
      headers: { 'x-csrf-token': csrf },
    });
    expect(assign.status()).toBe(403);
    const roleChange = await request.put('/api/admin/users/staff-admin-1/role', {
      data: { role: 'technician' },
      headers: { 'x-csrf-token': csrf },
    });
    expect(roleChange.status()).toBe(403);
  });
});

test.describe('authorized administrator', () => {
  test('4. an admin session can read protected admin data', async ({ request }) => {
    await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const route of ADMIN_ROUTES) {
      expect((await request.get(route)).status(), route).toBe(200);
    }
  });

  test('5. logout invalidates the session', async ({ request }) => {
    const csrf = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    expect((await request.get('/api/auth/session')).status()).toBe(200);
    expect((await request.post('/api/auth/logout', { headers: { 'x-csrf-token': csrf } })).status()).toBe(204);
    expect((await request.get('/api/auth/session')).status()).toBe(401);
    expect((await request.get('/api/analytics')).status()).toBe(401);
  });

  test('9. privileged actions are recorded in the audit log', async ({ request }) => {
    const csrf = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const assign = await request.put('/api/tickets/CC-2026-1042/assign', {
      data: { department: 'Plumbing' },
      headers: { 'x-csrf-token': csrf },
    });
    expect(assign.status()).toBe(200);

    const audit = await request.get('/api/admin/audit?limit=50');
    expect(audit.status()).toBe(200);
    const events = (await audit.json()) as { action: string; actor: string }[];
    expect(events.some((e) => e.action === 'login_success' && e.actor === ADMIN_EMAIL)).toBe(true);
    expect(events.some((e) => e.action === 'work_order_assigned' && e.actor === ADMIN_EMAIL)).toBe(true);
  });
});

test.describe('attack surface', () => {
  test('6. client-supplied admin roles do not grant admin access', async ({ request }) => {
    expect((await request.get('/api/analytics', { headers: { 'x-actor-role': 'admin' } })).status()).toBe(401);
    const assign = await request.put('/api/tickets/CC-2026-1042/assign', {
      data: { department: 'Electrical', actorName: 'Mallory', actorRole: 'admin' },
      headers: { 'x-actor-role': 'admin' },
    });
    expect(assign.status()).toBe(401);
  });

  test('7. unauthorized work-order reassignment is rejected', async ({ request }) => {
    const anon = await request.put('/api/tickets/CC-2026-1042/assign', {
      data: { department: 'Electrical' },
      headers: { 'x-actor-role': 'admin' },
    });
    expect(anon.status()).toBe(401);

    if (TECH_PASSWORD) {
      const csrf = await apiLogin(request, TECH_EMAIL, TECH_PASSWORD);
      const tech = await request.put('/api/tickets/CC-2026-1042/assign', {
        data: { department: 'Electrical' },
        headers: { 'x-csrf-token': csrf },
      });
      expect(tech.status()).toBe(403);
    }
  });

  test('8. unauthorized resolution overrides are rejected', async ({ request }) => {
    // CC-2026-1039 is safety-critical and AI-flagged for human review.
    const anon = await request.put('/api/tickets/CC-2026-1039/resolve', {
      data: { confirmedBy: 'Mallory', rating: 5 },
      headers: { 'x-actor-role': 'admin' },
    });
    expect(anon.status()).toBe(403);
  });

  test('admin mutations require a CSRF token', async ({ request }) => {
    await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const noCsrf = await request.put('/api/tickets/CC-2026-1042/assign', {
      data: { department: 'General' },
    });
    expect(noCsrf.status()).toBe(403);
  });
});

test.describe('existing workflows after authentication', () => {
  test('10. public ticket reads and demo technician flow still work', async ({ request }) => {
    const list = await request.get('/api/tickets');
    expect(list.status()).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    // A demo technician (no session) may still start field work.
    const start = await request.put('/api/tickets/CC-2026-1042/status', {
      data: { status: 'in_progress', actor: 'Marcus Vance', role: 'technician' },
    });
    expect(start.status()).toBe(200);

    // …but an anonymous actor cannot request a repair challenge as admin.
    const challenge = await request.post('/api/tickets/CC-2026-1042/repair/challenge', {
      data: { role: 'admin' },
    });
    expect(challenge.status()).toBe(403);
  });
});
