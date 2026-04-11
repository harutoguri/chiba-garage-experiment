/**
 * BunnyVideoEmbed — Bunny Stream iframe embed 共通コンポーネント
 * 
 * CDN直リンク（b-cdn.net）の403エラー（砂嵐）を根本解決するため、
 * すべての動画再生をiframe.mediadelivery.netのembed方式に統一する。
 * 
 * 2つのバリアント:
 * 1. BunnyBgVideo — 背景動画用（autoplay, muted, loop, ポインターイベント無効）
 * 2. BunnyFullscreenVideo — 全画面再生用（autoplay, コントロール付き）
 */

import { memo, useMemo } from 'react';
import { getBunnyBgEmbedUrl, getBunnyFullscreenEmbedUrl, getBunnyEmbedUrl } from '@/lib/bunnyUrls';
import type { BunnyEmbedOptions } from '@/lib/bunnyUrls';

// ========== 共通iframe属性 ==========

const IFRAME_ALLOW = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture';

// ========== 背景動画用 ==========

interface BunnyBgVideoProps {
  videoId: string;
  className?: string;
  /** 不透明度（0-100）。デフォルト60 */
  opacity?: number;
}

/**
 * 背景動画用の Bunny Stream iframe embed
 * 
 * 特徴:
 * - autoplay + muted + loop で自動ループ再生
 * - pointer-events: none でタップ/クリックを透過
 * - 16:9のiframeを画面全体にカバー表示
 */
export const BunnyBgVideo = memo(function BunnyBgVideo({
  videoId,
  className = '',
  opacity = 60,
}: BunnyBgVideoProps) {
  const embedUrl = useMemo(() => getBunnyBgEmbedUrl(videoId), [videoId]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0, opacity: opacity / 100 }}
    >
      <iframe
        src={embedUrl}
        loading="lazy"
        allow={IFRAME_ALLOW}
        className="absolute top-1/2 left-1/2 border-none pointer-events-none"
        style={{
          width: '177.78vh', // 16:9 cover: max(100vw, 177.78vh)
          height: '100vh',
          minWidth: '100%',
          minHeight: '100%',
          transform: 'translate(-50%, -50%)',
        }}
        title="Background video"
        tabIndex={-1}
      />
    </div>
  );
});

// ========== 全画面再生用 ==========

interface BunnyFullscreenVideoProps {
  videoId: string;
  className?: string;
  /** カスタムembedオプション */
  options?: BunnyEmbedOptions;
}

/**
 * 全画面再生用の Bunny Stream iframe embed
 * 
 * 特徴:
 * - autoplay + preload で即再生
 * - Bunny Player内蔵のコントロール（再生/一時停止/音量/全画面）
 * - レスポンシブ対応（親要素にフィット）
 */
export const BunnyFullscreenVideo = memo(function BunnyFullscreenVideo({
  videoId,
  className = '',
  options,
}: BunnyFullscreenVideoProps) {
  const embedUrl = useMemo(
    () => options ? getBunnyEmbedUrl(videoId, options) : getBunnyFullscreenEmbedUrl(videoId),
    [videoId, options],
  );

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ paddingTop: 0 }}
    >
      <iframe
        src={embedUrl}
        loading="eager"
        allow={IFRAME_ALLOW}
        allowFullScreen
        className="absolute inset-0 w-full h-full border-none"
        title="Video player"
      />
    </div>
  );
});

// ========== CloudFront動画用のfallback ==========

interface CloudFrontVideoProps {
  videoUrl: string;
  posterUrl?: string | null;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  opacity?: number;
}

/**
 * CloudFront動画用のfallback（Bunny以外の動画URL用）
 * 従来の<video>要素を使用
 */
export const CloudFrontVideo = memo(function CloudFrontVideo({
  videoUrl,
  posterUrl,
  autoplay = true,
  muted = true,
  loop = true,
  className = '',
  opacity = 60,
}: CloudFrontVideoProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0, opacity: opacity / 100 }}
    >
      <video
        src={videoUrl}
        poster={posterUrl || undefined}
        autoPlay={autoplay}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
    </div>
  );
});

export default BunnyBgVideo;
