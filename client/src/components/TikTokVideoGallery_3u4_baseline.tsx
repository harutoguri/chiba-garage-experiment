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

const BUILD_ID = "3u4";

// ★ 3g: blob URLキャッシュ + Promise共有 + AbortController帯域制御
const _blobCache = new Map<string, string>(); // mp4Url → blob URL
const _blobFetching = new Set<string>(); // 取得中のmp4Url
const _blobPromises = new Map<string, Promise<string>>(); // mp4Url → Promise<blobUrl>
const _prefetchAborts = new Map<string, AbortController>(); // 帯域制御用

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

// ========== 初回ACTIVE追跡（debounceスキップ用） ==========
let _firstActiveDone = false;

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
  return null;
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
  const mp4Url = getMp4Url(videoId);
  fetch(mp4Url, { mode: "cors", credentials: "omit" } as RequestInit).catch(() => {});
  // ★ v93h: サムネも先読み — 黒画面防止（sdr-thumb使用）
  fetch(`/api/sdr-thumb/${videoId}`).catch(() => {});
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
  src, isActive, style,
}: {
  src: string;
  isActive: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ scale: 1, x: 0, y: 0 });
  const startRef = useRef({ dist: 0, cx: 0, cy: 0, scale: 1, x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    const el = ref.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const { scale, x, y } = stateRef.current;
    el.style.transform = scale <= 1.02 ? "none" : `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isActive) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      startRef.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        cx: (a.clientX + b.clientX) / 2,
        cy: (a.clientY + b.clientY) / 2,
        scale: stateRef.current.scale,
        x: stateRef.current.x,
        y: stateRef.current.y,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const s = startRef.current;
      stateRef.current.scale = Math.min(5, Math.max(1, s.scale * (dist / s.dist)));
      const cx = (a.clientX + b.clientX) / 2;
      const cy = (a.clientY + b.clientY) / 2;
      stateRef.current.x = s.x + (cx - s.cx);
      stateRef.current.y = s.y + (cy - s.cy);
      applyTransform();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && stateRef.current.scale <= 1.05) {
        stateRef.current = { scale: 1, x: 0, y: 0 };
        applyTransform();
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

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden", touchAction: "pan-y", ...style }}>
      <img
        src={src}
        loading={isActive ? "eager" : "lazy"}
        style={{ width: "100%", height: "100%", objectFit: "contain", transformOrigin: "center center" }}
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
  isPreconnect: _p,
  isSnapSettled: _s,
  allMedia: _a,
}: {
  item: MediaItem;
  isActive: boolean;
  vehicleId: number;
  keepBuffered?: boolean;
  isPreconnect?: boolean;
  isSnapSettled?: boolean;
  allMedia?: MediaItem[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 画像の場合
  if (item.type === "image") {
    return (
      <PinchZoomImage
        src={getImageSrc(item, "md")}
        isActive={isActive}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }

  const mp4Url = getMp4UrlForItem(item);
  const thumbUrl = getVideoThumbnailUrl(item);

  // ★ v95e: blob URL方式 — fetch()でMP4をメモリに持ち、video.srcにblob URLを設定
  useLayoutEffect(() => {
    const video = videoRef.current;
    remoteLog("EFFECT", vehicleId, "active=", isActive, "video=", !!video, "mp4=", mp4Url?.slice(-20) ?? "NULL");
    if (!video || !mp4Url) return;
    let cancelled = false;
    let cleanups: (() => void)[] = [];

    if (isActive) {
      if (vehicleId >= 0) _firstActiveDone = true;

      // ★ debounce廃止 — Gallery再マウント時にcancelされてsrc未設定になる問題修正
      {
        video.muted = true;
        video.loop = true;
        video.preload = "auto";
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");

        // ★ 3b: bootstrap video DOM移動（同一要素再利用、再ダウンロード回避）
        let played = false;
        const doPlay = (tag: string, v: HTMLVideoElement) => {
          if (played || cancelled) return;
          played = true;
          remoteLog(tag, vehicleId, "rs=", v.readyState);
          v.play().catch((e: Error) => remoteLog("play-err", vehicleId, tag, e.name));
        };

        const bootstrap = document.getElementById("__bootstrap_video") as HTMLVideoElement | null;
        const videoId = mp4Url.match(/([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1];
        const bootstrapMatch = videoId && bootstrap?.src?.includes(videoId);

        if (bootstrap && bootstrapMatch) {
          // bootstrap要素をこのcellのコンテナに移動
          const bw = bootstrap.buffered.length ? bootstrap.buffered.end(0) : 0;
          remoteLog("ACTIVE-ADOPT", vehicleId, "rs=", bootstrap.readyState, "paused=", bootstrap.paused, "buffered=", bw.toFixed(1) + "s");
          bootstrap.id = "";
          bootstrap.loop = true;
          bootstrap.style.cssText = "width:100%;height:100%;object-fit:cover;";
          // 元のvideo要素を隠してbootstrapを挿入
          video.style.display = "none";
          video.parentElement?.insertBefore(bootstrap, video);
          // videoRefの代わりにbootstrapで再生
          if (!bootstrap.paused) {
            // 既に再生中! → poster即除去
            remoteLog("ADOPT-PLAYING", vehicleId);
            played = true;
            const poster = document.getElementById("__cold_poster");
            if (poster) { poster.style.opacity = "0"; setTimeout(() => poster.remove(), 400); }
          } else if (bootstrap.readyState >= 2) {
            doPlay("adopt-loaded", bootstrap);
          } else {
            bootstrap.addEventListener("loadeddata", () => doPlay("adopt-loadeddata", bootstrap), { once: true });
            bootstrap.addEventListener("canplay", () => doPlay("adopt-canplay", bootstrap), { once: true });
          }
          const onPlaying = () => {
            if (cancelled) return;
            remoteLog("playing", vehicleId);
            const poster = document.getElementById("__cold_poster");
            if (poster) { poster.style.opacity = "0"; setTimeout(() => poster.remove(), 400); }
          };
          bootstrap.addEventListener("playing", onPlaying, { once: true });
          cleanups.push(() => {
            bootstrap.removeEventListener("playing", onPlaying);
            // cleanup: bootstrapを外して元のvideoに戻す
            if (bootstrap.parentElement) {
              bootstrap.pause();
              bootstrap.removeAttribute("src");
              bootstrap.remove();
            }
            video.style.display = "";
          });
        } else {
          // bootstrapなし → blob cache確認 → 通常フロー（キー=mp4Url）

          // ★ 3u: 他のprefetchをabort（自分のURLは保持）→ 帯域をこの動画に集中
          for (const [url, ac] of _prefetchAborts) {
            if (url !== mp4Url) ac.abort();
          }

          const cachedBlob = _blobCache.get(mp4Url);
          const pendingBlob = _blobPromises.get(mp4Url);
          if (cachedBlob) {
            // blob cache HIT → メモリ上のデータで即再生
            // ★ cacheは削除しない（戻りスクロールで再利用）
            remoteLog("ACTIVE-BLOB", vehicleId, mp4Url.slice(-30));
            video.src = cachedBlob;
            video.load();
          } else if (pendingBlob) {
            // ★ 3x: prefetch進行中（gallery prefetchのみ、他の競合なし）
            // blob到着のみ待ち（video.src設定しない = 接続競合回避）
            remoteLog("ACTIVE-PENDING", vehicleId, mp4Url.slice(-30));
            pendingBlob.then(blobUrl => {
              if (cancelled || played) return;
              if (!blobUrl) {
                // prefetchがabort/失敗 → direct URLにフォールバック
                remoteLog("BLOB-EMPTY-FALLBACK", vehicleId);
                video.src = mp4Url;
                video.load();
                return;
              }
              remoteLog("BLOB-ARRIVE", vehicleId);
              video.src = blobUrl;
              video.load();
              video.addEventListener("canplay", () => doPlay("blob-canplay", video), { once: true });
            }).catch(() => {
              if (cancelled || played) return;
              remoteLog("BLOB-FAIL-FALLBACK", vehicleId);
              video.src = mp4Url;
              video.load();
            });
          } else {
            // prefetchなし → direct URL
            remoteLog("ACTIVE-DIRECT", vehicleId, mp4Url.slice(-30));
            video.src = mp4Url;
            video.load();
          }

          // ★ 3u: post-play-prefetch廃止（gallery useEffectがactiveIdx変更で自動再起動）

          const onLoadedData2 = () => doPlay("loadeddata-play", video);
          video.addEventListener("loadeddata", onLoadedData2, { once: true });
          cleanups.push(() => video.removeEventListener("loadeddata", onLoadedData2));

          const onCanPlay2 = () => doPlay("canplay", video);
          video.addEventListener("canplay", onCanPlay2, { once: true });
          cleanups.push(() => video.removeEventListener("canplay", onCanPlay2));
        }

        // 5秒の最終フォールバック — ACTIVE-PENDINGでblob未到着時にdirect URL設定
        const activeVideo = (bootstrap && bootstrapMatch) ? bootstrap : video;
        const fallbackTimer = setTimeout(() => {
          if (played || cancelled) return;
          // ★ pending blob fetchをabort（帯域をdirect URLに集中）
          const pendingAc = _prefetchAborts.get(mp4Url);
          if (pendingAc) {
            pendingAc.abort();
            remoteLog("timeout-5s-abort-prefetch", vehicleId);
          }
          if (!activeVideo.src || activeVideo.readyState === 0) {
            remoteLog("timeout-5s-fallback-src", vehicleId, mp4Url.slice(-30));
            activeVideo.src = mp4Url;
            activeVideo.load();
          }
          doPlay("timeout-5s", activeVideo);
        }, 5000);
        cleanups.push(() => clearTimeout(fallbackTimer));

        // 通常パスのみ: playing/loadeddata/errorハンドラ（bootstrapパスは独自ハンドラ済み）
        if (!(bootstrap && bootstrapMatch)) {
          const onPlaying = () => {
            if (cancelled) return;
            remoteLog("playing", vehicleId);
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
      }

      cleanups.push(() => { cancelled = true; });
      return () => cleanups.forEach(fn => fn());

    } else if (_kb && mp4Url) {
      // ── PRECONNECT: 隣接車両 — blob prefetch ──
      video.pause();
      video.removeAttribute("src");
      if (!_blobCache.has(mp4Url) && !_blobFetching.has(mp4Url)) {
        _blobFetching.add(mp4Url);
        const ac = new AbortController();
        _prefetchAborts.set(mp4Url, ac);
        remoteLog("PREFETCH-BLOB", vehicleId, mp4Url.slice(-25));
        const p = fetch(mp4Url, { signal: ac.signal })
          .then(r => r.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            _blobCache.set(mp4Url, blobUrl);
            remoteLog("PREFETCH-DONE", vehicleId, mp4Url.slice(-25), (blob.size / 1024 / 1024).toFixed(1) + "MB");
            return blobUrl;
          })
          .catch(() => "")
          .finally(() => { _blobFetching.delete(mp4Url); _prefetchAborts.delete(mp4Url); _blobPromises.delete(mp4Url); });
        _blobPromises.set(mp4Url, p);
      } else if (_blobCache.has(mp4Url)) {
        remoteLog("PRECONNECT-CACHED", vehicleId, mp4Url.slice(-25));
      }
    } else {
      // ── INACTIVE: src完全削除、ブラウザHTTPキャッシュに頼る ──
      video.pause();
      remoteLog("INACTIVE", vehicleId);
      video.removeAttribute("src");
      video.load();
    }
  }, [isActive, _kb, mp4Url, vehicleId]);

  const fillStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
  };

  return (
    <div style={{ ...fillStyle, backgroundColor: "#000" }}>
      {/* ★ v93l: TikTok本家丸パクリ — img(下)→video(上)。videoが再生するとimgを自然に隠す */}
      {thumbUrl && (
        <img
          src={thumbUrl}
          loading="lazy"
          alt=""
          style={{ ...fillStyle, objectFit: "cover", zIndex: 1 }}
        />
      )}
      <video
        ref={videoRef}
        muted
        playsInline
        preload={isActive ? "auto" : "none"}
        style={{ ...fillStyle, objectFit: "cover", zIndex: 2 }}
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

    const hQuickScroll = (target: number, onDone?: () => void) => {
      if (_hAnimId) cancelAnimationFrame(_hAnimId);
      const start = el.scrollLeft;
      const diff = target - start;
      if (Math.abs(diff) < 1) { el.scrollLeft = target; onDone?.(); return; }
      const t0 = performance.now();
      const dur = 250;
      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.scrollLeft = start + diff * ease;
        if (p < 1) { _hAnimId = requestAnimationFrame(step); }
        else { _hAnimId = null; onDone?.(); }
      };
      _hAnimId = requestAnimationFrame(step);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (_hAnimId) { cancelAnimationFrame(_hAnimId); _hAnimId = null; }
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
      _startScroll = el.scrollLeft;
      _startTime = performance.now();
      _dir = "none";
      const w = el.clientWidth;
      _startIdx = w > 0 ? Math.round(_startScroll / w) : 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - _startX;
      const dy = e.touches[0].clientY - _startY;
      if (_dir === "none" && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        // 斜めスワイプでも横寄りなら横扱い（dx*0.7 >= dy）
        _dir = Math.abs(dx) >= Math.abs(dy) * 0.7 ? "h" : "v";
      }
      if (_dir === "h") {
        e.preventDefault();
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollLeft = Math.max(0, Math.min(maxScroll, _startScroll - dx));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (_dir !== "h") return;
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
      hQuickScroll(targetIdx * w, () => onMediaIdxChange(targetIdx));
    };

    const onTouchCancel = () => {
      // touchcancel → 開始indexに戻す（Codex合意）
      if (_dir === "h") {
        const w = el.clientWidth;
        if (w > 0) hQuickScroll(_startIdx * w);
      }
      _dir = "none";
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      if (_hAnimId) cancelAnimationFrame(_hAnimId);
    };
  }, [isActive, onMediaIdxChange, media.length]);

  // 非active時はスクロール位置リセット
  useEffect(() => {
    if (!isActive && hScrollRef.current) {
      hScrollRef.current.scrollLeft = 0;
    }
  }, [isActive]);

  // 外部状態とDOM位置を同期
  useEffect(() => {
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
                  <MediaCell item={item} isActive={isCellActive} vehicleId={vehicle.id} keepBuffered={isPreconnect && !isCellActive && mIdx === 0} />
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

  // ★ v93b: v66f touch-assist復元 — 250ms ease-out rAFアニメーション
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

    const updateIdx = () => {
      scrollStarted = false;
      const h = el.clientHeight;
      if (h <= 0) return;
      const headerOffset = headerSlot ? 1 : 0;
      const rawIdx = Math.round(el.scrollTop / h);
      const vehicleIdx = rawIdx - headerOffset;
      const clamped = Math.max(0, Math.min(vehicleIdx, vehicles.length - 1));
      activeIdxRef.current = clamped;
      setActiveIdx(clamped);
      setIsSnapSettled(true);
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

    const onScrollEnd = () => {
      if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
      if (_touchAssistTargetSlot !== null) {
        const h = el.clientHeight;
        const currentIdx = h > 0 ? Math.round(el.scrollTop / h) : -1;
        if (currentIdx !== _touchAssistTargetSlot) return; // ターゲット未到達
        _touchAssistTargetSlot = null;
        _touchAssistActive = false;
        el.style.scrollSnapType = "y mandatory";
      } else if (_touchAssistActive) {
        _touchAssistActive = false;
        el.style.scrollSnapType = "y mandatory";
      }
      updateIdx();
    };

    const onScroll = () => {
      if (!scrollStarted) {
        scrollStarted = true;
        setIsSnapSettled(false);
      }
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(updateIdx, 350);
    };

    let _direction: "none" | "h" | "v" = "none";

    const onTouchStart = (e: TouchEvent) => {
      _touchStartY = e.touches[0].clientY;
      _touchStartX = e.touches[0].clientX;
      _touchStartTime = performance.now();
      _direction = "none";
      // ★ snapは即無効化しない — 方向判定後に無効化
    };

    const onTouchMove = (e: TouchEvent) => {
      if (_direction !== "none") return;
      const dx = Math.abs(e.touches[0].clientX - _touchStartX);
      const dy = Math.abs(e.touches[0].clientY - _touchStartY);
      if (dx > 10 || dy > 10) {
        _direction = dy >= dx ? "v" : "h";
        if (_direction === "v") {
          el.style.scrollSnapType = "none";
          _touchAssistActive = true;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
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
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("scrollend", onScrollEnd, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("scrollend", onScrollEnd);
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

  // ★ 3u: gallery prefetch — マウント直後に順次実行（isSnapSettled不要）
  // activeIdx変更時も再起動（新しい隣接をfetch）
  useEffect(() => {
    let aborted = false;
    const indices = [activeIdx + 1, activeIdx - 1, activeIdx + 2, activeIdx - 2];
    (async () => {
      for (const idx of indices) {
        if (aborted) break;
        if (idx < 0 || idx >= vehicles.length) continue;
        const v = vehicles[idx];
        const firstVideo = (v.media ?? []).find(m => m.type === "video");
        if (!firstVideo) continue;
        const url = getMp4UrlForItem(firstVideo);
        if (!url || _blobCache.has(url) || _blobFetching.has(url)) continue;
        _blobFetching.add(url);
        const ac = new AbortController();
        _prefetchAborts.set(url, ac);
        remoteLog("prefetch-start", v.id, url.slice(-25));
        const p = fetch(url, { signal: ac.signal })
          .then(r => r.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            _blobCache.set(url, blobUrl);
            remoteLog("prefetch-done", v.id, url.slice(-25), (blob.size / 1024 / 1024).toFixed(1) + "MB");
            return blobUrl;
          })
          .catch(() => "")
          .finally(() => { _blobFetching.delete(url); _prefetchAborts.delete(url); _blobPromises.delete(url); });
        _blobPromises.set(url, p);
        await p; // ★ 3w: 1本ずつ順次（帯域集中、ただしskip分は並行OK）
      }
    })();
    return () => { aborted = true; };
  }, [activeIdx, vehicles]);

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
          const isVehicleActive = idx === activeIdx && isSnapSettled;
          // ★ v93m: ±2に拡大 — より多くの動画がFAST PATH対象
          const isAdjacent = Math.abs(idx - activeIdx) <= 2 && !isVehicleActive;
          // ★ 3e: ±1だけPRECONNECT（video src事前設定、Safari事前バッファリング）
          const isPreconnect = Math.abs(idx - activeIdx) === 1 && !isVehicleActive;
          return (
            <div
              key={v.media?.[0]?.bunnyVideoId ? `vb-${v.media[0].bunnyVideoId}` : `v-${v.id}`}
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
