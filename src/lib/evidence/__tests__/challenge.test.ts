import { describe, it, expect } from 'vitest';
import { ChallengeStore } from '../challenge';

describe('ChallengeStore: server-issued, single-use, expiring', () => {
  it('issues an unambiguous code bound to a ticket', () => {
    const store = new ChallengeStore();
    const rec = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });

    expect(rec.code).toHaveLength(6);
    expect(rec.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/); // no 0/O/1/I/L
    expect(new Date(rec.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(store.validate(rec.id, 'T-1').state).toBe('valid');
  });

  it('SC-10: an unknown challenge is rejected', () => {
    const store = new ChallengeStore();
    expect(store.validate('ch-does-not-exist', 'T-1').state).toBe('unknown');
  });

  it('SC-10: a challenge cannot be used on a different ticket', () => {
    const store = new ChallengeStore();
    const rec = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });
    expect(store.validate(rec.id, 'T-2').state).toBe('unknown');
  });

  it('SC-10: an expired challenge is rejected', () => {
    const store = new ChallengeStore(1); // 1ms TTL
    const rec = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });
    expect(store.validate(rec.id, 'T-1', Date.now() + 10).state).toBe('expired');
  });

  it('SC-10: a used challenge cannot be reused', () => {
    const store = new ChallengeStore();
    const rec = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });
    store.markUsed(rec.id);
    expect(store.validate(rec.id, 'T-1').state).toBe('used');
  });

  it('issues distinct codes/ids', () => {
    const store = new ChallengeStore();
    const a = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });
    const b = store.issue({ ticketId: 'T-1', actor: 'Tess', actorRole: 'technician' });
    expect(a.id).not.toBe(b.id);
  });
});
