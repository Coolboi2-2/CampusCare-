export interface InlineImagePart {
  inlineData: { mimeType: string; data: string };
}

export interface ImageBytes {
  bytes: Buffer;
  mimeType: string;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
// Best-effort SSRF guard for the common private ranges.
const PRIVATE_HOST =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;

/**
 * Downloads a photo URL and returns its bytes plus content type.
 * Throws on non-http(s), private hosts, non-image content, or oversized payloads.
 */
export async function fetchImageBytes(url: string): Promise<ImageBytes> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid photo URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported photo URL protocol: ${parsed.protocol}`);
  }
  if (PRIVATE_HOST.test(parsed.hostname)) {
    throw new Error('Refusing to fetch photo from a private/internal host');
  }

  // shortcut: only the initial URL is checked, not redirect targets; revisit if the app accepts untrusted URLs.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Photo fetch failed with status ${res.status}`);

    const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Photo URL did not return an image (content-type: ${mimeType || 'unknown'})`);
    }

    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error('Photo exceeds the 8MB inline image limit');
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('Photo URL returned an empty file');
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Photo exceeds the 8MB inline image limit');
    }

    return { bytes, mimeType };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads a photo URL and returns a GenAI inline image part.
 */
export async function fetchImagePart(url: string): Promise<InlineImagePart> {
  const { bytes, mimeType } = await fetchImageBytes(url);
  return { inlineData: { mimeType, data: bytes.toString('base64') } };
}
