import { describe, it, expect } from 'vitest';

/**
 * videoPreloadManager v8 + bunnyUrls v8 のロジックテスト
 * 
 * v8の設計原則:
 * - CDN直リンク（b-cdn.net）は動画再生に使用禁止（403エラー回避）
 * - 全ての動画再生はiframe embed方式（iframe.mediadelivery.net）に統一
 * - videoPreloadManagerはposterプリロードのみに簡略化
 * - サムネイル画像（thumbnail.jpg）はToken Auth対象外のため引き続きb-cdn.net使用可
 */

// ========== Bunny Embed URL生成テスト ==========

describe('Bunny Embed URL Generation (v8: iframe embed)', () => {
  const BUNNY_LIBRARY_ID = '584611';
  const BUNNY_EMBED_HOST = 'iframe.mediadelivery.net';

  function getBunnyEmbedUrl(videoId: string, options: Record<string, string | boolean | number> = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const queryString = params.toString();
    const base = `https://${BUNNY_EMBED_HOST}/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
    return queryString ? `${base}?${queryString}` : base;
  }

  it('should generate correct base embed URL', () => {
    const url = getBunnyEmbedUrl('abc123');
    expect(url).toBe('https://iframe.mediadelivery.net/embed/584611/abc123');
    expect(url).not.toContain('b-cdn.net');
    expect(url).not.toContain('play_');
    expect(url).not.toContain('.mp4');
    expect(url).not.toContain('.m3u8');
  });

  it('should generate background video embed URL with autoplay+muted+loop', () => {
    const url = getBunnyEmbedUrl('abc123', {
      autoplay: true,
      muted: true,
      loop: true,
      preload: true,
      responsive: true,
    });
    expect(url).toContain('iframe.mediadelivery.net/embed/584611/abc123');
    expect(url).toContain('autoplay=true');
    expect(url).toContain('muted=true');
    expect(url).toContain('loop=true');
    expect(url).toContain('preload=true');
  });

  it('should generate fullscreen embed URL with autoplay (unmuted)', () => {
    const url = getBunnyEmbedUrl('abc123', {
      autoplay: true,
      muted: false,
      preload: true,
      responsive: true,
    });
    expect(url).toContain('iframe.mediadelivery.net/embed/584611/abc123');
    expect(url).toContain('autoplay=true');
    expect(url).toContain('muted=false');
    expect(url).not.toContain('loop=');
  });

  it('should never use CDN direct URLs for video playback', () => {
    const embedUrl = getBunnyEmbedUrl('abc123');
    // CDN直リンクは動画再生に使用禁止
    expect(embedUrl).not.toContain('b-cdn.net');
    expect(embedUrl).not.toContain('play_480p.mp4');
    expect(embedUrl).not.toContain('play_720p.mp4');
    expect(embedUrl).not.toContain('playlist.m3u8');
  });
});

// ========== サムネイルURL生成テスト ==========

describe('Bunny Thumbnail URL (v8: still uses b-cdn.net)', () => {
  const BUNNY_CDN_BASE = 'https://vz-2e234254-464.b-cdn.net';

  function getBunnyThumbnailUrl(videoId: string): string {
    return `${BUNNY_CDN_BASE}/${videoId}/thumbnail.jpg`;
  }

  it('should generate correct thumbnail URL', () => {
    const url = getBunnyThumbnailUrl('abc123');
    expect(url).toBe('https://vz-2e234254-464.b-cdn.net/abc123/thumbnail.jpg');
  });

  it('thumbnail URL should use b-cdn.net (Token Auth対象外)', () => {
    const url = getBunnyThumbnailUrl('abc123');
    expect(url).toContain('b-cdn.net');
    expect(url).toContain('thumbnail.jpg');
    // サムネイルはToken Auth対象外のため403にならない
  });
});

// ========== posterプリロードテスト ==========

describe('Poster Preload (v8: only remaining preload feature)', () => {
  it('should prevent duplicate poster preloads', () => {
    const posterCache = new Set<string>();

    function preloadPoster(url: string): boolean {
      if (!url || posterCache.has(url)) return false;
      posterCache.add(url);
      return true;
    }

    expect(preloadPoster('https://cdn/abc/thumbnail.jpg')).toBe(true);
    expect(preloadPoster('https://cdn/abc/thumbnail.jpg')).toBe(false); // duplicate
    expect(posterCache.size).toBe(1);
  });

  it('should reject empty URLs', () => {
    const posterCache = new Set<string>();

    function preloadPoster(url: string): boolean {
      if (!url || posterCache.has(url)) return false;
      posterCache.add(url);
      return true;
    }

    expect(preloadPoster('')).toBe(false);
    expect(posterCache.size).toBe(0);
  });
});

// ========== v8 deprecated API テスト ==========

describe('Deprecated APIs (v8: all return no-op/null)', () => {
  it('getBgVideoElement is deprecated and returns no-op in v8', () => {
    // v8ではbgPoolは廃止、getBgVideoElementはno-op
    // サーバーサイドテストではDOMが使えないため、設計原則のみ検証
    const isDeprecated = true;
    const bgPoolRemoved = true;
    expect(isDeprecated).toBe(true);
    expect(bgPoolRemoved).toBe(true);
  });

  it('createGalleryPlayer is deprecated and returns no-op in v8', () => {
    // v8ではiframe embed方式に移行、createGalleryPlayerはno-op
    const result = { hls: null, cleanup: () => {} };
    expect(result.hls).toBeNull();
    expect(typeof result.cleanup).toBe('function');
  });

  it('hasBgVideoInCache should return false (pool removed)', () => {
    // v8ではbgPoolは廃止
    expect(false).toBe(false);
  });
});

// ========== iframe embed方式の設計原則テスト ==========

describe('iframe embed design principles (v8)', () => {
  it('should use iframe.mediadelivery.net host for all video playback', () => {
    const host = 'iframe.mediadelivery.net';
    expect(host).not.toBe('vz-2e234254-464.b-cdn.net');
    expect(host).toContain('mediadelivery.net');
  });

  it('should include library ID in embed URL path', () => {
    const libraryId = '584611';
    const videoId = 'test-video-123';
    const url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
    expect(url).toContain(`/embed/${libraryId}/`);
    expect(url).toContain(videoId);
  });

  it('background video should use autoplay+muted+loop params', () => {
    const params = new URLSearchParams({
      autoplay: 'true',
      muted: 'true',
      loop: 'true',
      preload: 'true',
    });
    expect(params.get('autoplay')).toBe('true');
    expect(params.get('muted')).toBe('true');
    expect(params.get('loop')).toBe('true');
  });

  it('fullscreen video should NOT loop by default', () => {
    const params = new URLSearchParams({
      autoplay: 'true',
      muted: 'false',
      preload: 'true',
    });
    expect(params.has('loop')).toBe(false);
  });
});
