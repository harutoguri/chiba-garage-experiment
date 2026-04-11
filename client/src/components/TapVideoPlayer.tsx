import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { createGalleryPlayer } from "@/lib/videoPreloadManager";

/**
 * タップ再生用ビデオプレイヤー v6
 * 
 * 【設計方針】
 * - createGalleryPlayer() 内で即座にload()+play()を呼ぶ
 * - muted=true で再生成功率を最優先（iOS Safari対策）
 * - play()失敗時は自動でcontrols表示 + スピナー解除
 * - 8秒タイムアウトで無限スピナー防止
 * - 詳細ログ: [FULL] プレフィックスで全ステップを出力
 */
interface TapVideoPlayerProps {
  videoUrl: string;
  bunnyVideoId?: string | null;
  posterUrl?: string | null;
  onClose: () => void;
  onBackgroundPause?: () => void;
}

export function TapVideoPlayer({
  videoUrl,
  bunnyVideoId,
  posterUrl,
  onClose,
  onBackgroundPause,
}: TapVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (onBackgroundPause) {
      onBackgroundPause();
    }
  }, [onBackgroundPause]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setIsLoading(true);

    console.log(`[TapVideoPlayer] creating player`);

    // v6: createGalleryPlayer は内部で即座にload()+play()を呼ぶ
    // muted=true + controls=true で iOS Safari でも再生成功
    // play()失敗時は自動でcontrols表示 + スピナー解除（8秒タイムアウト）
    const { video, cleanup } = createGalleryPlayer(
      bunnyVideoId || null,
      videoUrl,
      posterUrl || null,
      () => {
        console.log(`[TapVideoPlayer] first frame rendered`);
        setIsLoading(false);
      },
    );

    video.className = 'w-full h-full object-contain';
    video.style.cssText = 'z-index: 10;';

    console.log(`[FULL] video node appended to DOM (TapVideoPlayer)`);
    container.appendChild(video);
    videoElRef.current = video;
    cleanupFnRef.current = cleanup;

    return () => {
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
      const vid = videoElRef.current;
      if (vid && container.contains(vid)) {
        container.removeChild(vid);
      }
      videoElRef.current = null;
    };
  }, [bunnyVideoId, videoUrl, posterUrl]);

  const handleClose = useCallback(() => {
    if (cleanupFnRef.current) {
      cleanupFnRef.current();
      cleanupFnRef.current = null;
    }
    const video = videoElRef.current;
    const container = containerRef.current;
    if (video && container && container.contains(video)) {
      container.removeChild(video);
    }
    videoElRef.current = null;
    onClose();
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <button
        onClick={handleClose}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleClose();
        }}
        className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors touch-manipulation"
        style={{ position: 'absolute', zIndex: 100 }}
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      />
    </div>
  );
}

export default TapVideoPlayer;
