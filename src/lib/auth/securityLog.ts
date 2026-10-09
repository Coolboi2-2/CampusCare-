import { randomBytes } from 'node:crypto';
import type { UserRole } from '../../types';

/**
 * Append-only, in-memory log of security-sensitive administrative actions.
 * Never records passwords, session tokens or CSRF tokens.
 */
export interface SecurityEvent {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole | 'anonymous';
  action: string;
  detail?: string;
  ip?: string;
}

export class SecurityAuditLog {
  private events: SecurityEvent[] = [];

  constructor(private readonly max = 500) {}

  record(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
    const stored: SecurityEvent = {
      id: `sec-${randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.events.unshift(stored);
    if (this.events.length > this.max) this.events.length = this.max;
    return stored;
  }

  list(limit = 50): SecurityEvent[] {
    return this.events.slice(0, Math.max(0, limit));
  }

  reset(): void {
    this.events = [];
  }
}
