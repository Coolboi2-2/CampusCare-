import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { extractMetadata, isSuspiciousSoftware } from '../metadata';

async function plainJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 120, g: 130, b: 140 } } })
    .jpeg()
    .toBuffer();
}

describe('Evidence metadata signals', () => {
  it('SC-08: recognises generation/editing software tags', () => {
    expect(isSuspiciousSoftware('Adobe Photoshop 25.0')).toBe('photoshop');
    expect(isSuspiciousSoftware('Midjourney v6')).toBe('midjourney');
    expect(isSuspiciousSoftware('Stable Diffusion XL')).toBe('stable diffusion');
    expect(isSuspiciousSoftware('Canon EOS R6')).toBeUndefined();
    expect(isSuspiciousSoftware(undefined)).toBeUndefined();
  });

  it('SC-07: a plain image has no camera metadata (weak signal, not a verdict)', async () => {
    const signals = await extractMetadata(await plainJpeg(), { format: 'jpeg', width: 32, height: 24 });

    expect(signals.hasCameraMetadata).toBe(false);
    expect(signals.softwareSuspicious).toBeUndefined();
    expect(signals.format).toBe('jpeg');
    expect(signals.width).toBe(32);
    expect(signals.height).toBe(24);
  });

  it('does not throw on malformed bytes', async () => {
    const signals = await extractMetadata(Buffer.from('not an image'), {
      format: 'jpeg',
      width: 1,
      height: 1,
    });
    expect(signals.hasCameraMetadata).toBe(false);
  });
});
