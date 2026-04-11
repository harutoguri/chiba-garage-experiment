/**
 * frame0Precache.ts — v90d: TikTok本家同等のframe 0 pre-cache system
 *
 * 全車両のHLS frame 0をバックグラウンドで事前デコードしキャッシュ。
 * キャッシュ済みセルはスクロール即座にframe 0表示（JPEG不要、HLS待ち不要）。
 *
 * 品質要件:
 *   - 720p固定（360p→720pステップアップ禁止）
 *   - canvas captureでHDR色空間保持（iOS Safariで目視一致）
 *   - active cellの帯域を邪魔しない（pause機構）
 *
 * 使い方:
 *   import { getFrame0Cached, startFrame0Precache, pausePrecache, resumePrecache } from '@/lib/frame0Precache';
 *
 *   // phase 2で開始
 *   startFrame0Precache(vehicles);
 *
 *   // スクロール中はpause
 *   pausePrecache();
 *   // snap確定後にresume
 *   resumePrecache();
 *
 *   // MediaCell/VehicleSlide: JPEG thumbの代わりに
 *   const cached = getFrame0Cached(vehicleId);
 *   if (cached) { img.src = cached; }
 */

const BUNNY_CDN = 'https://vz-2e234254-464.b-cdn.net';

const _cache = new Map<number, string>(); // vehicleId → blob URL
let _running = false;
let _paused = false;
let _listeners: Array<(vid: number, blobUrl: string) => void> = [];

/** キャッシュ済みframe 0 blob URLを取得。なければnull */
export function getFrame0Cached(vehicleId: number | undefined): string | null {
  if (vehicleId == null) return null;
  return _cache.get(vehicleId) ?? null;
}

/** キャッシュ更新を監視（新しいframe 0がキャッシュされた時に呼ばれる） */
export function onFrame0Cached(cb: (vid: number, blobUrl: string) => void) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter(l => l !== cb); };
}

/** precacheを一時停止（active cellスクロール中） */
export function pausePrecache() { _paused = true; }

/** precacheを再開（snap確定後） */
export function resumePrecache() { _paused = false; }

/** キャッシュ済み数 */
export function getCacheSize(): number { return _cache.size; }

// ========== メモリ管理: Blob URL GC ==========
// Gemini指摘: blob URLはrevokeしないとOOM。activeから遠いものを解放。
const _KEEP_RANGE = 5; // active ±5は保持、それ以外は解放
let _vehicleOrder: number[] = []; // vehicles配列のid順

/** vehicle順序を設定（gallery mountで呼ぶ） */
export function setVehicleOrder(ids: number[]) { _vehicleOrder = ids; }

/** activeIdx更新時にGC実行。遠いblob URLをrevoke */
export function gcFrame0Cache(activeIdx: number) {
  if (_vehicleOrder.length === 0 || _cache.size === 0) return;
  for (const [vid, blobUrl] of _cache) {
    const idx = _vehicleOrder.indexOf(vid);
    if (idx < 0) continue;
    const dist = Math.abs(idx - activeIdx);
    if (dist > _KEEP_RANGE) {
      URL.revokeObjectURL(blobUrl);
      _cache.delete(vid);
      console.log(`[frame0] GC revoked vid=${vid} dist=${dist}`);
    }
  }
}

/** 1車両のframe 0をデコードしてキャッシュ */
function decodeFrame0(bunnyVideoId: string, vehicleId: number): Promise<boolean> {
  return new Promise((resolve) => {
    // ★ v92a: MP4直接再生（HLS撤去）— faststart MP4はframe 0が先頭にある
    const url = `${BUNNY_CDN}/${bunnyVideoId}/play_720p.mp4`;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.crossOrigin = 'anonymous'; // ★ v92a: CORS — canvas toBlob() の Tainted canvas 回避
    video.preload = 'auto';
    // 画面外に配置
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(video);

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
      } catch {}
    };

    // 8秒タイムアウト
    const timer = setTimeout(() => {
      console.log(`[frame0] timeout vid=${vehicleId}`);
      cleanup();
      resolve(false);
    }, 8000);

    const captureFrame = () => {
      if (settled) return;
      // videoWidth/Heightが確定するまで待つ
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        requestAnimationFrame(() => requestAnimationFrame(captureFrame));
        return;
      }
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { clearTimeout(timer); cleanup(); resolve(false); return; }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
          clearTimeout(timer);
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            _cache.set(vehicleId, blobUrl);
            console.log(`[frame0] OK vid=${vehicleId} ${w}x${h} size=${blob.size}`);
            // リスナーに通知
            for (const cb of _listeners) {
              try { cb(vehicleId, blobUrl); } catch {}
            }
          } else {
            console.log(`[frame0] blob null vid=${vehicleId}`);
          }
          cleanup();
          resolve(!!blob);
        }, 'image/webp', 0.85);
      } catch (e) {
        console.log(`[frame0] err vid=${vehicleId}`, e);
        clearTimeout(timer);
        cleanup();
        resolve(false);
      }
    };

    // loadeddata → seek(0)確認 → captureFrame
    video.addEventListener('loadeddata', () => {
      if (video.currentTime > 0.01) {
        video.currentTime = 0;
        video.addEventListener('seeked', captureFrame, { once: true });
      } else if (video.readyState >= 2 && video.videoWidth > 0) {
        captureFrame();
      } else {
        video.addEventListener('canplay', captureFrame, { once: true });
      }
    }, { once: true });

    video.addEventListener('error', () => {
      console.log(`[frame0] HLS error vid=${vehicleId}`);
      clearTimeout(timer);
      cleanup();
      resolve(false);
    }, { once: true });

    // iOS Safari: native HLS — src直接設定
    video.src = url;
    video.load();
  });
}

/** 全車両のframe 0をバックグラウンドで順次プリキャッシュ */
export async function startFrame0Precache(
  vehicles: Array<{ id: number; media?: Array<{ type: string; bunnyVideoId?: string }> }>
) {
  if (_running) return;
  _running = true;
  console.log(`[frame0] precache start count=${vehicles.length}`);

  for (const v of vehicles) {
    // pause中は待機
    while (_paused) {
      await new Promise(r => setTimeout(r, 300));
    }

    // 既にキャッシュ済みならスキップ
    if (_cache.has(v.id)) continue;

    // 最初のvideo mediaのbunnyVideoIdを取得
    const videoMedia = v.media?.find(m => m.type === 'video' && m.bunnyVideoId);
    if (!videoMedia || !videoMedia.bunnyVideoId) continue;

    await decodeFrame0(videoMedia.bunnyVideoId, v.id);

    // 連続リクエスト防止: 200ms間隔
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[frame0] precache done cached=${_cache.size}/${vehicles.length}`);
  _running = false;
}
