import exifr from 'exifr';
import type { MetadataSignals } from './types';

/**
 * Tokens that indicate the image was produced or post-processed by generative
 * or editor software. Presence is a review signal, never proof of fraud —
 * cameras legitimately write nothing here and editors can be used honestly.
 */
export const SUSPICIOUS_SOFTWARE_TOKENS = [
  'midjourney',
  'dall-e',
  'dall·e',
  'dali',
  'firefly',
  'stable diffusion',
  'stablediffusion',
  'sdxl',
  'comfyui',
  'automatic1111',
  'invokeai',
  'generative',
  'img2img',
  'photoshop',
  'gimp',
  'pixelmator',
  'affinity photo',
];

export function isSuspiciousSoftware(software?: string | null): string | undefined {
  if (!software) return undefined;
  const lower = software.toLowerCase();
  return SUSPICIOUS_SOFTWARE_TOKENS.find((token) => lower.includes(token));
}

/**
 * Extract provenance-ish metadata. All of it is spoofable, so it only ever
 * contributes supporting signals (handled in riskPolicy.ts).
 */
export async function extractMetadata(
  bytes: Buffer,
  info: { format: string; width: number; height: number }
): Promise<MetadataSignals> {
  const base: MetadataSignals = {
    hasCameraMetadata: false,
    format: info.format,
    width: info.width,
    height: info.height,
  };

  let parsed: any = null;
  try {
    parsed = await exifr.parse(bytes, { tiff: true, exif: true, gps: true });
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') return base;

  const make = parsed.Make;
  const model = parsed.Model;
  const software = parsed.Software || parsed.ProcessingSoftware;
  const hasExposure = Boolean(
    parsed.ExposureTime || parsed.FNumber || parsed.ISO || parsed.LensModel
  );

  base.hasCameraMetadata = Boolean(make || model || hasExposure || parsed.LensModel);
  if (typeof software === 'string') base.software = software;
  base.softwareSuspicious = isSuspiciousSoftware(software);

  const captured = parsed.DateTimeOriginal || parsed.CreateDate;
  if (captured instanceof Date && !Number.isNaN(captured.getTime())) {
    base.capturedAt = captured.toISOString();
  }

  if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
    base.gps = { lat: parsed.latitude, lng: parsed.longitude };
  }

  return base;
}
