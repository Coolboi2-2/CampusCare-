import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashPassword, verifyPassword } from '../passwords';
import { SessionStore } from '../sessions';
import { UserStore, toPublicUser } from '../users';
import { can, permissionsFor } from '../rbac';
import { RateLimiter } from '../rateLimit';

afterEach(() => {
  vi.useRealTimers();
});

describe('password hashing (scrypt)', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('never stores the plaintext and salts each hash', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toContain('same-password');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$only-two')).toBe(false);
  });
});

describe('SessionStore: server-side sessions with idle + absolute expiry', () => {
  it('creates an opaque id and CSRF token and resolves it', () => {
    const store = new SessionStore();
    const session = store.create({ id: 'u1', name: 'Warden', email: 'w@c.edu', role: 'admin' });
    expect(session.id).toHaveLength(64);
    expect(session.csrfToken).toHaveLength(64);
    expect(store.get(session.id)?.user.email).toBe('w@c.edu');
  });

  it('destroys a session on logout', () => {
    const store = new SessionStore();
    const session = store.create({ id: 'u1', name: 'Warden', email: 'w@c.edu', role: 'admin' });
    store.destroy(session.id);
    expect(store.get(session.id)).toBeNull();
  });

  it('expires after the idle window and refreshes on activity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = new SessionStore();
    const session = store.create({ id: 'u1', name: 'Warden', email: 'w@c.edu', role: 'admin' });

    vi.advanceTimersByTime(25 * 60 * 1000);
    expect(store.get(session.id)).not.toBeNull(); // refreshed

    vi.advanceTimersByTime(25 * 60 * 1000);
    expect(store.get(session.id)).not.toBeNull(); // would be dead without refresh

    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(store.get(session.id)).toBeNull(); // idle timeout
  });

  it('enforces a constant-time CSRF comparison', () => {
    const store = new SessionStore();
    const session = store.create({ id: 'u1', name: 'Warden', email: 'w@c.edu', role: 'admin' });
    expect(store.csrfMatches(session, session.csrfToken)).toBe(true);
    expect(store.csrfMatches(session, 'wrong')).toBe(false);
    expect(store.csrfMatches(session, undefined)).toBe(false);
  });
});

describe('UserStore: env-seeded staff accounts', () => {
  it('hashes credentials and verifies them without exposing the hash', () => {
    const store = new UserStore();
    store.addFromEnv({
      id: 'staff-admin-1',
      name: 'Warden',
      email: 'warden@campus.edu',
      role: 'admin',
      password: 'CampusCare-Demo-2026!',
    });
    expect(store.verifyCredentials('warden@campus.edu', 'CampusCare-Demo-2026!')).not.toBeNull();
    expect(store.verifyCredentials('warden@campus.edu', 'nope')).toBeNull();
    expect(store.verifyCredentials('ghost@campus.edu', 'nope')).toBeNull();

    const publicUser = toPublicUser(store.findByEmail('warden@campus.edu')!);
    expect(publicUser).not.toHaveProperty('passwordHash');
  });
});

describe('RBAC permission matrix (least privilege)', () => {
  it('grants administrators every permission', () => {
    expect(can('admin', 'assign:workorder')).toBe(true);
    expect(can('admin', 'change:role')).toBe(true);
    expect(can('admin', 'view:admin')).toBe(true);
  });

  it('grants technicians only field-work permissions', () => {
    expect(can('technician', 'start:work')).toBe(true);
    expect(can('technician', 'submit:repair')).toBe(true);
    expect(can('technician', 'assign:workorder')).toBe(false);
    expect(can('technician', 'change:role')).toBe(false);
    expect(can('technician', 'view:admin')).toBe(false);
  });

  it('grants students no staff permissions', () => {
    expect(permissionsFor('student')).toHaveLength(0);
  });
});

describe('RateLimiter: sliding window', () => {
  it('blocks after the limit and reports retry-after', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    const blocked = limiter.check('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('recovers after the window and on reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.check('k').allowed).toBe(true);
    limiter.reset('k');
    expect(limiter.check('k').allowed).toBe(true);
  });
});
