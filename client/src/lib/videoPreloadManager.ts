/**
 * Video Preload Manager v8 — iframe embed方式対応
 * 
 * 【v8変更点】
 * - Bunny動画はiframe embed方式（BunnyVideoEmbed.tsx）に完全移行
 * - <video>要素のキャッシュ管理（bgPool, createGalleryPlayer）は不要に
 * - 残存機能: posterサムネイルのプリロードのみ
 * - 後方互換API: no-op関数を維持（他モジュールからのimportエラー防止）
 */

import { getBunnyThumbnailUrl } from './bunnyUrls';

// ========== posterキャッシュ ==========

const posterCache = new Set<string>();

// ========== posterプリロード ==========

/**
 * サムネイル画像を事前取得（Imageオブジェクトでブラウザキャッシュに載せる）
 */
export function preloadPoster(url: string): void {
  if (!url || posterCache.has(url)) return;
  posterCache.add(url);
  const img = new Image();
  img.src = url;
}

/**
 * Bunny動画のサムネイルを事前取得
 */
export function preloadThumbnail(bunnyVideoId: string): void {
  const url = getBunnyThumbnailUrl(bunnyVideoId);
  preloadPoster(url);
}

// ========== 後方互換API（no-op） ==========

/** @deprecated v8ではno-op — iframe embed方式に移行 */
export function preloadNextVideo(bunnyVideoId: string): void {
  preloadThumbnail(bunnyVideoId);
}

/** @deprecated v8ではno-op — iframe embed方式に移行 */
export function preloadGalleryMp4(bunnyVideoId: string, _resolution?: string): void {
  preloadThumbnail(bunnyVideoId);
}

/** @deprecated v8ではno-op */
export function preloadGalleryVideo(_bunnyVideoId: string): void {}

/** @deprecated v8ではnull返却 */
export function getGalleryVideoElement(_bunnyVideoId: string): HTMLVideoElement | null {
  return null;
}

/** @deprecated v8ではno-op */
export function returnGalleryVideoToPool(_bunnyVideoId: string, _video: HTMLVideoElement): void {}

/** @deprecated v8ではfalse返却 */
export function isGalleryVideoReady(_bunnyVideoId: string): boolean {
  return false;
}

/** @deprecated v8ではno-op */
export function preloadHlsManifest(_bunnyVideoId: string): void {}

/** @deprecated v8ではnull返却 */
export function getOrCreateHls(_bunnyVideoId: string, onReady?: () => void): null {
  if (onReady) onReady();
  return null;
}

/** @deprecated v8ではnull返却 */
export function getCachedHls(_bunnyVideoId: string): null {
  return null;
}

/** @deprecated v8ではno-op */
export function destroyHls(_bunnyVideoId: string): void {}

/** @deprecated v8ではno-op — bgPoolは廃止 */
export function getBgVideoElement(
  _bunnyVideoId: string | null | undefined,
  _videoUrl: string,
  _posterUrl?: string | null,
): HTMLVideoElement {
  // fallback: 空のvideo要素を返す（呼び出し元がまだ残っている場合の安全策）
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  return video;
}

/** @deprecated v8ではno-op */
export function returnBgVideoToCache(
  _bunnyVideoId: string | null | undefined,
  _videoUrl: string,
  _video: HTMLVideoElement,
): void {}

/** @deprecated v8ではfalse返却 */
export function hasBgVideoInCache(
  _bunnyVideoId: string | null | undefined,
  _videoUrl: string,
): boolean {
  return false;
}

/** @deprecated v8ではno-op — bgPoolは廃止 */
export function createGalleryPlayer(
  _bunnyVideoId: string | null | undefined,
  _videoUrl: string,
  _posterUrl?: string | null,
  _onFirstFrame?: () => void,
): { video: HTMLVideoElement; hls: null; cleanup: () => void } {
  const video = document.createElement('video');
  return { video, hls: null, cleanup: () => {} };
}

// ========== クリーンアップ ==========

export function clearAllCaches(): void {
  posterCache.clear();
}
