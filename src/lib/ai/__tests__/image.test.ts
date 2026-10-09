import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchImagePart } from '../image';

afterEach(() => vi.unstubAllGlobals());

describe('CampusCare AI: photo fetch -> inline image part', () => {
  it('IMG-01: returns base64 inlineData for a valid image response', async () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }))
    );

    const part = await fetchImagePart('https://example.com/before.jpg');

    expect(part.inlineData.mimeType).toBe('image/jpeg');
    expect(part.inlineData.data).toBe(bytes.toString('base64'));
  });

  it('IMG-02: rejects responses that are not images', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 200, headers: { 'content-type': 'text/html' } }))
    );

    await expect(fetchImagePart('https://example.com/not-an-image')).rejects.toThrow(
      /did not return an image/
    );
  });

  it('IMG-03: refuses private/internal hosts', async () => {
    await expect(fetchImagePart('http://127.0.0.1/secret.jpg')).rejects.toThrow(/private\/internal/);
  });
});
