import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Server-side session store. Sessions live only on the server; the browser
 * holds an opaque, httpOnly session id. CSRF tokens are compared with a
 * constant-time check.
 */
export type StaffRole = 'admin' | 'technician';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  department?: string;
}

export interface Session {
  id: string;
  csrfToken: string;
  user: SessionUser;
  createdAt: number;
  expiresAt: number;
}

/** Idle window; refreshed on activity. Absolute lifetime caps total session age. */
const IDLE_TTL_MS = 30 * 60 * 1000;
const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

interface StoredSession {
  user: SessionUser;
  createdAt: number;
  expiresAt: number;
  csrfToken: string;
}

export class SessionStore {
  private sessions = new Map<string, StoredSession>();

  get idleTtlMs(): number {
    return IDLE_TTL_MS;
  }

  create(user: SessionUser): Session {
    const now = Date.now();
    const id = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = now + IDLE_TTL_MS;
    this.sessions.set(id, { user, createdAt: now, expiresAt, csrfToken });
    return { id, csrfToken, user, createdAt: now, expiresAt };
  }

  /** Returns the session if valid; refreshes the idle window. Expired sessions are dropped. */
  get(id: string): Session | null {
    const stored = this.sessions.get(id);
    if (!stored) return null;
    const now = Date.now();
    if (now >= stored.expiresAt || now - stored.createdAt >= ABSOLUTE_TTL_MS) {
      this.sessions.delete(id);
      return null;
    }
    stored.expiresAt = Math.min(now + IDLE_TTL_MS, stored.createdAt + ABSOLUTE_TTL_MS);
    return { id, csrfToken: stored.csrfToken, user: stored.user, createdAt: stored.createdAt, expiresAt: stored.expiresAt };
  }

  destroy(id: string): void {
    this.sessions.delete(id);
  }

  destroyAllForUser(userId: string): number {
    let removed = 0;
    for (const [id, s] of this.sessions) {
      if (s.user.id === userId) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  csrfMatches(session: Session, token: string | undefined): boolean {
    if (!token) return false;
    const provided = Buffer.from(token);
    const expected = Buffer.from(session.csrfToken);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
}
