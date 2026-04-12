/**
 * TikTokVideoGallery v93f — TikTok iPhone版完全再現
 *
 * v93f changes:
 *   - けつ見え修正: ACTIVE復帰時 currentTime=0 を強制
 *   - リモートデバッグログ: console → /api/debug-log に自動送信
 *   - 初回動画: debounce 0ms（2本目以降は150ms維持）
 */

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Info, X } from "lucide-react";
import { getMp4Url, getBunnyThumbnailUrl, getOptimalImageUrl } from "@/lib/bunnyUrls";

const BUILD_ID = "3u94";

// blob URLキャッシュ（戻りスワイプ用）
const _blobCache = new Map<string, string>(); // mp4Url → blob URL
const _visualPrefetchSeen = new Set<string>(); // thumb/image url
let _pinchGestureLock = false; // pinch完了まで親の縦横gestureを止める

// ========== リモートデバッグログ ==========
const _remoteLogBuffer: string[] = [];
let _remoteLogTimer: ReturnType<typeof setTimeout> | null = null;

function remoteLog(...args: any[]) {
  const msg = `[${BUILD_ID}] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")}`;
  console.log(msg);
  _remoteLogBuffer.push(`${new Date().toISOString().slice(11, 23)} ${msg}`);
  if (!_remoteLogTimer) {
    _remoteLogTimer = setTimeout(flushRemoteLogs, 500);
  }
}

function flushRemoteLogs() {
  _remoteLogTimer = null;
  if (_remoteLogBuffer.length === 0) return;
  const lines = _remoteLogBuffer.splice(0);
  fetch("/api/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  }).catch(() => {});
}

// ========== 型定義 ==========

export interface MediaItem {
  id: number;
  type: "video" | "image";
  url: string;
  bunnyVideoId?: string | null;
  thumbnailUrl?: string | null;
  thumbTs?: number | null;
  optimizedUrls?: string | null;
  displayOrder?: number;
}

export interface VehicleData {
  id: number;
  title: string;
  price: string;
  description?: string | null;
  media: MediaItem[];
  status?: "在庫あり" | "商談中" | "売約済み" | string;
  isConsignment?: boolean;
}

interface TikTokVideoGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: VehicleData[];
  initialVehicleIndex?: number;
  initialMediaIndex?: number;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

// ========== ユーティリティ ==========

// ★ 3f: MP4 URLからvideoId抽出（blob cache用）
function extractVideoIdFromMp4Url(url: string): string | null {
  const sdrMatch = url.match(/\/api\/sdr\/([0-9a-f-]+)$/i);
  if (sdrMatch) return sdrMatch[1];
  const cacheMatch = url.match(/\/api\/mp4-cache\/([0-9a-f-]+)$/i);
  if (cacheMatch) return cacheMatch[1];
  const genericMatch = url.match(/([0-9a-f]{8}-[0-9a-f-]{27,})/i);
  if (genericMatch) return genericMatch[1];
  return null;
}

const getMp4UrlForItem = (item: MediaItem): string | null => {
  if (item.type !== "video") return null;
  // ★ 2w: SDRパイプライン変換済み動画を最優先（/api/sdr/ にのみ存在）
  if (item.url?.startsWith("/api/sdr/")) return item.url;
  if (item.bunnyVideoId) return getMp4Url(item.bunnyVideoId);
  // ローカルアップロード動画（MP4/MOV、大文字小文字問わず）も直接再生
  if (item.url) {
    const lower = item.url.toLowerCase();
    if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return item.url;
  }
  return null;
};

export function getImageSrc(item: MediaItem, size: "sm" | "md" | "lg" = "md"): string {
  if (item.optimizedUrls) {
    return getOptimalImageUrl(item.url, item.optimizedUrls, size);
  }
  return item.url;
}

function getVideoThumbnailUrl(item: MediaItem): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.bunnyVideoId) return getBunnyThumbnailUrl(item.bunnyVideoId);
  const videoId = extractVideoIdFromMp4Url(item.url || "");
  if (videoId) return `/api/sdr-thumb/${videoId}?v=3`;
  return null;
}

function setVideoSource(video: HTMLVideoElement, nextSrc: string): boolean {
  const currentKey = video.dataset.cgSrcKey || "";
  if (currentKey === nextSrc && video.getAttribute("src")) return false;
  video.dataset.cgSrcKey = nextSrc;
  video.src = nextSrc;
  video.load();
  return true;
}

function clearVideoSource(video: HTMLVideoElement): boolean {
  const hasSrc = !!video.getAttribute("src") || !!video.dataset.cgSrcKey;
  if (!hasSrc) return false;
  delete video.dataset.cgSrcKey;
  video.pause();
  video.removeAttribute("src");
  video.load();
  return true;
}

export function getFirstImageUrl(vehicle: VehicleData): string | null {
  const media = vehicle.media;
  if (!media) return null;
  const img = media.find(m => m.type === "image");
  if (img) return getImageSrc(img, "sm");
  const vid = media.find(m => m.type === "video");
  if (vid) return getVideoThumbnailUrl(vid);
  return null;
}

function getStatusBadge(vehicle: VehicleData): { text: string; bg: string; color: string } | null {
  if (vehicle.isConsignment) {
    return { text: "委託車両", bg: "#2563eb", color: "white" };
  }
  switch (vehicle.status) {
    case "売約済み":
      return { text: "成約済", bg: "#ef4444", color: "white" };
    case "商談中":
      return { text: "商談中", bg: "#f59e0b", color: "white" };
    case "在庫あり":
    default:
      return { text: "在庫あり", bg: "white", color: "black" };
  }
}

/** VideoFeed/Consignment用のearly preload（互換export） */
export function startEarlyPreload(urlOrHlsUrl: string) {
  const m = urlOrHlsUrl.match(/\/([0-9a-f]{8}-[0-9a-f-]+)\//);
  if (!m) return;
  const videoId = m[1];
  // ★ 3u16: heavy素材はfetch不要（ACTIVE-DIRECTが唯一のDLパスにする）
  const w = window as any;
  const fvd = w.__FIRST_VIDEO_DATA__;
  if (fvd && fvd.bunnyVideoId === videoId && fvd.earlyBlobEligible === false) {
    remoteLog("startEarlyPreload-SKIP", 0, "heavy-asset", videoId.slice(0, 8));
    return;
  }
  // ★ 重複排除: head注入のearly blob fetchが同じ動画を既に取得中ならスキップ
  if (w.__earlyMp4VideoId === videoId && w.__earlyMp4Promise) {
    remoteLog("startEarlyPreload-SKIP", 0, "head-fetch-exists", videoId.slice(0, 8));
    return;
  }
  const mp4Url = getMp4Url(videoId);
  // blob cacheに既にあるならスキップ
  if (_blobCache.has(mp4Url)) {
    remoteLog("startEarlyPreload-SKIP", 0, "already-cached", videoId.slice(0, 8));
    return;
  }
  fetch(mp4Url, { mode: "cors", credentials: "omit" } as RequestInit).catch(() => {});
}

// ========== CSS注入: スクロールバー非表示 ==========

if (typeof document !== "undefined") {
  const s = document.createElement("style");
  s.textContent = ".h-scroll-clip::-webkit-scrollbar{display:none}";
  document.head.appendChild(s);
}

// ========== デスクトップ判定 ==========

function useIsDesktop() {
  const [d, setD] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : false);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return d;
}

// ========== ドットインジケーター ==========

function DotIndicator({ total, current, style }: { total: number; current: number; style?: React.CSSProperties }) {
  if (total <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "6px", ...style }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? "16px" : "6px",
            height: "6px",
            borderRadius: "3px",
            background: i === current ? "white" : "rgba(255,255,255,0.4)",
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// ========== PinchZoomImage ==========

function PinchZoomImage({
  src, isActive, eager, style,
}: {
  src: string;
  isActive: boolean;
  eager?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ scale: 1, x: 0, y: 0 });
  const startRef = useRef({ dist: 0, cx: 0, cy: 0, scale: 1, x: 0, y: 0 });

  const mainImgRef = useRef<HTMLImageElement>(null); // ★ 3u61: ピンチズーム対象を明示
  const blurImgRef = useRef<HTMLImageElement>(null);
  const applyTransform = useCallback(() => {
    const el = mainImgRef.current;
    if (!el) return;
    const { scale, x, y } = stateRef.current;
    el.style.transform = scale <= 1.02 ? "none" : `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isActive) return;
    let _pinching = false;
    let _panning = false;
    let _panStart = { x: 0, y: 0, touchX: 0, touchY: 0 };

    const onTouchStart = (e: TouchEvent) => {
      if (stateRef.current.scale > 1.02 && e.touches.length === 1) {
        _pinchGestureLock = true;
        _panning = true;
        e.preventDefault();
        e.stopPropagation();
        _panStart = {
          x: stateRef.current.x,
          y: stateRef.current.y,
          touchX: e.touches[0].clientX,
          touchY: e.touches[0].clientY,
        };
        return;
      }
      if (e.touches.length >= 2) {
        _pinching = true;
        _panning = false;
        _pinchGestureLock = true;
        e.preventDefault();
        e.stopPropagation(); // ★ 3u65: 親への伝播も止める
        const [a, b] = [e.touches[0], e.touches[1]];
        startRef.current = {
          dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          cx: (a.clientX + b.clientX) / 2,
          cy: (a.clientY + b.clientY) / 2,
          scale: stateRef.current.scale,
          x: stateRef.current.x,
          y: stateRef.current.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (_pinching || _pinchGestureLock) {
        e.preventDefault();
        e.stopPropagation(); // ★ 3u65
        if (e.touches.length >= 2) {
          const [a, b] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const s = startRef.current;
          stateRef.current.scale = Math.min(5, Math.max(1, s.scale * (dist / s.dist)));
          const cx = (a.clientX + b.clientX) / 2;
          const cy = (a.clientY + b.clientY) / 2;
          stateRef.current.x = s.x + (cx - s.cx);
          stateRef.current.y = s.y + (cy - s.cy);
          applyTransform();
          return;
        }
        if (e.touches.length === 1 && (_panning || stateRef.current.scale > 1.02)) {
          if (!_panning) {
            _panning = true;
            _panStart = {
              x: stateRef.current.x,
              y: stateRef.current.y,
              touchX: e.touches[0].clientX,
              touchY: e.touches[0].clientY,
            };
          }
          stateRef.current.x = _panStart.x + (e.touches[0].clientX - _panStart.touchX);
          stateRef.current.y = _panStart.y + (e.touches[0].clientY - _panStart.touchY);
          applyTransform();
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (_pinching || _pinchGestureLock) e.stopPropagation(); // ★ 3u65
      if (e.touches.length === 1 && stateRef.current.scale > 1.02) {
        _pinching = false;
        _panning = true;
        _pinchGestureLock = true;
        _panStart = {
          x: stateRef.current.x,
          y: stateRef.current.y,
          touchX: e.touches[0].clientX,
          touchY: e.touches[0].clientY,
        };
        return;
      }
      if (e.touches.length === 0) {
        if (stateRef.current.scale <= 1.05) {
          stateRef.current = { scale: 1, x: 0, y: 0 };
          applyTransform();
          _pinchGestureLock = false;
        } else {
          _pinchGestureLock = true;
        }
        _pinching = false;
        _panning = false;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isActive, applyTransform]);

  // ★ 3u85: DOM直操作でonLoad fade（progressive JPEG途中描画防止）
  useEffect(() => {
    const main = mainImgRef.current;
    const blur = blurImgRef.current;
    if (!main) return;
    main.style.opacity = "0";
    if (blur) blur.style.opacity = "0";
    const reveal = () => {
      main.style.opacity = "1";
      if (blur) blur.style.opacity = "1";
    };
    if (main.complete) { reveal(); return; }
    main.addEventListener("load", reveal, { once: true });
    return () => main.removeEventListener("load", reveal);
  }, [src]);

  const loadMode = isActive || eager ? "eager" : "lazy";
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden", touchAction: "pan-y", position: "relative", background: "#111", ...style }}>
      {/* ★ 3u61: TikTok本家方式 — blur背景で上下黒帯を消す */}
      <img
        ref={blurImgRef}
        src={src}
        loading={loadMode}
        alt=""
        draggable={false}
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          objectFit: "cover", filter: "blur(20px) brightness(0.4)", transform: "scale(1.1)",
          pointerEvents: "none", zIndex: 0,
        }}
      />
      {/* 主画像: contain で全体表示 */}
      <img
        ref={mainImgRef}
        src={src}
        loading={loadMode}
        style={{
          position: "relative", width: "100%", height: "100%",
          objectFit: "contain", transformOrigin: "center center", zIndex: 1,
        }}
        alt=""
        draggable={false}
      />
    </div>
  );
}

// ========== MediaCell — TikTok方式: active=play, else=stop ==========

export function MediaCell({
  item,
  isActive,
  vehicleId,
  keepBuffered: _kb,
}: {
  item: MediaItem;
  isActive: boolean;
  vehicleId: number;
  keepBuffered?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbRef = useRef<HTMLImageElement>(null);
  const shouldMaterialize = isActive || !!_kb;

  // 画像の場合
  if (item.type === "image") {
    if (!shouldMaterialize) {
      return <div style={{ width: "100%", height: "100%", background: "#000" }} />;
    }
    return (
      <PinchZoomImage
        src={getImageSrc(item, "md")}
        isActive={isActive}
        eager={shouldMaterialize}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }

  const mp4Url = getMp4UrlForItem(item);
  const thumbUrl = getVideoThumbnailUrl(item);
  const videoId = mp4Url?.match(/([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1];
  const fvd = typeof window !== "undefined" ? (window as any).__FIRST_VIDEO_DATA__ : null;
  const isHeavyFirst = !!(fvd && fvd.bunnyVideoId === videoId && fvd.headVideoEligible === true);

  // ★ v95e: blob URL方式 — fetch()でMP4をメモリに持ち、video.srcにblob URLを設定
  useLayoutEffect(() => {
    const video = videoRef.current;
    const thumb = thumbRef.current;
    remoteLog("EFFECT", vehicleId, "active=", isActive, "video=", !!video, "mp4=", mp4Url?.slice(-20) ?? "NULL");
    if (!video || !mp4Url) return;
    let cancelled = false;
    let cleanups: (() => void)[] = [];

    if (isActive) {
      video.style.opacity = "0";
      if (thumb) thumb.style.opacity = "1";
      // ★ 3u10: FAST PATH — src維持済み+readyState≥2なら即play（INACTIVE-KEEPからの復帰用）
      if (video.src && video.readyState >= 2) {
        video.muted = true;
        video.loop = true;
        remoteLog("ACTIVE-FAST", vehicleId, "rs=", video.readyState);
        try { video.currentTime = 0; } catch {}
        video.play().then(() => {
          video.style.opacity = "1";
          if (thumb) thumb.style.opacity = "0";
          remoteLog("playing-fast", vehicleId);
          if (vehicleId >= 0) {
            const poster = document.getElementById("__cold_poster");
            if (poster) { poster.style.opacity = "0"; setTimeout(() => poster.remove(), 400); }
          }
        }).catch((e: Error) => remoteLog("play-err", vehicleId, "fast", e.name));
        return;
      }

      // ★ debounce廃止 — Gallery再マウント時にcancelされてsrc未設定になる問題修正
      {
        video.muted = true;
        video.loop = true;
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");

        // ★ 3u62: heavy first videoはpreload=metadataで無駄DL抑制（videoId定義後に評価）
        video.preload = isHeavyFirst ? "metadata" : "auto";
        if (isHeavyFirst) remoteLog("HEAVY-PRELOAD-METADATA", vehicleId, videoId?.slice(0, 8));

        let played = false;
        const revealVideo = (tag: string, v: HTMLVideoElement) => {
          if (cancelled) return;
          if (thumb) thumb.style.opacity = "0";
          if (v.style.opacity !== "1") {
            v.style.opacity = "1";
            remoteLog("video-visible", vehicleId, tag);
          }
        };
        const doPlay = (tag: string, v: HTMLVideoElement) => {
          if (played || cancelled) return;
          played = true;
          remoteLog(tag, vehicleId, "rs=", v.readyState);
          v.play().then(() => {
            if (cancelled) return;
            revealVideo(tag, v);
          }).catch((e: Error) => {
            played = false; // AbortError時は再試行可能に戻す
            remoteLog("play-err", vehicleId, tag, e.name);
          });
        };

        // ★ v99a方式: head注入のearly blob fetch結果を最優先チェック
        const w = window as any;
        const earlyBlobUrl = w.__earlyMp4BlobUrl as string | undefined;
        const earlyVideoId = w.__earlyMp4VideoId as string | undefined;
        const hasEarlyPromise = !!(w.__earlyMp4Promise && earlyVideoId === videoId);

        if (earlyBlobUrl && earlyVideoId === videoId) {
          // 初回動画: early blob fetch完了済み → blob URLで即再生
          remoteLog("ACTIVE-EARLY-BLOB", vehicleId, "src=early-blob");
          w.__earlyMp4BlobUrl = null;
          w.__earlyMp4VideoId = null;
          setVideoSource(video, earlyBlobUrl);
          // blobCacheにも保存（戻りスワイプ用）
          if (mp4Url) _blobCache.set(mp4Url, earlyBlobUrl);
          // ★ 3u64: cleanup登録（リスナーリーク修正）
          const onCanPlayEarly = () => doPlay("early-blob-canplay", video);
          const onLoadedDataEarly = () => doPlay("early-blob-loadeddata", video);
          video.addEventListener("canplay", onCanPlayEarly, { once: true });
          video.addEventListener("loadeddata", onLoadedDataEarly, { once: true });
          cleanups.push(() => {
            video.removeEventListener("canplay", onCanPlayEarly);
            video.removeEventListener("loadeddata", onLoadedDataEarly);
          });
        } else if (hasEarlyPromise) {
          // ★ 3u6: direct-first起動（blob全量待ちをやめる）
          // video.srcにdirect URLを即設定 → progressive再生開始
          // early blobはバックグラウンドでcacheに入れるだけ（戻りスクロール用）
          remoteLog("ACTIVE-DIRECT-FIRST", vehicleId, mp4Url.slice(-30));
          setVideoSource(video, mp4Url);
          // early blobが到着したらcacheに入れる（再生中のvideoは切り替えない）
          w.__earlyMp4Promise.then(() => {
            const blobUrl = w.__earlyMp4BlobUrl;
            if (blobUrl && mp4Url) {
              _blobCache.set(mp4Url, blobUrl);
              remoteLog("EARLY-BLOB-CACHED", vehicleId, "for-reuse");
            }
            w.__earlyMp4BlobUrl = null;
            w.__earlyMp4VideoId = null;
          }).catch(() => {});
          const onLoadedDataDirect = () => doPlay("loadeddata-play", video);
          video.addEventListener("loadeddata", onLoadedDataDirect, { once: true });
          cleanups.push(() => video.removeEventListener("loadeddata", onLoadedDataDirect));

          const onCanPlayDirect = () => doPlay("canplay", video);
          video.addEventListener("canplay", onCanPlayDirect, { once: true });
          cleanups.push(() => video.removeEventListener("canplay", onCanPlayDirect));
        } else {
          // bootstrapなし → blob cache確認 → 通常フロー（キー=mp4Url）
          const cachedBlob = _blobCache.get(mp4Url);
          if (cachedBlob) {
            // blob cache HIT → メモリ上のデータで即再生
            // ★ cacheは削除しない（戻りスクロールで再利用）
            remoteLog("ACTIVE-BLOB", vehicleId, mp4Url.slice(-30));
            setVideoSource(video, cachedBlob);
          } else {
            // prefetchなし → direct URL
            remoteLog("ACTIVE-DIRECT", vehicleId, mp4Url.slice(-30));
            setVideoSource(video, mp4Url);
          }

          const onLoadedData2 = () => doPlay("loadeddata-play", video);
          video.addEventListener("loadeddata", onLoadedData2, { once: true });
          cleanups.push(() => video.removeEventListener("loadeddata", onLoadedData2));

          const onCanPlay2 = () => doPlay("canplay", video);
          video.addEventListener("canplay", onCanPlay2, { once: true });
          cleanups.push(() => video.removeEventListener("canplay", onCanPlay2));
        }

        // ★ 3u22: 3秒 play safety net（rs≥2のみ。rs<2はloadeddata/canplayリスナーに委任）
        if (!earlyBlobUrl) {
          const activeVideo = video;
          const fallbackTimer = setTimeout(() => {
            if (played || cancelled) return;
            if (activeVideo.readyState < 2) {
              remoteLog("timeout-3s-skip", vehicleId, "rs=", activeVideo.readyState);
              return;
            }
            remoteLog("timeout-3s", vehicleId, "rs=", activeVideo.readyState);
            doPlay("timeout-3s", activeVideo);
          }, 3000);
          cleanups.push(() => clearTimeout(fallbackTimer));
        }

        const onPlaying = () => {
          if (cancelled) return;
          revealVideo("playing", video);
          remoteLog("playing", vehicleId);
          if (isHeavyFirst) (window as any).__FIRST_VIDEO_DATA__ = null; // 3u84: 初回cold限定に制限
          if (vehicleId >= 0) {
            const poster = document.getElementById("__cold_poster");
            if (poster) { poster.style.opacity = "0"; setTimeout(() => poster.remove(), 400); }
          }
        };
        video.addEventListener("playing", onPlaying, { once: true });
        cleanups.push(() => video.removeEventListener("playing", onPlaying));

        const onLoadedData = () => remoteLog("loadeddata", vehicleId, "rs=", video.readyState);
        const onError = () => remoteLog("error", vehicleId, video.error?.code, video.error?.message);
        video.addEventListener("loadeddata", onLoadedData, { once: true });
        video.addEventListener("error", onError, { once: true });
        cleanups.push(() => {
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("error", onError);
        });
      }

      cleanups.push(() => {
        cancelled = true;
        // ★ 3u59: cleanup時にthumb復帰保険（AbortErrorで黒残留防止）
        if (thumb) thumb.style.opacity = "1";
        video.style.opacity = "0";
      });
      return () => cleanups.forEach(fn => fn());

    } else if (_kb && mp4Url) {
      // ── PRECONNECT: 隣接車両 — pause + src保護のみ ──
      video.preload = "none"; // 3u87: 非active時の追加fetch抑制
      video.pause();
      video.style.opacity = "0";
      if (thumb) thumb.style.opacity = "1";
      if (_blobCache.has(mp4Url)) {
        remoteLog("PRECONNECT-CACHED", vehicleId, mp4Url.slice(-25));
      } else {
        remoteLog("PRECONNECT", vehicleId, mp4Url.slice(-25));
      }
    } else if (_kb) {
      // ★ 3u10: INACTIVE-KEEP — ±1隣接はsrc維持+pauseのみ（FAST PATH復帰用）
      video.preload = "none"; // 3u87: 非active時の追加fetch抑制
      video.pause();
      video.style.opacity = "0";
      if (thumb) thumb.style.opacity = "1";
      remoteLog("INACTIVE-KEEP", vehicleId, "rs=", video.readyState);
    } else {
      // ── INACTIVE: src完全削除、ブラウザHTTPキャッシュに頼る ──
      if (!video.src && !video.getAttribute("src")) return; // 3u79: srcなしは空振り抑制
      video.pause();
      video.style.opacity = "0";
      if (thumb) thumb.style.opacity = "1";
      remoteLog("INACTIVE", vehicleId);
      video.preload = "none"; // 3u82: ACTIVE時のauto/metadataを戻し再fetch抑制
      clearVideoSource(video);
    }
  }, [isActive, _kb, mp4Url, vehicleId]);

  const fillStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
  };

  return (
    <div style={{ ...fillStyle, backgroundColor: "#000" }}>
      {/* ★ v93l: TikTok本家丸パクリ — img(下)→video(上)。videoが再生するとimgを自然に隠す */}
      {thumbUrl && shouldMaterialize && (
        <img
          ref={thumbRef}
          src={thumbUrl}
          loading="eager"
          alt=""
          style={{ ...fillStyle, objectFit: "cover", zIndex: 3, opacity: 1, transition: "opacity 0.15s linear", pointerEvents: "none" }}
        />
      )}
      <video
        ref={videoRef}
        muted
        playsInline
        preload={isActive ? "auto" : "none"}
        style={{ ...fillStyle, objectFit: "cover", zIndex: 2, background: "transparent", opacity: 0 }}
      />
    </div>
  );
}

// ========== 詳細シート ==========

export function DetailSheet({ vehicle, onClose }: { vehicle: VehicleData; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "relative", zIndex: 1, background: "#1a1a1a",
          borderTopLeftRadius: "20px", borderTopRightRadius: "20px",
          maxHeight: "70vh", overflowY: "auto", padding: "24px 20px",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
        <h3 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>{vehicle.title}</h3>
        <p style={{ color: "#f59e0b", fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>{vehicle.price}</p>
        {vehicle.description ? (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: "1.8", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {vehicle.description}
          </p>
        ) : (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            詳細情報はまだ登録されていません
          </p>
        )}
      </div>
    </div>
  );
}

// ========== VehicleCell — 横スクロールメディアカルーセル ==========

function VehicleCell({
  vehicle,
  isActive,
  isAdjacent,
  isPreconnect,
  activeMediaIdx,
  onMediaIdxChange,
}: {
  vehicle: VehicleData;
  isActive: boolean;
  isAdjacent?: boolean;
  isPreconnect?: boolean;
  activeMediaIdx: number;
  onMediaIdxChange: (idx: number) => void;
}) {
  const hScrollRef = useRef<HTMLDivElement>(null);
  const hAnimatingRef = useRef(false); // ★ 3u58: hQuickScrollアニメ中フラグ（useEffect間共有）
  const activeMediaIdxRef = useRef(activeMediaIdx);
  const [showDetail, setShowDetail] = useState(false);
  const media = useMemo(() =>
    (vehicle.media ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [vehicle.media],
  );
  const statusBadge = getStatusBadge(vehicle);

  useEffect(() => {
    activeMediaIdxRef.current = activeMediaIdx;
  }, [activeMediaIdx]);

  // ★ 横スワイプ — overflow:hidden + JS完全制御（v55b実績方式、Codex合意済み）
  useEffect(() => {
    const el = hScrollRef.current;
    if (!el || !isActive) return;

    let _hAnimId: number | null = null;
    let _startX = 0;
    let _startY = 0;
    let _startScroll = 0;
    let _startTime = 0;
    let _startIdx = 0;
    let _dir: "none" | "h" | "v" = "none";
    let _pointerActive = false;
    let _scrollTimer: ReturnType<typeof setTimeout> | null = null;

    // ★ 3u60: 完了時にactiveMediaIdxRef * el.clientWidthで再計算確定（リサイズズレ防止）
    const hQuickScroll = (target: number, onDone?: () => void) => {
      if (_hAnimId) cancelAnimationFrame(_hAnimId);
      const start = el.scrollLeft;
      const diff = target - start;
      if (Math.abs(diff) < 1) { el.scrollLeft = target; hAnimatingRef.current = false; onDone?.(); return; }
      hAnimatingRef.current = true;
      const t0 = performance.now();
      const dur = 250;
      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.scrollLeft = start + diff * ease;
        if (p < 1) { _hAnimId = requestAnimationFrame(step); }
        else {
          // ★ 3u60: 完了時にclientWidthを再取得してpx確定
          el.scrollLeft = activeMediaIdxRef.current * el.clientWidth;
          _hAnimId = null; hAnimatingRef.current = false; onDone?.();
        }
      };
      _hAnimId = requestAnimationFrame(step);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (_pinchGestureLock || e.touches.length >= 2) {
        _dir = "none";
        return;
      }
      if (_hAnimId) {
        cancelAnimationFrame(_hAnimId); _hAnimId = null;
        hAnimatingRef.current = false;
        // ★ 3u60: キャンセル時にactiveMediaIdxRef基準でスナップ（clientWidth再取得）
        el.scrollLeft = activeMediaIdxRef.current * el.clientWidth;
      }
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
      _startScroll = el.scrollLeft;
      _startTime = performance.now();
      _dir = "none";
      const w = el.clientWidth;
      _startIdx = w > 0 ? Math.round(_startScroll / w) : 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (_pinchGestureLock) {
        _dir = "none";
        e.preventDefault();
        return;
      }
      const dx = e.touches[0].clientX - _startX;
      const dy = e.touches[0].clientY - _startY;
      if (_dir === "none" && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        // 斜めスワイプでも横寄りなら横扱い（dx*0.7 >= dy）
        _dir = Math.abs(dx) >= Math.abs(dy) * 0.7 ? "h" : "v";
      }
      if (_dir === "h") {
        e.preventDefault();
        e.stopPropagation();
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollLeft = Math.max(0, Math.min(maxScroll, _startScroll - dx));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (_pinchGestureLock) {
        _dir = "none";
        return;
      }
      if (_dir !== "h") return;
      e.stopPropagation();
      const w = el.clientWidth;
      if (w === 0) return;
      const deltaX = _startX - e.changedTouches[0].clientX;
      const elapsed = performance.now() - _startTime;
      const absDelta = Math.abs(deltaX);
      const velocity = absDelta / elapsed;
      const maxIdx = media.length - 1;
      let targetIdx: number;
      if (absDelta > w * 0.08 || velocity > 0.15) {
        targetIdx = deltaX > 0
          ? Math.min(_startIdx + 1, maxIdx)
          : Math.max(_startIdx - 1, 0);
      } else {
        targetIdx = _startIdx;
      }
      // ★ 3u57: 即座にactiveMediaIdx更新（黒画面防止）
      onMediaIdxChange(targetIdx);
      hQuickScroll(targetIdx * w);
    };

    const onTouchCancel = () => {
      // touchcancel → 開始indexに戻す（Codex合意）
      if (_dir === "h") {
        const w = el.clientWidth;
        if (w > 0) hQuickScroll(_startIdx * w);
      }
      _dir = "none";
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (_hAnimId) {
        cancelAnimationFrame(_hAnimId); _hAnimId = null;
        hAnimatingRef.current = false;
        // ★ 3u60: activeMediaIdxRef基準でスナップ
        el.scrollLeft = activeMediaIdxRef.current * el.clientWidth;
      }
      _pointerActive = true;
      _startX = e.clientX;
      _startY = e.clientY;
      _startScroll = el.scrollLeft;
      _startTime = performance.now();
      _dir = "none";
      const w = el.clientWidth;
      _startIdx = w > 0 ? Math.round(_startScroll / w) : 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!_pointerActive || e.pointerType === "touch") return;
      const dx = e.clientX - _startX;
      const dy = e.clientY - _startY;
      if (_dir === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        _dir = Math.abs(dx) >= Math.abs(dy) * 0.7 ? "h" : "v";
      }
      if (_dir === "h") {
        e.preventDefault();
        e.stopPropagation();
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollLeft = Math.max(0, Math.min(maxScroll, _startScroll - dx));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!_pointerActive || e.pointerType === "touch") return;
      _pointerActive = false;
      if (_dir !== "h") return;
      e.stopPropagation();
      const w = el.clientWidth;
      if (w === 0) return;
      const deltaX = _startX - e.clientX;
      const elapsed = performance.now() - _startTime;
      const absDelta = Math.abs(deltaX);
      const velocity = absDelta / elapsed;
      const maxIdx = media.length - 1;
      const targetIdx = (absDelta > w * 0.08 || velocity > 0.15)
        ? (deltaX > 0 ? Math.min(_startIdx + 1, maxIdx) : Math.max(_startIdx - 1, 0))
        : _startIdx;
      // ★ 3u57: 即座にactiveMediaIdx更新（黒画面防止）
      onMediaIdxChange(targetIdx);
      hQuickScroll(targetIdx * w);
    };

    const onPointerCancel = () => {
      if (!_pointerActive) return;
      _pointerActive = false;
      if (_dir === "h") {
        const w = el.clientWidth;
        if (w > 0) hQuickScroll(_startIdx * w);
      }
      _dir = "none";
    };

    // ★ 3u57: onScroll二重更新ガード — hQuickScrollアニメ中はスキップ
    const onScroll = () => {
      if (_hAnimId) return; // アニメ中はtouchEnd/pointerUpで既に更新済み
      if (_scrollTimer) clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(() => {
        if (_hAnimId) return;
        const w = el.clientWidth;
        if (w <= 0) return;
        const idx = Math.max(0, Math.min(media.length - 1, Math.round(el.scrollLeft / w)));
        if (idx !== activeMediaIdxRef.current) {
          onMediaIdxChange(idx);
        }
      }, 120);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp, { passive: true });
    el.addEventListener("pointercancel", onPointerCancel, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("scroll", onScroll);
      if (_scrollTimer) clearTimeout(_scrollTimer);
      if (_hAnimId) { cancelAnimationFrame(_hAnimId); hAnimatingRef.current = false; }
    };
  }, [isActive, onMediaIdxChange, media.length]);

  // 非active時はスクロール位置リセット
  useEffect(() => {
    if (!isActive && hScrollRef.current) {
      hScrollRef.current.scrollLeft = 0;
    }
  }, [isActive]);

  // 外部状態とDOM位置を同期
  // ★ 3u58: hQuickScrollアニメ中はスキップ（アニメが最終位置を確定する）
  useEffect(() => {
    if (hAnimatingRef.current) return;
    const el = hScrollRef.current;
    if (!el || !isActive) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const target = activeMediaIdx * w;
    if (Math.abs(el.scrollLeft - target) > 1) {
      el.scrollLeft = target;
    }
  }, [activeMediaIdx, isActive]);

  return (
    <>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {/* 横スクロールコンテナ */}
        <div
          ref={hScrollRef}
          className="h-scroll-clip"
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            overflowX: "hidden",
            overflowY: "hidden",
            display: "flex",
            backgroundColor: "#000",
            touchAction: "pan-y",
          }}
        >
          {media.length > 0 ? (
            media.map((item, mIdx) => {
              const isCellActive = isActive && mIdx === activeMediaIdx;
              const cellKey = item.bunnyVideoId ? `mb-${item.bunnyVideoId}` : `m-${vehicle.id}-${item.id}-${mIdx}`;
              return (
                <div
                  key={cellKey}
                  style={{
                    width: "100%", height: "100%", flexShrink: 0,
                    overflow: "hidden", position: "relative",
                    backgroundColor: "#000",
                  }}
                >
                  <MediaCell
                    item={item}
                    isActive={isCellActive}
                    vehicleId={vehicle.id}
                    keepBuffered={isPreconnect && !isCellActive && mIdx === 0}
                  />
                </div>
              );
            })
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.4)", fontSize: "14px",
            }}>
              メディアなし
            </div>
          )}
        </div>

        {/* グラデーション */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.7) 100%)",
          zIndex: 3, pointerEvents: "none",
        }} />

        {/* ステータスバッジ */}
        {statusBadge && (
          <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 35px)", right: "16px", zIndex: 5, pointerEvents: "none" }}>
            <span style={{
              background: statusBadge.bg, color: statusBadge.color,
              fontSize: "11px", fontWeight: "bold",
              padding: "4px 12px", borderRadius: "999px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              {statusBadge.text}
            </span>
          </div>
        )}

        {/* 車両情報オーバーレイ */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 4,
          padding: "0 20px calc(env(safe-area-inset-bottom, 0px) + 64px)",
          pointerEvents: "none",
        }}>
          <h2 style={{ color: "white", fontSize: "22px", fontWeight: "bold", marginBottom: "4px", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
            {vehicle.title}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "18px", fontWeight: "bold", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
            {vehicle.price}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
            style={{
              marginTop: "8px",
              display: "flex", alignItems: "center", gap: "6px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "999px", padding: "6px 14px",
              color: "white", fontSize: "12px", fontWeight: "600",
              cursor: "pointer", pointerEvents: "auto",
            }}
          >
            <Info size={14} />
            車両詳細
          </button>
        </div>

        {/* ドットインジケーター */}
        {media.length > 1 && (
          <DotIndicator
            total={media.length}
            current={activeMediaIdx}
            style={{
              position: "absolute",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 52px)",
              left: "50%", transform: "translateX(-50%)", zIndex: 5,
            }}
          />
        )}
      </div>

      {showDetail && <DetailSheet vehicle={vehicle} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ========== MobileGallery — 縦スクロール + scroll-snap ==========

function MobileGallery({
  vehicles,
  initialVehicleIndex,
  onClose,
  headerSlot,
  footerSlot,
}: {
  vehicles: VehicleData[];
  initialVehicleIndex: number;
  onClose: () => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(initialVehicleIndex);
  const [isSnapSettled, setIsSnapSettled] = useState(true);
  const [mediaIdxMap, setMediaIdxMap] = useState<Record<number, number>>({});
  const activeIdxRef = useRef(initialVehicleIndex);
  const prevActiveIdxRef = useRef(initialVehicleIndex);

  // ★ 車両切替時：前の車両のメディアインデックスを0にリセット
  useEffect(() => {
    const prev = prevActiveIdxRef.current;
    if (prev !== activeIdx && vehicles[prev]) {
      const prevId = vehicles[prev].id;
      setMediaIdxMap(m => ({ ...m, [prevId]: 0 }));
    }
    prevActiveIdxRef.current = activeIdx;
  }, [activeIdx, vehicles]);

  // ★ 3u52: 1 gesture = max 1 slot。縦判定後はnative inertiaを止め、JSだけでsnapさせる
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollStarted = false;
    let _touchAssistTargetSlot: number | null = null;
    let _touchAssistActive = false;
    let _vAnimId: number | null = null;
    let _touchStartY = 0;
    let _touchStartX = 0;
    let _touchStartTime = 0;
    const commitSlot = (slot: number) => {
      const headerOffset = headerSlot ? 1 : 0;
      const vehicleIdx = slot - headerOffset;
      const clamped = Math.max(0, Math.min(vehicleIdx, vehicles.length - 1));
      activeIdxRef.current = clamped;
      setActiveIdx(clamped);
      setIsSnapSettled(true);
    };

    const updateIdx = () => {
      scrollStarted = false;
      const h = el.clientHeight;
      if (h <= 0) return;
      if (el.style.scrollSnapType !== "y mandatory") {
        el.style.scrollSnapType = "y mandatory";
        _touchAssistActive = false;
        _touchAssistTargetSlot = null;
      }
      const headerOffset = headerSlot ? 1 : 0;
      const rawIdx = Math.round(el.scrollTop / h);
      commitSlot(rawIdx);
    };

    // ★ v66f: TikTok風高速スクロールアニメーション（250ms ease-out cubic）
    const vQuickScroll = (target: number) => {
      if (_vAnimId) cancelAnimationFrame(_vAnimId);
      const start = el.scrollTop;
      const diff = target - start;
      if (Math.abs(diff) < 1) { el.scrollTop = target; return; }
      const t0 = performance.now();
      const dur = 250;
      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.scrollTop = start + diff * ease;
        if (p < 1) { _vAnimId = requestAnimationFrame(step); }
        else { _vAnimId = null; }
      };
      _vAnimId = requestAnimationFrame(step);
    };

    const onScroll = () => {
      if (!scrollStarted) {
        scrollStarted = true;
        setIsSnapSettled(false);
      }
      if (_touchAssistTargetSlot !== null) return;
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(updateIdx, 350);
    };

    let _direction: "none" | "h" | "v" = "none";

    const onTouchStart = (e: TouchEvent) => {
      if (_pinchGestureLock || e.touches.length >= 2) {
        _direction = "none";
        return;
      }
      _touchStartY = e.touches[0].clientY;
      _touchStartX = e.touches[0].clientX;
      _touchStartTime = performance.now();
      _direction = "none";
      // ★ snapは即無効化しない — 方向判定後に無効化
    };

    const onTouchMove = (e: TouchEvent) => {
      if (_pinchGestureLock) {
        _direction = "none";
        e.preventDefault();
        return;
      }
      if (_direction === "v") {
        e.preventDefault();
        return;
      }
      if (_direction !== "none") return;
      const dx = Math.abs(e.touches[0].clientX - _touchStartX);
      const dy = Math.abs(e.touches[0].clientY - _touchStartY);
      if (dx > 10 || dy > 10) {
        _direction = dy >= dx ? "v" : "h";
        if (_direction === "v") {
          el.style.scrollSnapType = "none";
          _touchAssistActive = true;
          const headerOffset = headerSlot ? 1 : 0;
          const currentSlot = activeIdxRef.current + headerOffset;
          if (el.clientHeight > 0) el.scrollTop = currentSlot * el.clientHeight;
        }
      }
      if (_direction === "v") e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (_pinchGestureLock) {
        _direction = "none";
        return;
      }
      // 横スワイプだった場合 → 縦は何もしない
      if (_direction === "h" || _direction === "none") {
        if (_touchAssistActive) {
          el.style.scrollSnapType = "y mandatory";
          _touchAssistActive = false;
        }
        return;
      }

      // 縦スワイプ処理
      const deltaY = _touchStartY - e.changedTouches[0].clientY;
      const elapsed = performance.now() - _touchStartTime;
      const h = el.clientHeight;
      if (h === 0) return;

      const absDelta = Math.abs(deltaY);
      const velocity = absDelta / elapsed;
      // ★ v66f: 感度 — 8%以上 OR 0.15px/ms以上
      if (absDelta > h * 0.08 || velocity > 0.15) {
        const headerOffset = headerSlot ? 1 : 0;
        const currentSlot = activeIdxRef.current + headerOffset;
        const maxSlot = (headerSlot ? 1 : 0) + vehicles.length - 1;
        const targetSlot = deltaY > 0
          ? Math.min(currentSlot + 1, maxSlot)
          : Math.max(currentSlot - 1, 0);
        _touchAssistTargetSlot = targetSlot;
        vQuickScroll(targetSlot * h);
      } else {
        // スクロール不足 → スナップバック
        const headerOffset = headerSlot ? 1 : 0;
        const currentSlot = activeIdxRef.current + headerOffset;
        _touchAssistTargetSlot = currentSlot;
        vQuickScroll(currentSlot * h);
      }
      if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
      window.setTimeout(() => {
        const slot = _touchAssistTargetSlot;
        if (slot === null) return;
        el.scrollTop = slot * h;
        _touchAssistTargetSlot = null;
        _touchAssistActive = false;
        el.style.scrollSnapType = "y mandatory";
        commitSlot(slot);
      }, 280);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("scroll", onScroll);
      if (snapTimer) clearTimeout(snapTimer);
      if (_vAnimId) cancelAnimationFrame(_vAnimId);
    };
  }, [vehicles.length, headerSlot]);

  // 初期スクロール位置
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const headerOffset = headerSlot ? 1 : 0;
    const h = el.clientHeight;
    if (h > 0) {
      el.scrollTop = (initialVehicleIndex + headerOffset) * h;
    }
  }, [initialVehicleIndex, headerSlot]);

  // ★ 3u: gallery prefetch / preconnect unlock
  // cold 次カードの黒画面を避けるため、playing まで待たず first loadeddata で解禁する
  const [firstPlayDone, setFirstPlayDone] = useState(false);
  useEffect(() => {
    if (firstPlayDone) return;
    const unlock = (reason: string) => {
      setFirstPlayDone(true);
      remoteLog("first-preconnect-unlocked", 0, reason);
    };
    const onLoadedData = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "VIDEO") unlock("loadeddata");
    };
    const onPlaying = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "VIDEO") unlock("playing");
    };
    document.addEventListener("loadeddata", onLoadedData, { capture: true, once: true });
    document.addEventListener("playing", onPlaying, { capture: true, once: true });
    return () => {
      document.removeEventListener("loadeddata", onLoadedData, { capture: true });
      document.removeEventListener("playing", onPlaying, { capture: true });
    };
  }, [firstPlayDone]);

  useEffect(() => {
    const indices = [activeIdx, activeIdx + 1, activeIdx - 1, activeIdx + 2, activeIdx - 2];
    for (const idx of indices) {
      if (idx < 0 || idx >= vehicles.length) continue;
      const media = (vehicles[idx].media ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      const first = media[0];
      if (!first) continue;
      const isFar = Math.abs(idx - activeIdx) === 2;
      if (isFar && first.type === "image" && !firstPlayDone) continue;
      const url = first.type === "image"
        ? getImageSrc(first, isFar ? "sm" : "md")
        : getVideoThumbnailUrl(first);
      if (!url || _visualPrefetchSeen.has(url)) continue;
      _visualPrefetchSeen.add(url);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      remoteLog("visual-prefetch", vehicles[idx].id, url.slice(-25));
    }
  }, [activeIdx, vehicles, firstPlayDone]);

  // body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // iOS Safari高さ修正
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty("--gallery-slide-h", `${window.innerHeight}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000" }}>
      {/* BUILD_ID stamp */}
      <div style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 6px)", left: "8px",
        zIndex: 99999, background: "rgba(220,0,80,0.92)", color: "white",
        fontSize: "9px", fontFamily: "monospace", fontWeight: "bold",
        padding: "3px 7px", borderRadius: "4px", pointerEvents: "none",
      }}>
        {BUILD_ID}
      </div>

      {/* メインスクロールコンテナ */}
      <div
        ref={containerRef}
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          overflowY: "scroll",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
          overscrollBehaviorY: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {headerSlot && (
          <div style={{
            width: "100%",
            height: "var(--gallery-slide-h, 100vh)",
            scrollSnapAlign: "start", scrollSnapStop: "always",
            flexShrink: 0,
          }}>
            {headerSlot}
          </div>
        )}

        {vehicles.map((v, idx) => {
          // ★ 3u42: snap中もoutgoing車両はACTIVE維持
          // cold直後の即スクロールで first playing を殺さず、poster解除を通す
          const isVehicleActive = idx === activeIdx;
          // ★ v93m: ±2に拡大 — より多くの動画がFAST PATH対象
          const isAdjacent = Math.abs(idx - activeIdx) <= 2 && !isVehicleActive;
          // ★ 3u88: 次側だけPRECONNECT。前カードはINACTIVEに落として重いsrc残留を切る
          // ★ 3u11: snap unsettled時のactiveIdx車両はkeep対象（outgoing Aのsrc維持→FAST PATH復帰用）
          const isPreconnect = (
            (idx === activeIdx + 1 && !isVehicleActive) ||
            (!isSnapSettled && idx === activeIdx)
          );
          return (
            <div
              key={`v-${v.id}`}
              data-vehicle-id={v.id}
              style={{
                width: "100%",
                height: "var(--gallery-slide-h, 100vh)",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <VehicleCell
                vehicle={v}
                isActive={isVehicleActive}
                isAdjacent={isAdjacent}
                isPreconnect={isPreconnect}
                activeMediaIdx={mediaIdxMap[v.id] ?? 0}
                onMediaIdxChange={(mIdx) => setMediaIdxMap(prev => ({ ...prev, [v.id]: mIdx }))}
              />
            </div>
          );
        })}

        {footerSlot && (
          <div style={{
            width: "100%",
            height: "var(--gallery-slide-h, 100vh)",
            scrollSnapAlign: "start", scrollSnapStop: "always",
            flexShrink: 0,
          }}>
            {footerSlot}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== DesktopGallery ==========

function DesktopGallery({
  vehicles, initialVehicleIndex, initialMediaIndex, onClose,
}: {
  vehicles: VehicleData[];
  initialVehicleIndex: number;
  initialMediaIndex: number;
  onClose: () => void;
}) {
  const [vehicleIdx, setVehicleIdx] = useState(initialVehicleIndex);
  const [mediaIdxMap, setMediaIdxMap] = useState<Record<number, number>>(() => {
    const v = vehicles[initialVehicleIndex];
    return v ? { [v.id]: initialMediaIndex } : {};
  });
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const safeVIdx = vehicles.length > 0 ? ((vehicleIdx % vehicles.length) + vehicles.length) % vehicles.length : 0;
  const vehicle = vehicles[safeVIdx] ?? null;
  const vId = vehicle?.id ?? -1;
  const allMedia = useMemo(() => vehicle?.media ?? [], [vehicle?.media]);
  const mIdx = mediaIdxMap[vId] ?? 0;
  const safeMIdx = allMedia.length > 0 ? ((mIdx % allMedia.length) + allMedia.length) % allMedia.length : 0;
  const currentMedia = allMedia[safeMIdx] ?? null;
  const statusBadge = vehicle ? getStatusBadge(vehicle) : null;

  // video要素（DOM直接操作）
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;
    const video = document.createElement("video");
    video.autoplay = true; video.muted = true; video.playsInline = true;
    video.loop = true; video.preload = "auto";
    video.setAttribute("playsinline", "");
    Object.assign(video.style, {
      maxHeight: "calc(100vh - 64px)", maxWidth: "calc(100% - 64px)",
      objectFit: "contain", background: "black", display: "none",
    });
    container.appendChild(video);
    videoElRef.current = video;
    return () => {
      video.pause(); video.removeAttribute("src"); video.load();
      if (container.contains(video)) container.removeChild(video);
      videoElRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    if (!currentMedia || currentMedia.type !== "video") {
      video.pause(); video.removeAttribute("src"); video.load();
      video.style.display = "none";
      return;
    }
    video.style.display = "block";
    const url = getMp4UrlForItem(currentMedia);
    if (url) {
      video.src = url;
      video.play().catch(() => {});
    } else if (currentMedia.url) {
      video.src = currentMedia.url;
      video.play().catch(() => {});
    }
  }, [vId, safeMIdx, currentMedia?.id, currentMedia?.type]);

  const goNextVehicle = useCallback(() => {
    if (vehicles.length <= 1) return;
    const next = (safeVIdx + 1) % vehicles.length;
    setVehicleIdx(next);
    setMediaIdxMap(p => ({ ...p, [vehicles[next]?.id ?? 0]: 0 }));
  }, [vehicles, safeVIdx]);

  const goPrevVehicle = useCallback(() => {
    if (vehicles.length <= 1) return;
    const prev = (safeVIdx - 1 + vehicles.length) % vehicles.length;
    setVehicleIdx(prev);
    setMediaIdxMap(p => ({ ...p, [vehicles[prev]?.id ?? 0]: 0 }));
  }, [vehicles, safeVIdx]);

  const goNextMedia = useCallback(() => {
    if (allMedia.length <= 1) return;
    setMediaIdxMap(p => ({ ...p, [vId]: (safeMIdx + 1) % allMedia.length }));
  }, [allMedia.length, safeMIdx, vId]);

  const goPrevMedia = useCallback(() => {
    if (allMedia.length <= 1) return;
    setMediaIdxMap(p => ({ ...p, [vId]: (safeMIdx - 1 + allMedia.length) % allMedia.length }));
  }, [allMedia.length, safeMIdx, vId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape": onClose(); break;
        case "ArrowUp": e.preventDefault(); goPrevVehicle(); break;
        case "ArrowDown": e.preventDefault(); goNextVehicle(); break;
        case "ArrowLeft": e.preventDefault(); goPrevMedia(); break;
        case "ArrowRight": e.preventDefault(); goNextMedia(); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, goNextVehicle, goPrevVehicle, goNextMedia, goPrevMedia]);

  useEffect(() => {
    let accum = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      accum += e.deltaY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (Math.abs(accum) > 50) { accum > 0 ? goNextVehicle() : goPrevVehicle(); }
        accum = 0;
      }, 80);
    };
    window.addEventListener("wheel", h, { passive: false });
    return () => { window.removeEventListener("wheel", h); if (timer) clearTimeout(timer); };
  }, [goNextVehicle, goPrevVehicle]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex" style={{ zIndex: 9999 }}>
      <button onClick={onClose} className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white">
        <X className="w-5 h-5" />
      </button>

      {/* 左カラム */}
      <div className="w-[420px] flex-shrink-0 bg-zinc-950 flex flex-col overflow-hidden border-r border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <button onClick={goPrevVehicle} className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 text-white/60 hover:text-white">
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className="text-white/60 text-sm font-mono">{safeVIdx + 1} / {vehicles.length}</span>
          <button onClick={goNextVehicle} className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 text-white/60 hover:text-white">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-shrink-0">
          {statusBadge && (
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3" style={{ background: statusBadge.bg, color: statusBadge.color }}>
              {statusBadge.text}
            </span>
          )}
          <h2 className="text-2xl font-bold text-white mb-2">{vehicle?.title}</h2>
          <p className="text-xl font-bold text-amber-400 mb-3">{vehicle?.price}</p>
          {vehicle?.description && (
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap break-words">{vehicle.description}</p>
          )}
        </div>

        {allMedia.length > 0 && (
          <div className="px-6 pb-3 flex items-center gap-2 flex-shrink-0">
            <button onClick={goPrevMedia} className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-white/40 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/50 text-xs font-mono">{safeMIdx + 1} / {allMedia.length}</span>
            <button onClick={goNextMedia} className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-white/40 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-3 gap-2">
            {allMedia.map((m, i) => {
              const thumbSrc = m.type === "image" ? getImageSrc(m, "sm") : getVideoThumbnailUrl(m);
              return (
                <button
                  key={m.id}
                  onClick={() => setMediaIdxMap(p => ({ ...p, [vId]: i }))}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${i === safeMIdx ? "border-white" : "border-transparent"}`}
                >
                  {thumbSrc && <img src={thumbSrc} className="w-full h-full object-cover" alt="" />}
                </button>
              );
            })}
          </div>
          <div className="mt-6 text-xs text-zinc-600 space-y-1">
            <p>↑↓ 車両切替 / ←→ メディア切替 / ESC 閉じる</p>
          </div>
        </div>
      </div>

      {/* 右カラム */}
      <div ref={videoContainerRef} className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {currentMedia?.type === "image" && (
          <img
            key={`dimg-${currentMedia.id}`}
            src={getImageSrc(currentMedia, "md")}
            alt=""
            style={{ maxHeight: "calc(100vh - 64px)", maxWidth: "calc(100% - 64px)", objectFit: "cover" }}
            draggable={false}
          />
        )}
        {!currentMedia && vehicle && (
          <div className="text-center">
            <p className="text-zinc-500 text-sm">この車両にはメディアが登録されていません</p>
          </div>
        )}
        {allMedia.length > 1 && (
          <>
            <button onClick={goPrevMedia} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/60 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goNextMedia} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/60 hover:text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ========== メインコンポーネント ==========

export default function TikTokVideoGallery({
  isOpen, onClose, vehicles,
  initialVehicleIndex = 0, initialMediaIndex = 0,
  headerSlot, footerSlot,
}: TikTokVideoGalleryProps) {
  const isDesktop = useIsDesktop();
  if (!isOpen || vehicles.length === 0) return null;

  const safeVIdx = Math.max(0, Math.min(initialVehicleIndex, vehicles.length - 1));
  const safeMIdx = Math.max(0, initialMediaIndex);

  if (isDesktop) {
    return <DesktopGallery vehicles={vehicles} initialVehicleIndex={safeVIdx} initialMediaIndex={safeMIdx} onClose={onClose} />;
  }

  return (
    <MobileGallery
      vehicles={vehicles}
      initialVehicleIndex={safeVIdx}
      onClose={onClose}
      headerSlot={headerSlot}
      footerSlot={footerSlot}
    />
  );
}
