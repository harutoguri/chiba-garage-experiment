import { useEffect, useRef, useCallback } from "react";

/**
 * 動画プレイヤー事前初期化コンポーネント
 * 
 * ページ読み込み時にダミー動画を再生してデコーダーを初期化
 * UIには一切表示せず、内部的にのみ処理を実行
 */

// グローバル状態
declare global {
  interface Window {
    __videoPreloadEnabled?: boolean;
    __videoWarmupComplete?: boolean;
  }
}

// 先読みを有効化
export const enablePreload = () => {
  if (typeof window !== "undefined") {
    window.__videoPreloadEnabled = true;
  }
};

// 先読みが有効かどうか
export const isPreloadEnabled = () => {
  return typeof window !== "undefined" && window.__videoPreloadEnabled === true;
};

// ウォームアップ完了フラグ
export const isWarmupComplete = () => {
  return typeof window !== "undefined" && window.__videoWarmupComplete === true;
};

// 動画再生時に先読みを有効化
export const recordVideoPlay = (_index: number) => {
  enablePreload();
};

/**
 * ダミー動画ウォームアップコンポーネント
 * - canplay/playing/canplaythroughが発火するまで待つ（タイムアウト上限2秒）
 * - 発火後にpause() → remove()
 * - UIには一切表示しない
 * - ページロード完了判定とは完全に分離（動画待ちでロード完了しない）
 */
export function VideoWarmup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasWarmedUp = useRef(false);

  useEffect(() => {
    if (hasWarmedUp.current) return;
    hasWarmedUp.current = true;
    
    // ウォームアップ不要 - 各車両のHLS再生時にデコーダーは自動初期化される
    if (typeof window !== "undefined") {
      window.__videoPreloadEnabled = false;
      window.__videoWarmupComplete = true; // 即座に完了扱い
    }
  }, []);

  // 何もレンダリングしない（不要なMP4ダウンロードを完全排除）
  return null;
}

/**
 * 動画先読みフック
 * - 初回ユーザー操作が完了するまで先読みを無効化
 * - IntersectionObserverで画面に入る直前の動画を先読み
 * - 同時に走らせる本数を制限（最大2本）
 */
export function useVideoPreload() {
  const loadingVideos = useRef<Set<HTMLVideoElement>>(new Set());
  const MAX_CONCURRENT_PRELOAD = 2;

  const preloadVideo = useCallback((video: HTMLVideoElement) => {
    if (!isPreloadEnabled()) {
      return;
    }
    
    if (loadingVideos.current.size >= MAX_CONCURRENT_PRELOAD) return;
    if (loadingVideos.current.has(video)) return;
    if (video.readyState >= 1) return;

    loadingVideos.current.add(video);
    video.preload = "metadata";
    video.load();

    const handleLoaded = () => {
      loadingVideos.current.delete(video);
      video.removeEventListener("loadedmetadata", handleLoaded);
    };
    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
  }, []);

  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const video = entry.target as HTMLVideoElement;
        preloadVideo(video);
      }
    });
  }, [preloadVideo]);

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(observerCallback, {
      rootMargin: "200px 0px",
      threshold: 0,
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [observerCallback]);

  const observe = useCallback((video: HTMLVideoElement | null) => {
    if (video && observerRef.current) {
      observerRef.current.observe(video);
    }
  }, []);

  const unobserve = useCallback((video: HTMLVideoElement | null) => {
    if (video && observerRef.current) {
      observerRef.current.unobserve(video);
    }
  }, []);

  return { observe, unobserve };
}

export default VideoWarmup;
