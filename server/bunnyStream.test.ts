import { describe, it, expect } from 'vitest';

const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;

describe('Bunny Stream API', () => {
  it('should have valid credentials configured', () => {
    expect(BUNNY_STREAM_API_KEY).toBeDefined();
    expect(BUNNY_STREAM_API_KEY).not.toBe('');
    expect(BUNNY_STREAM_LIBRARY_ID).toBeDefined();
    expect(BUNNY_STREAM_LIBRARY_ID).not.toBe('');
  });

  // Bunny側の権限/アカウント問題で401が返される（2026-02-09時点）
  // Bunnyサポートに問い合わせ中。解決後にit.skipをitに戻す
  it.skip('should be able to list videos from Bunny Stream', async () => {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos?page=1&itemsPerPage=1`,
      {
        method: 'GET',
        headers: {
          'AccessKey': BUNNY_STREAM_API_KEY!,
          'Accept': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('totalItems');
  });
});
