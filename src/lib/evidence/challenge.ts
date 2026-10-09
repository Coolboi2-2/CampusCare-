import { randomUUID, randomInt } from 'node:crypto';

// Ambiguous glyphs (0/O, 1/I/L) removed so a photographed handwritten code is
// less likely to be misread by the model or a human.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface ChallengeRecord {
  id: string;
  ticketId: string;
  actor: string;
  actorRole: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export type ChallengeState = 'valid' | 'unknown' | 'expired' | 'used' | 'mismatch';

export const DEFAULT_CHALLENGE_TTL_MS = 15 * 60 * 1000;

/**
 * Server-issued, single-use, per-session challenge. The submission flow never
 * accepts a client-generated code as proof.
 */
export class ChallengeStore {
  private map = new Map<string, ChallengeRecord>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_CHALLENGE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  issue(input: { ticketId: string; actor: string; actorRole: string }): ChallengeRecord {
    const code = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    const now = Date.now();
    const record: ChallengeRecord = {
      id: `ch-${randomUUID()}`,
      ticketId: input.ticketId,
      actor: input.actor,
      actorRole: input.actorRole,
      code,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
    };
    this.map.set(record.id, record);
    return record;
  }

  get(id: string): ChallengeRecord | undefined {
    return this.map.get(id);
  }

  /**
   * Validate the challenge's own state (existence, ticket binding, expiry,
   * single use). Code matching is done against the model's structured result
   * by the caller, not here.
   */
  validate(id: string, ticketId: string, now: number = Date.now()): { state: ChallengeState; record?: ChallengeRecord } {
    const record = this.map.get(id);
    if (!record) return { state: 'unknown' };
    if (record.ticketId !== ticketId) return { state: 'unknown', record };
    if (record.usedAt) return { state: 'used', record };
    if (new Date(record.expiresAt).getTime() < now) return { state: 'expired', record };
    return { state: 'valid', record };
  }

  markUsed(id: string): void {
    const record = this.map.get(id);
    if (record && !record.usedAt) record.usedAt = new Date().toISOString();
  }

  reset(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
