import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { EvidenceStore } from '../store';
import { perceptualDistance, PERCEPTUAL_DUPLICATE_THRESHOLD } from '../fingerprint';

const actor = { name: 'Tess Tech', role: 'technician' };

function tempStore(): EvidenceStore {
  return new EvidenceStore(fs.mkdtempSync(path.join(os.tmpdir(), 'campuscare-ev-')));
}

/** Deterministic grayscale image so hashes are stable across runs. */
async function image(w: number, h: number, fn: (x: number, y: number) => number): Promise<Buffer> {
  const channels = 3;
  const buf = Buffer.alloc(w * h * channels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const v = ((fn(x, y) % 256) + 256) % 256;
      buf[i] = buf[i + 1] = buf[i + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels } }).jpeg({ quality: 90 }).toBuffer();
}

const diagonal = (x: number, y: number) => x * 4 + y * 2;
const noise = (x: number, y: number) => x * 2654435761 + y * 40503;

describe('EvidenceStore: ingestion & duplicate/reuse detection', () => {
  it('SC-19: rejects non-image bytes instead of trusting name/MIME', async () => {
    const store = tempStore();
    await expect(
      store.ingestBytes('T1', 'after', Buffer.from('plain text pretending to be a jpg'), actor)
    ).rejects.toThrow();
  });

  it('SC-19: rejects oversized uploads safely', async () => {
    const store = tempStore();
    await expect(
      store.ingestBytes('T1', 'after', Buffer.alloc(9 * 1024 * 1024, 0), actor)
    ).rejects.toThrow(/8MB/);
  });

  it('SC-02/03: identical bytes from different tickets are an exact cross-ticket reuse', async () => {
    const store = tempStore();
    const bytes = await image(64, 48, diagonal);
    const a = await store.ingestBytes('T-A', 'after', bytes, actor);
    const b = await store.ingestBytes('T-B', 'after', bytes, actor);

    expect(a.sha256).toBe(b.sha256);
    const matches = store.findReuse(b);
    expect(matches.some((m) => m.type === 'exact' && m.ticketId === 'T-A')).toBe(true);
  });

  it('SC-04/05: resize, re-encode, brightness and flip are perceptual duplicates', async () => {
    const store = tempStore();
    const original = await image(80, 60, diagonal);
    const resized = await sharp(original).resize(40, 30).jpeg({ quality: 60 }).toBuffer();
    const brighter = await sharp(original).modulate({ brightness: 1.15 }).jpeg({ quality: 80 }).toBuffer();
    const flipped = await sharp(original).flop().jpeg({ quality: 80 }).toBuffer();

    const src = await store.ingestBytes('T-A', 'after', original, actor);
    const re = await store.ingestBytes('T-B', 'after', resized, actor);
    const br = await store.ingestBytes('T-C', 'after', brighter, actor);
    const fl = await store.ingestBytes('T-D', 'after', flipped, actor);

    expect(perceptualDistance(src, re)!).toBeLessThanOrEqual(PERCEPTUAL_DUPLICATE_THRESHOLD);
    expect(perceptualDistance(src, br)!).toBeLessThanOrEqual(PERCEPTUAL_DUPLICATE_THRESHOLD);
    expect(perceptualDistance(src, fl)!).toBeLessThanOrEqual(PERCEPTUAL_DUPLICATE_THRESHOLD);
    expect(store.findReuse(re).some((m) => m.type === 'perceptual')).toBe(true);
  });

  it('SC-06: two genuinely different photos are not flagged as duplicates', async () => {
    const store = tempStore();
    const a = await store.ingestBytes('T-A', 'after', await image(80, 60, diagonal), actor);
    const b = await store.ingestBytes('T-B', 'after', await image(80, 60, noise), actor);

    expect(perceptualDistance(a, b)!).toBeGreaterThan(PERCEPTUAL_DUPLICATE_THRESHOLD);
    expect(store.findReuse(b).some((m) => m.type === 'perceptual')).toBe(false);
  });

  it('SC-14: preserved bytes are immutable even if the caller mutates its source buffer', async () => {
    const store = tempStore();
    const bytes = await image(40, 30, diagonal);
    const rec = await store.ingestBytes('T-A', 'after', bytes, actor);

    bytes.fill(0);

    const stored = store.getBytes(rec.id)!;
    expect(stored.equals(bytes)).toBe(false);
    expect(stored.length).toBe(rec.bytes);
    expect(stored.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // still a JPEG
  });
});
