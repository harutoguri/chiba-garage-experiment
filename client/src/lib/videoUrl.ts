/**
 * 動画URL変換ユーティリティ
 * 
 * iOS SafariはRange requestを必須とするため、
 * CloudFront/S3の動画URLをプロキシURL経由に変換する
 */

// プロキシ対象のドメイン
const PROXY_DOMAINS = [
  "d2xsxph8kpxj0f.cloudfront.net",
  "manus-storage-prod-sg.s3.ap-southeast-1.amazonaws.com",
];

/**
 * 動画URLがプロキシ対象かどうかを確認
 */
function shouldProxy(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PROXY_DOMAINS.some(domain => parsed.hostname === domain);
  } catch {
    return false;
  }
}

/**
 * 動画URLをプロキシURL経由に変換
 * 
 * iOS SafariはRange requestを必須とするため、
 * CloudFront/S3の動画URLをサーバーサイドプロキシ経由に変換する
 * 
 * @param url 元の動画URL
 * @returns プロキシURL（対象外の場合は元のURLをそのまま返す）
 */
export function getProxiedVideoUrl(url: string): string {
  if (!url) return url;
  
  // プロキシ対象でない場合はそのまま返す
  if (!shouldProxy(url)) {
    return url;
  }
  
  // プロキシURL経由に変換
  return `/api/video-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * iOS Safariかどうかを判定
 */
export function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  
  // iOS上のSafari（Chrome/Firefoxではない）
  return isIOS && isWebKit && !isChrome && !isFirefox;
}

/**
 * iOS Safari用に動画URLを最適化
 * 
 * iOS Safariの場合のみプロキシURL経由に変換
 * 他のブラウザでは元のURLをそのまま使用（パフォーマンス優先）
 * 
 * @param url 元の動画URL
 * @param forceProxy 強制的にプロキシを使用するかどうか
 * @returns 最適化されたURL
 */
export function getOptimizedVideoUrl(url: string, forceProxy: boolean = false): string {
  if (!url) return url;
  
  // 強制プロキシまたはiOS Safariの場合のみプロキシを使用
  if (forceProxy || isIOSSafari()) {
    return getProxiedVideoUrl(url);
  }
  
  return url;
}
