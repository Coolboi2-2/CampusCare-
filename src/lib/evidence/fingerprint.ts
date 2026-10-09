import sharp from 'sharp';
import { createHash } from 'node:crypto';

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface ImageInfo {
  format: string;
  width: number;
  height: number;
}

/**
 * Decode the image to prove it is a real, supported image (not just a
 * filename/extension/MIME claim) and read its true dimensions.
 * Throws for malformed or unsupported bytes.
 */
export async function readImageInfo(bytes: Buffer): Promise<ImageInfo> {
  if (bytes.length === 0) throw new Error('Empty image file');
  const meta = await sharp(bytes).metadata();
  if (!meta.format || !meta.width || !meta.height) {
    throw new Error('Unsupported or corrupt image file');
  }
  return { format: meta.format, width: meta.width, height: meta.height };
}

/**
 * 64-bit difference hash (dHash) over a normalized 9x8 grayscale bitmap.
 * Survives re-encoding, resizing, and minor brightness/contrast changes.
 * The mirrored variant catches horizontal flips.
 */
export async function differenceHash(bytes: Buffer, mirror = false): Promise<string> {
  let pipeline = sharp(bytes).greyscale();
  if (mirror) pipeline = pipeline.flop();
  const raw = await pipeline.resize(9, 8, { fit: 'fill' }).raw().toBuffer();

  let hex = '';
  for (let y = 0; y < 8; y++) {
    let nibbleBits = '';
    for (let x = 0; x < 8; x++) {
      nibbleBits += raw[y * 9 + x] > raw[y * 9 + x + 1] ? '1' : '0';
      if (nibbleBits.length === 4) {
        hex += parseInt(nibbleBits, 2).toString(16);
        nibbleBits = '';
      }
    }
  }
  return hex;
}

export function hammingDistanceHex(a: string, b: string): number {
  let distance = Math.abs(a.length - b.length) * 4;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Best (lowest) distance across normal and mirrored hashes. */
export function perceptualDistance(
  a: Pick<{ dHash: string | null; dHashMirrored: string | null }, 'dHash' | 'dHashMirrored'>,
  b: Pick<{ dHash: string | null; dHashMirrored: string | null }, 'dHash' | 'dHashMirrored'>
): number | null {
  if (!a.dHash || !b.dHash) return null;
  let best = hammingDistanceHex(a.dHash, b.dHash);
  // A horizontally flipped copy hashes like the mirror of the original, so
  // compare across the normal/mirrored pairs too.
  if (a.dHashMirrored) best = Math.min(best, hammingDistanceHex(a.dHashMirrored, b.dHash));
  if (b.dHashMirrored) best = Math.min(best, hammingDistanceHex(a.dHash, b.dHashMirrored));
  return best;
}

/**
 * Perceptual-duplicate threshold on a 64-bit dHash. Re-encoded/resized copies
 * land under ~4; unrelated images are typically 20+. Tuned conservatively so a
 * flag means "review", not "condemned".
 */
export const PERCEPTUAL_DUPLICATE_THRESHOLD = 6;
