import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getBunnyMp4Url, getBunnyBgVideoUrl, getBunnyThumbnailUrl } from '@/lib/bunnyUrls';
import { Loader2 } from 'lucide-react';

interface BunnyVideoPlayerProps {
  /** Bunny StreamのビデオID */
  bunnyVideoId?: string | null;
  /** フォールバック用のS3 URL */
  fallbackUrl?: string | null;
  /** ポスター画像URL */
  poster?: string | null;
  /** 背景自動再生モード（muted, autoplay, loop, 低解像度） */
  background?: boolean;
  /** ギャラリーモード（コントロール表示、高解像度） */
  gallery?: boolean;
  /** 自動再生 */
  autoPlay?: boolean;
  /** ミュート */
  muted?: boolean;
  /** ループ */
  loop?: boolean;
  /** コントロール表示 */
  controls?: boolean;
  /** CSSクラス */
  className?: string;
  /** 再生可能になったとき */
  onReady?: () => void;
  /** エラー時 */
  onError?: (error: Error) => void;
}

/**
 * Bunny Stream対応ビデオプレイヤー v2
 * 
 * 【設計方針】
 * - video-proxyは一切使わない
 * - bunnyVideoIdがある場合: Bunny CDN直URL（MP4）で再生
 *   - 背景モード: 480p MP4（高速ロード）
 *   - ギャラリーモード: 720p MP4
 * - bunnyVideoIdがない場合: 直接URLで再生（video-proxy不使用）
 */
export default function BunnyVideoPlayer({
  bunnyVideoId,
  fallbackUrl,
  poster,
  background = false,
  gallery = false,
  autoPlay = false,
  muted = false,
  loop = false,
  controls = false,
  className = '',
  onReady,
  onError,
}: BunnyVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ポスター画像URL
  const posterUrl = useMemo(() => {
    if (poster) return poster;
    if (bunnyVideoId) return getBunnyThumbnailUrl(bunnyVideoId);
    return undefined;
  }, [poster, bunnyVideoId]);

  // 動画ソースの決定（video-proxy不使用）
  const videoSource = useMemo(() => {
    if (bunnyVideoId) {
      if (background) {
        // 背景モード: 480p MP4（高速ロード）
        return { type: 'mp4' as const, url: getBunnyBgVideoUrl(bunnyVideoId) };
      }
      // ギャラリーモード: 720p MP4
      return { type: 'mp4' as const, url: getBunnyMp4Url(bunnyVideoId, gallery ? '720' : '480') };
    }
    
    // フォールバック: 直接URL（video-proxy不使用）
    if (fallbackUrl) {
      return { type: 'direct' as const, url: fallbackUrl };
    }
    
    return null;
  }, [bunnyVideoId, fallbackUrl, background, gallery]);

  // MP4フォールバックURL（エラー時）
  const mp4FallbackUrl = useMemo(() => {
    if (bunnyVideoId) {
      return getBunnyMp4Url(bunnyVideoId, '360');
    }
    return null;
  }, [bunnyVideoId]);

  // メインの再生ロジック
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    setIsReady(false);
    setError(null);
    setIsLoading(true);

    // MP4直接再生
    video.src = videoSource.url;
    
    const handleCanPlay = () => {
      setIsReady(true);
      setIsLoading(false);
      onReady?.();
      if (autoPlay || background) {
        video.play().catch(console.error);
      }
    };
    
    const handleError = () => {
      // MP4フォールバック試行
      if (mp4FallbackUrl && video.src !== mp4FallbackUrl) {
        console.log('[BunnyVideoPlayer] Play failed, trying 360p fallback');
        video.src = mp4FallbackUrl;
        video.load();
      } else {
        setError('動画の再生に失敗しました');
        setIsLoading(false);
        onError?.(new Error('Video playback failed'));
      }
    };
    
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('error', handleError, { once: true });
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [videoSource, autoPlay, background, mp4FallbackUrl, onReady, onError]);

  if (!videoSource) {
    return (
      <div className={`relative flex items-center justify-center bg-black/50 ${className}`}>
        <p className="text-white/50 text-sm">動画なし</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        poster={posterUrl}
        muted={muted || background}
        loop={loop || background}
        playsInline
        controls={controls && !background}
        autoPlay={autoPlay || background}
        preload={background ? 'metadata' : 'auto'}
        className="w-full h-full object-cover"
      />
      {isLoading && !background && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm p-4">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
