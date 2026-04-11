/**
 * VideoFeed v16
 *
 * ★ v16 (v69): COLD初回表示高速化
 *   - index.html の Early API fetch データを即座に消費（API待ちゼロ）
 *   - COLD時: firstVideoフェッチをスキップ → 帯域をHLSに集中
 *   - WARM時: 従来通りsessionStorage + firstVideo fetch
 *
 * v15: 初回1本目最速再生
 * v14: 初回動画早期プリロード対応
 * v11: vehicles.listWithMedia（1リクエスト）で vehicles+media を同時取得。
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import TikTokVideoGallery, { startEarlyPreload, MediaCell } from "@/components/TikTokVideoGallery";
import type { VehicleData, MediaItem } from "@/components/TikTokVideoGallery";
import { getBunnyHlsUrl, getBunnyThumbnailUrl } from "@/lib/bunnyUrls";
import { ct, ctNet, coldContext, forceCold, formatLiveLog, onCtUpdate } from "@/lib/cold-timing";

// ─── タイミング計測: モジュールロード時刻 ───
const T_MODULE = performance.now();
const SESSION_KEY = "chiba_first_hls_v1";

// ★ v68b: COLD/WARM判定を明示化 + warmReasons
const _hasSessionCache = (() => {
  if (forceCold) return false; // ?cold=1: キャッシュ無視
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
})();
coldContext.hasSessionCache = _hasSessionCache;
if (_hasSessionCache) coldContext.warmReasons.push(`sessionStorage:${SESSION_KEY}`);
const _mode = forceCold ? "FORCED-COLD" : _hasSessionCache ? "WARM" : "COLD";
// ★ v87b: head_start→module_load 差分 = JS DL+パース時間
const _headStart = (window as any).__t_head_start ?? 0;
const _jsParseDur = _headStart > 0 ? T_MODULE - _headStart : -1;
ct("module_load", `${_mode} navType=${coldContext.navType} head→module=${_jsParseDur.toFixed(0)}ms`);
console.log(`%c[TIMING] t0_module_load: +${T_MODULE.toFixed(0)}ms from navStart | head_start=${_headStart.toFixed(0)}ms | JS_DL+parse=${_jsParseDur.toFixed(0)}ms | ${_mode}`, "color:#0ff;font-weight:bold");

// ★ v69: index.html Early fetchデータ取得（module_load時には到着済み）
const _earlyListData: any = (window as any).__earlyListWithMediaData ?? null;
const _earlyListTime: number = (window as any).__earlyListWithMediaTime ?? -1;
if (_earlyListData) {
  ct("early_listWithMedia_available", `vehicles=${_earlyListData.vehicles?.length ?? 0} fetchTime=${_earlyListTime.toFixed(0)}ms`);
} else if ((window as any).__earlyListWithMediaPromise) {
  ct("early_listWithMedia_pending", "API未完了→Promise待ち(正常)");
} else {
  ct("early_listWithMedia_NOT_available", "promise not found");
}

// ★ v69: earlyListWithMediaから最初の動画bunnyVideoIdを導出
function _deriveFirstVideoFromList(data: any): string | null {
  if (!data?.vehicles?.length || !data?.mediaMap) return null;
  for (const v of data.vehicles) {
    const media = data.mediaMap[v.id];
    if (!media?.length) continue;
    const sorted = [...media].sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const vid = sorted.find((m: any) => m.type === 'video' && m.bunnyVideoId);
    if (vid) return vid.bunnyVideoId;
  }
  return null;
}

// ★ v69: firstVideo取得戦略
// ★ v87l: __FIRST_VIDEO_DATA__ (サーバー埋め込み) → 同期消費、API待ちゼロ
// COLD/FORCED-COLD: 埋め込みデータ優先、なければ earlyListWithMedia から導出
// WARM: 従来通り直接fetch（tRPCバッチバイパス）
let _firstVideoBunnyId: string | null = null;
let _firstVideoFetchDone = false;
const _isCold = _mode === "FORCED-COLD" || _mode === "COLD";

// ★ v87l: サーバー埋め込みデータ検出（HTMLパース時にwindowに設定済み）
const _embeddedFirstVideo = (window as any).__FIRST_VIDEO_DATA__ as { bunnyVideoId: string; hlsUrl: string } | null;
if (_embeddedFirstVideo) {
  ct("firstVideo_embedded", `bunnyId=${_embeddedFirstVideo.bunnyVideoId.slice(0, 8)} (server-injected, 0ms)`);
  console.log(`%c[TIMING] firstVideo_embedded: bunnyId=${_embeddedFirstVideo.bunnyVideoId.slice(0, 8)} (0ms API wait)`, "color:#0f0;font-weight:bold;font-size:14px");
}

// ★ 3u8: 埋め込みデータがある時はWARMでもfirstVideo fetchを叩かない
const _firstVideoPromise: Promise<string | null> = _embeddedFirstVideo
  ? (() => {
      // サーバー埋め込みデータ → 同期消費（COLD/WARM問わず、API待ちゼロ）
      _firstVideoBunnyId = _embeddedFirstVideo.bunnyVideoId;
      _firstVideoFetchDone = true;
      const hlsUrl = getBunnyHlsUrl(_embeddedFirstVideo.bunnyVideoId);
      try { sessionStorage.setItem(SESSION_KEY, hlsUrl); } catch {}
      ct("firstVideo_embedded_used", `${_mode} bunnyId=${_embeddedFirstVideo.bunnyVideoId.slice(0, 8)}`);
      return Promise.resolve(_embeddedFirstVideo.bunnyVideoId);
    })()
  : _isCold
    ? (async () => {
        ct("firstVideo_SKIPPED_cold", "deriving from earlyListWithMedia (no embed)");
        const data = _earlyListData ?? await (window as any).__earlyListWithMediaPromise?.catch(() => null);
        const bunnyId = _deriveFirstVideoFromList(data);
        _firstVideoBunnyId = bunnyId;
        _firstVideoFetchDone = true;
        if (bunnyId) {
          ct("firstVideo_from_earlyList", `bunnyId=${bunnyId.slice(0, 8)}`);
          const hlsUrl = getBunnyHlsUrl(bunnyId);
          startEarlyPreload(hlsUrl);
          try { sessionStorage.setItem(SESSION_KEY, hlsUrl); } catch {}
        } else {
          ct("firstVideo_from_earlyList", "no video found");
        }
        return bunnyId;
      })()
    : (async () => {
        // WARM + 埋め込みなし: 従来通り直接fetch
        const t0 = performance.now();
        try {
          ct("firstVideo_fetch_start");
          console.log(`%c[TIMING] firstVideo_fetch_start: +${t0.toFixed(0)}ms from navStart`, "color:#ff0;font-weight:bold");
          const res = await fetch('/api/trpc/vehicles.firstVideo?input=%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D');
          const json = await res.json();
          const bunnyId = json?.result?.data?.json?.bunnyVideoId ?? null;
          _firstVideoBunnyId = bunnyId;
          _firstVideoFetchDone = true;
          const t1 = performance.now();
          ctNet("firstVideo_fetch_end", t0, t1, `bunnyId=${bunnyId?.slice(0, 8) ?? 'null'}`);
          console.log(`%c[TIMING] firstVideo_fetch_end: +${t1.toFixed(0)}ms from navStart | ${(t1 - t0).toFixed(0)}ms | bunnyId=${bunnyId?.slice(0, 8) ?? 'null'}`, "color:#ff0;font-weight:bold");
          if (bunnyId) {
            const hlsUrl = getBunnyHlsUrl(bunnyId);
            startEarlyPreload(hlsUrl);
            try { sessionStorage.setItem(SESSION_KEY, hlsUrl); } catch {}
          }
          return bunnyId;
        } catch (e) {
          ct("firstVideo_fetch_fail", String(e));
          _firstVideoFetchDone = true;
          return null;
        }
      })();

// ★ モジュールロード時: sessionStorage から即プリロード開始（従来通り）
// ?cold=1: early preload スキップ（新規客初回を再現）
if (forceCold) {
  ct("early_preload_SKIPPED", "forceCold=true");
} else {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      coldContext.hasEarlyPreload = true;
      coldContext.warmReasons.push(`earlyPreload:${SESSION_KEY}`);
      ct("early_preload_from_session", cached.slice(-40));
      startEarlyPreload(cached);
    }
  } catch { /* sessionStorage unavailable */ }
}

interface VehicleMedia {
  id: number;
  vehicleId: number;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  bunnyVideoId: string | null;
  displayOrder: number | null;
  isMain: boolean | null;
  optimizedUrls?: string | null;
}

interface Vehicle {
  id: number;
  title: string;
  price: number | null;
  priceDisplay: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl?: string | null;
  description: string | null;
  status: "在庫あり" | "商談中" | "売約済み";
  displayOrder: number | null;
  isPublished: boolean | null;
  isConsignment?: boolean | null;
}

function getPriceDisplay(car: Vehicle | Record<string, unknown>) {
  if ("priceDisplay" in car && typeof car.priceDisplay === "string" && car.priceDisplay) {
    const numStr = (car.priceDisplay as string).replace(/[^0-9]/g, "");
    if (numStr) {
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > 0) return `¥${num.toLocaleString()}-`;
    }
  }
  if ("price" in car) {
    if (typeof car.price === "string" && car.price.trim() !== "") {
      const numPrice = parseInt(car.price.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numPrice) && numPrice > 0) return `¥${numPrice.toLocaleString()}-`;
    }
    if (typeof car.price === "number" && car.price > 0) return `¥${car.price.toLocaleString()}-`;
  }
  return "ASK";
}

export default function VideoFeed() {
  // ★ 診断ヘルパー
  const _pd = (msg: string) => { try { (window as any).__pd?.(msg); } catch {} };
  _pd('VF render');

  // ─── タイミング計測 ───
  const tMountRef = useRef(performance.now());
  useEffect(() => {
    const tMount = tMountRef.current;
    _pd(`VideoFeed mount +${tMount.toFixed(0)}ms`);
    ct("component_mount", `+${(tMount - T_MODULE).toFixed(0)}ms from module`);
    console.log(`%c[TIMING] t_component_mount: +${tMount.toFixed(0)}ms from navStart | +${(tMount - T_MODULE).toFixed(0)}ms from module`, "color:#0ff;font-weight:bold");
  }, []);

  // ★ v68: firstVideo を直接fetch結果から取得（tRPCバッチをバイパス）
  const [firstVideoBunnyId, setFirstVideoBunnyId] = useState<string | null>(_firstVideoBunnyId);
  useEffect(() => {
    if (_firstVideoFetchDone && _firstVideoBunnyId) {
      setFirstVideoBunnyId(_firstVideoBunnyId);
      return;
    }
    _firstVideoPromise.then(id => {
      if (id) setFirstVideoBunnyId(id);
    });
  }, []);

  // ─── listWithMedia: 全車両取得 ───
  // ★ 3u8: earlyListDataがある時はWARMでもtRPC即発火しない（帯域を先頭動画に集中）
  // first playing後 or idle後に解禁して再同期
  const _shouldDelay = _isCold || !!_earlyListData;
  const [trpcEnabled, setTrpcEnabled] = useState(!_shouldDelay);
  const trpcEnabledAtRef = useRef<number>(_shouldDelay ? 0 : performance.now());
  useEffect(() => {
    if (trpcEnabled) return; // 既に有効
    ct("v88s-trpc-delayed", `${_mode} earlyData=${!!_earlyListData} — waiting for playing/gesture/idle`);
    _pd(`v88s-trpc-delayed (${_mode})`);
    let fired = false;
    const enable = (reason: string) => {
      if (fired) return;
      fired = true;
      trpcEnabledAtRef.current = performance.now();
      setTrpcEnabled(true);
      ct(`v88s_trpc_enabled`, `by ${reason} at +${performance.now().toFixed(0)}ms`);
      _pd(`v88s-trpc-enabled by ${reason}`);
      cleanup();
    };
    // ★ 3u8: first playing で解禁（動画再生開始 = 先頭帯域確保済み）
    const onPlaying = () => enable("playing");
    document.addEventListener("playing", onPlaying, { capture: true, once: true });
    // ★ v88s: 最初のユーザー操作で解禁
    const onGesture = () => {
      ct("v88s_first_user_gesture", `at +${performance.now().toFixed(0)}ms`);
      enable("gesture");
    };
    const gestureEvents = ["touchstart", "pointerdown", "wheel", "scroll"] as const;
    for (const ev of gestureEvents) {
      window.addEventListener(ev, onGesture, { once: true, passive: true });
    }
    // ★ 3u29: 初回直後の帯域競合を避けるため、idle強制解禁は遅らせる
    const timer = setTimeout(() => enable("idle_fallback_12s"), 12000);
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("playing", onPlaying, { capture: true });
      for (const ev of gestureEvents) {
        window.removeEventListener(ev, onGesture);
      }
    };
    return cleanup;
  }, [trpcEnabled]);

  const { data: vehiclesWithMedia } = trpc.vehicles.listWithMedia.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: trpcEnabled,
  });

  // ★ v69: earlyListWithMediaデータをPromise経由で非同期取得
  const [earlyListData, setEarlyListData] = useState<any>(_earlyListData);
  useEffect(() => {
    if (earlyListData || vehiclesWithMedia) return; // 既にデータあり
    const p = (window as any).__earlyListWithMediaPromise;
    if (p) {
      p.then((d: any) => {
        if (d) {
          ct("early_listWithMedia_async_consumed");
          setEarlyListData(d);
        }
      });
    }
  }, [earlyListData, vehiclesWithMedia]);

  // ★ v69: tRPC正式データ優先、未到着時はearly fetchデータを使用
  const effectiveData = vehiclesWithMedia ?? earlyListData;
  const dbVehicles = effectiveData?.vehicles;
  const allMediaMap = effectiveData?.mediaMap;
  // ★ v86-diag: データ経路ログ
  _pd(`VF data: trpc=${!!vehiclesWithMedia} early=${!!earlyListData} vehicles=${dbVehicles?.length ?? 'NULL'} firstBunny=${firstVideoBunnyId?.slice(0,8) || 'NULL'}`);

  // ★ v69: earlyListData消費ログ
  const earlyLoggedRef = useRef(false);
  useEffect(() => {
    if (!earlyListData || earlyLoggedRef.current) return;
    earlyLoggedRef.current = true;
    const tNow = performance.now();
    ct("early_listWithMedia_consumed", `vehicles=${earlyListData.vehicles?.length ?? 0} at +${tNow.toFixed(0)}ms`);
  }, [earlyListData]);

  // listWithMedia tRPC到着タイミングを計測
  const apiLoggedRef = useRef(false);
  useEffect(() => {
    if (!vehiclesWithMedia || apiLoggedRef.current) return;
    apiLoggedRef.current = true;
    const tNow = performance.now();
    const trpcDur = trpcEnabledAtRef.current > 0 ? (tNow - trpcEnabledAtRef.current).toFixed(0) : '?';
    ct("v87k-trpc-resolved", `dur=${trpcDur}ms vehicles=${vehiclesWithMedia.vehicles?.length}`);
    ct("api_end_listWithMedia_trpc", `vehicles=${vehiclesWithMedia.vehicles?.length}`);
    console.log(
      `%c[TIMING] t_api_end (listWithMedia tRPC): +${tNow.toFixed(0)}ms | dur=${trpcDur}ms | vehicles=${vehiclesWithMedia.vehicles?.length}`,
      "color:#0f0;font-weight:bold"
    );
  }, [vehiclesWithMedia]);

  const vehicleList: Vehicle[] = useMemo(() => dbVehicles ?? [], [dbVehicles]);

  // VehicleData[]を構築（メディアがある車両のみ）
  const galleryVehicles: VehicleData[] = useMemo(() => {
    return vehicleList
      .map((car) => {
        const v = car as any;
        const mediaData = allMediaMap?.[v.id] as VehicleMedia[] | undefined;

        const mediaItems: MediaItem[] = mediaData
          ? [...mediaData]
              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
              .map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                bunnyVideoId: m.bunnyVideoId,
                thumbnailUrl: m.thumbnailUrl,
                optimizedUrls: m.optimizedUrls || null,
              }))
          : [];

        if (mediaItems.length === 0) {
          if (v.videoUrl) {
            mediaItems.push({
              id: -1,
              type: "video",
              url: v.videoUrl,
              bunnyVideoId: null,
              thumbnailUrl: null,
              optimizedUrls: null,
            });
          }
          if (v.imageUrl) {
            mediaItems.push({
              id: -2,
              type: "image",
              url: v.imageUrl,
              bunnyVideoId: null,
              thumbnailUrl: null,
              optimizedUrls: null,
            });
          } else if (v.thumbnailUrl) {
            mediaItems.push({
              id: -3,
              type: "image",
              url: v.thumbnailUrl,
              bunnyVideoId: null,
              thumbnailUrl: null,
              optimizedUrls: null,
            });
          }
        }

        return {
          id: v.id,
          title: v.title || "",
          price: getPriceDisplay(v),
          description: v.description,
          media: mediaItems,
          status: v.status || "在庫あり",
          isConsignment: v.isConsignment === true,
        };
      })
      .filter((v) => v.media.length > 0);
  }, [vehicleList, allMediaMap]);

  // ─── galleryVehicles確定時: 正確な1本目のHLS URLをsessionStorageに保存 ───
  const galleryRenderCountRef = useRef(0);
  useEffect(() => {
    if (galleryVehicles.length === 0) return;

    galleryRenderCountRef.current++;
    const tNow = performance.now();
    const firstMedia = galleryVehicles[0].media.find(m => m.type === "video");
    ct("gallery_render", `#${galleryRenderCountRef.current} vehicles=${galleryVehicles.length}`);
    // ★ v88p: gallery_render #2以降 = 全車両データ到着 → full_data_ready
    if (galleryRenderCountRef.current >= 2) {
      ct("full_data_ready", `vehicles=${galleryVehicles.length} at +${tNow.toFixed(0)}ms`);
    }
    console.log(
      `%c[TIMING] t_gallery_render #${galleryRenderCountRef.current}: +${tNow.toFixed(0)}ms from navStart | vehicles=${galleryVehicles.length} | firstHls=${firstMedia?.bunnyVideoId?.slice(0, 8) ?? "none"}`,
      "color:#0f0;font-weight:bold"
    );

    const firstVideo = galleryVehicles[0].media.find(
      (m) => m.type === "video" && m.bunnyVideoId
    );
    if (firstVideo?.bunnyVideoId) {
      const hlsUrl = getBunnyHlsUrl(firstVideo.bunnyVideoId);
      try { sessionStorage.setItem(SESSION_KEY, hlsUrl); } catch {}
    }
  }, [galleryVehicles]);

  // ★ v93m: bootstrap復活（早期src設定でplaying高速化）
  // ただしcold_posterフェードアウトは本物cell(vehicleId>=0)限定
  const bootstrapVehicle: VehicleData | null = useMemo(() => {
    if (galleryVehicles.length > 0) return null;
    if (!firstVideoBunnyId) return null;
    return {
      id: -999,
      title: "",
      price: "",
      description: null,
      media: [{
        id: -999,
        type: "video" as const,
        url: "",
        bunnyVideoId: firstVideoBunnyId,
        thumbnailUrl: getBunnyThumbnailUrl(firstVideoBunnyId),
        optimizedUrls: null,
      }],
      status: "在庫あり" as const,
      isConsignment: false,
    };
  }, [firstVideoBunnyId, galleryVehicles.length]);

  // ★ bootstrap廃止 — 1台→19台切替でGalleryのactive管理が壊れるため
  // earlyListDataは~0.6sで到着するのでcold_posterでカバー
  const displayVehicles = useMemo(() => {
    if (galleryVehicles.length > 0) return galleryVehicles;
    return [];
  }, [galleryVehicles]);

  // ★ v93m: データ未到着時はcold_posterが表示されたまま待機（bootstrap廃止）
  _pd(`VF display: gallery=${galleryVehicles.length}`);
  if (displayVehicles.length === 0) {
    _pd(`VF BAIL: no vehicles (early=${!!earlyListData} trpc=${!!vehiclesWithMedia})`);
    return (
      // ★ v88i: fixed+inset0+z-9999 で bottom nav を隠す（下の読み込みバー対策）
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  // ★ v87l: ?mini=1 — ギャラリーなし単一動画（本体 vs solo.html 中間テスト）
  // React + MediaCell + attachAndPlay 経路は同一、scroll-snap/carousel/他車両なし
  const _isMini = new URLSearchParams(window.location.search).get("mini") === "1";
  if (_isMini) {
    const firstVehicle = displayVehicles[0];
    const firstVideo = firstVehicle?.media?.find(m => m.type === "video");
    _pd(`VF → MINI mode vid=${firstVehicle?.id} bunny=${firstVideo?.bunnyVideoId?.slice(0,8)}`);
    ct("mini_mode", `vid=${firstVehicle?.id} bunny=${firstVideo?.bunnyVideoId?.slice(0,8)}`);
    if (!firstVideo) {
      return <div style={{ width: "100vw", height: "100dvh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>No video found</div>;
    }
    return (
      <>
        <div style={{ width: "100vw", height: "100dvh", background: "#000", position: "relative" }}>
          <MediaCell
            item={firstVideo}
            isActive={true}
            isPreconnect={false}
            isSnapSettled={true}
            allMedia={[firstVideo]}
            vehicleId={firstVehicle.id}
          />
        </div>
        <CTLogModal />
      </>
    );
  }

  _pd(`VF → Gallery mount vehicles=${displayVehicles.length}`);
  return (
    <>
      <TikTokVideoGallery
        isOpen={true}
        onClose={() => {}}
        vehicles={displayVehicles}
        initialVehicleIndex={0}
        initialMediaIndex={0}
      />
      <CTLogModal />
    </>
  );
}

// ★ v87s: ?ct=1 でLIVEタイミングログ表示（折りたたみ式 — スクロール非干渉）
// デフォルト: コンパクトバッジ（CT LIVE + Copy + 展開ボタン）— pointer-events:none で下に透過
// 展開: フルスクリーンモーダル（タップで閉じる）
// ?ct=1 — 現セッションのLIVEデータ（自動更新）
// ?ct=prev — 前回セッションのデータ（従来動作）
function CTLogModal() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false); // ★ v87s: 折りたたみ制御
  const [logText, setLogText] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"live" | "prev">("live");
  const [entryCount, setEntryCount] = useState(0);

  // ★ v87m: LIVEモード — onCtUpdate購読で新イベント到着時に自動更新
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ctParam = params.get("ct");
    if (ctParam !== "1" && ctParam !== "prev") return;

    const isPrevMode = ctParam === "prev";
    setMode(isPrevMode ? "prev" : "live");
    setShow(true);

    if (isPrevMode) {
      // 従来動作: 前回セッションのログを表示（1回読み取り）
      const raw = localStorage.getItem("chiba_cold_timing_prev")
               || localStorage.getItem("chiba_cold_timing")
               || sessionStorage.getItem("chiba_cold_timing");
      if (!raw) {
        setLogText("(No previous timing data found)");
        return;
      }
      try {
        const data = JSON.parse(raw);
        const ctx = data.ctx || {};
        const entries: { t: number; tag: string; detail?: string }[] = data.entries || [];
        const m = ctx.forceCold ? "FORCED-COLD" : ctx.hasSessionCache ? "WARM" : "COLD";
        const lines: string[] = [];
        lines.push(`=== COLD TIMING LOG [PREV] (${m}) ===`);
        lines.push(`saved: ${data.ts || "?"}`);
        lines.push(`navType: ${ctx.navType || "?"}`);
        lines.push(`forceCold: ${ctx.forceCold ?? false}`);
        lines.push(`wasRestored: ${ctx.wasRestored ?? "?"}`);
        lines.push(`hasSessionCache: ${ctx.hasSessionCache ?? "?"}`);
        lines.push(`hasEarlyPreload: ${ctx.hasEarlyPreload ?? "?"}`);
        lines.push(`hasEarlyListWithMedia: ${ctx.hasEarlyListWithMedia ?? "?"}`);
        if (ctx.warmReasons?.length > 0) {
          lines.push(`warmReasons: ${ctx.warmReasons.join(", ")}`);
        }
        lines.push(`transferSize: ${ctx.transferSize ?? "?"}`);
        lines.push(`---`);
        for (const e of entries) {
          lines.push(`+${String(e.t).padStart(6)}ms  ${e.tag}${e.detail ? "  " + e.detail : ""}`);
        }
        lines.push(`=== END (${entries.length} entries) ===`);
        setLogText(lines.join("\n"));
        setEntryCount(entries.length);
      } catch {
        setLogText(raw);
      }
      return;
    }

    // ★ v87m: LIVEモード — 現セッションのグローバル配列から即座にフォーマット
    // 初回表示
    setLogText(formatLiveLog());
    setEntryCount(((window as any).__coldTiming || []).length);

    // onCtUpdate購読で新イベント到着時に自動更新
    const unsub = onCtUpdate(() => {
      setLogText(formatLiveLog());
      setEntryCount(((window as any).__coldTiming || []).length);
      setCopied(false); // 新データ到着→Copiedリセット
    });

    // 安全弁: 2秒ごとにも更新（PerformanceObserver等が購読経由しない場合のバックアップ）
    const interval = setInterval(() => {
      const current = formatLiveLog();
      setLogText(prev => prev !== current ? current : prev);
      setEntryCount(((window as any).__coldTiming || []).length);
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (!show) return null;

  // ★ v87m: コピー関数 — 常にformatLiveLog()の最新値をコピー（stale state回避）
  const handleCopy = () => {
    const textToCopy = mode === "live" ? formatLiveLog() : logText;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => setCopied(true)).catch(() => {});
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch { /* ignore */ }
    }
  };

  // ★ v87s: 折りたたみ時 — コンパクトバッジのみ（スクロール非干渉）
  if (!expanded) {
    return (
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 8px) + 60px)",
        right: 8,
        zIndex: 999999,
        display: "flex", gap: 4, alignItems: "center",
        pointerEvents: "none", // ★ 全体は透過
      }}>
        <span style={{
          color: "#0f0", fontFamily: "monospace", fontSize: 10,
          background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4,
          pointerEvents: "none",
        }}>
          CT {entryCount}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? "#0a0" : "rgba(0,0,0,0.7)", color: "#fff",
            border: "1px solid #0f0", borderRadius: 6,
            padding: "4px 10px", fontSize: 11, fontFamily: "monospace",
            cursor: "pointer", touchAction: "manipulation",
            pointerEvents: "auto", // ★ ボタンだけタッチ可能
          }}
        >
          {copied ? "✓" : "Copy"}
        </button>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "rgba(0,0,0,0.7)", color: "#0f0",
            border: "1px solid #0f0", borderRadius: 6,
            padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
            cursor: "pointer", touchAction: "manipulation",
            pointerEvents: "auto", // ★ ボタンだけタッチ可能
          }}
        >
          ▲
        </button>
      </div>
    );
  }

  // ★ v87s: 展開時 — フルスクリーンモーダル
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999999,
      background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column",
      padding: "env(safe-area-inset-top, 12px) 8px env(safe-area-inset-bottom, 8px) 8px",
      pointerEvents: "auto",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 0", flexShrink: 0,
      }}>
        <span style={{ color: "#0f0", fontFamily: "monospace", fontWeight: "bold", fontSize: 14 }}>
          CT {mode === "live" ? `LIVE (${entryCount})` : `PREV (${entryCount})`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#0a0" : "#333", color: "#fff",
              border: "1px solid #0f0", borderRadius: 6,
              padding: "8px 16px", fontSize: 14, fontFamily: "monospace",
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            {copied ? "Copied!" : "Copy All"}
          </button>
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "#600", color: "#fff",
              border: "1px solid #f00", borderRadius: 6,
              padding: "8px 16px", fontSize: 14, fontFamily: "monospace",
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            ▼ Close
          </button>
        </div>
      </div>
      <pre style={{
        flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch",
        background: "#111", color: "#0f0",
        fontFamily: "monospace", fontSize: 11, lineHeight: 1.5,
        padding: 8, borderRadius: 6, margin: 0,
        whiteSpace: "pre-wrap", wordBreak: "break-all",
        border: "1px solid #333",
        userSelect: "text",
      }}>
        {logText}
      </pre>
    </div>
  );
}
