/**
 * Bunny Stream URL生成ユーティリティ（フロント用）
 * 
 * v10.23: プロキシ全廃止。CDN直URL使用。
 * - HLS: https://vz-2e234254-464.b-cdn.net/{videoId}/playlist.m3u8
 * - サムネイル: https://vz-2e234254-464.b-cdn.net/{videoId}/thumbnail.jpg
 */

const BUNNY_LIBRARY_ID = '584611';
const BUNNY_CDN_HOST = 'vz-2e234254-464.b-cdn.net';
const BUNNY_EMBED_HOST = 'iframe.mediadelivery.net';

// ========== HLS URL (deprecated — MP4移行後に削除) ==========

/**
 * @deprecated v92a: MP4直接再生に移行。getMp4Url()を使用。
 */
export function getBunnyHlsUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/playlist.m3u8`;
}

// ========== MP4 URL (v92a: TikTok iPhone方式) ==========

/**
 * MP4再生URL — ローカルキャッシュプロキシ経由
 * v93h: CDN直→ローカルキャッシュに変更。プリウォーム済みなら1msで配信。
 * Range Request対応（Express sendFile）。
 */
export function getMp4Url(videoId: string): string {
  // 実験2: SDR自動変換エンドポイント経由
  return `/api/sdr/${videoId}?v=5`;
}

// ========== MP4 Direct Play URL ==========

/**
 * Bunny Stream MP4 direct play URL（CDN直リンク）
 * v70: COLD初回1本目用 — progressive MP4 で HLS の3段RTT を回避
 * faststart済み (moov at byte 32, ~6KB) → iOS Safari が即座に再生開始可能
 */
export function getBunnyMp4DirectUrl(videoId: string, quality: '360p' | '480p' | '720p' | '1080p' = '720p'): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/play_${quality}.mp4`;
}

// ========== サムネイルURL ==========

/**
 * Bunny Streamのサムネイル画像URL（サーバープロキシ経由）
 *
 * 直接 CDN URL を使うと LAN 開発環境（http://）では Referer なし → Bunny CDN 403。
 * /api/thumb?id=... プロキシ経由で取得することで、HTTP/HTTPS 両環境で動作する。
 * サーバー側で Referer: https://iframe.mediadelivery.net/ を付けてフェッチし返す。
 */
export function getBunnyThumbnailUrl(videoId: string): string {
  // 実験2: SDR変換済みMP4のframe 0をサムネとして使用
  return `/api/sdr-thumb/${videoId}?v=3`;
}

/**
 * ポスター画像URL（高解像度サムネイル）
 */
export function getBunnyPosterUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/thumbnail.jpg`;
}

/**
 * アニメーションプレビューURL（WebP形式）
 */
export function getBunnyPreviewUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/preview.webp`;
}

// ========== Embed URL生成 ==========

export interface BunnyEmbedOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: boolean;
  playsinline?: boolean;
  responsive?: boolean;
  t?: number;
}

export function getBunnyEmbedUrl(videoId: string, options: BunnyEmbedOptions = {}): string {
  const params = new URLSearchParams();
  if (options.autoplay !== undefined) params.set('autoplay', String(options.autoplay));
  if (options.muted !== undefined) params.set('muted', String(options.muted));
  if (options.loop !== undefined) params.set('loop', String(options.loop));
  if (options.preload !== undefined) params.set('preload', String(options.preload));
  if (options.responsive !== undefined) params.set('responsive', String(options.responsive));
  if (options.t !== undefined) params.set('t', String(options.t));
  const queryString = params.toString();
  const base = `https://${BUNNY_EMBED_HOST}/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
  return queryString ? `${base}?${queryString}` : base;
}

export function getBunnyBgEmbedUrl(videoId: string): string {
  return getBunnyEmbedUrl(videoId, { autoplay: true, muted: true, loop: true, preload: true, responsive: true });
}

export function getBunnyFullscreenEmbedUrl(videoId: string): string {
  return getBunnyEmbedUrl(videoId, { autoplay: true, muted: false, preload: true, responsive: true });
}

// ========== 定数 ==========

export const BUNNY_STREAM_LIBRARY_ID = BUNNY_LIBRARY_ID;

// ========== 画像最適化ユーティリティ ==========

export function buildImageSrcSet(
  optimizedUrls: { webp?: Record<string, string>; jpeg?: Record<string, string> } | null,
  format: 'webp' | 'jpeg' = 'webp',
): string | undefined {
  if (!optimizedUrls) return undefined;
  const urls = format === 'webp' ? optimizedUrls.webp : optimizedUrls.jpeg;
  if (!urls) return undefined;
  const sizeWidths: Record<string, number> = { sm: 480, md: 960, lg: 1440 };
  return Object.entries(urls)
    .filter(([_, url]) => url)
    .map(([size, url]) => `${url} ${sizeWidths[size] || 480}w`)
    .join(', ');
}

export function getOptimalImageUrl(
  originalUrl: string,
  optimizedUrls: string | null,
  size: 'sm' | 'md' | 'lg' = 'md',
): string {
  if (!optimizedUrls) return originalUrl;
  try {
    const parsed = JSON.parse(optimizedUrls);
    return parsed?.webp?.[size] || parsed?.jpeg?.[size] || originalUrl;
  } catch {
    return originalUrl;
  }
}

export const IMAGE_SIZES_ATTR = {
  thumbnail: '(max-width: 640px) 100vw, 480px',
  gallery: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 960px',
  background: '100vw',
} as const;

// ========== 後方互換（deprecated） ==========

/** @deprecated プロキシ廃止。getBunnyHlsUrlを使用。 */
export function getBunnyMp4ProxyUrl(_videoId: string, _resolution?: string): string {
  console.warn('[bunnyUrls] getBunnyMp4ProxyUrl is deprecated.');
  return '';
}

/** @deprecated プロキシ廃止。getBunnyHlsUrlを使用。 */
export function getBunnyHlsProxyUrl(_videoId: string): string {
  console.warn('[bunnyUrls] getBunnyHlsProxyUrl is deprecated.');
  return '';
}

/** @deprecated */
export function getBunnyMp4Url(_videoId: string, _resolution?: string): string {
  console.warn('[bunnyUrls] getBunnyMp4Url is deprecated.');
  return '';
}

/** @deprecated */
export function getBunnyBgVideoUrl(_videoId: string): string {
  console.warn('[bunnyUrls] getBunnyBgVideoUrl is deprecated.');
  return '';
}
