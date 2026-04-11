/**
 * cold-timing.ts — v87m COLD/WARM 初回タイミング永続ログ
 *
 * Inspector未接続でも初回ロードの全タイミングを後から回収可能にする。
 * - sessionStorage "chiba_cold_timing" に JSON 配列で保存
 * - window.__coldTiming で直接アクセス
 * - window.__dumpColdTiming() でコンソール出力
 * - ?ct=1 でモーダル表示（LIVEモード: 現セッション自動更新）
 * - ?cold=1 で強制COLDモード
 *
 * v87m: CTLogModal LIVE対応 — onCtUpdate購読 + formatLiveLog() + beforeunload退避
 * v69: hasEarlyListWithMedia 追加、index.html early fetchの計測
 */

// ─── 前回ログ退避（新ページロードで上書きされる前に保存） ───
try {
  const prev = localStorage.getItem("chiba_cold_timing");
  if (prev) localStorage.setItem("chiba_cold_timing_prev", prev);
} catch {}

// ─── ?cold=1 強制COLDモード検出（モジュール最速） ───
const _urlParams = new URLSearchParams(window.location.search);
export const forceCold = _urlParams.get("cold") === "1";
// ★ v87l: デフォルトはnoswap（React video直接src）
// ?swap=1 — earlyVid + replaceChild 経路を有効化（実験用）
export const forceSwap = _urlParams.get("swap") === "1";
// ★ v87o: ?raw=1 — phase -1 中にReact MediaCellを使わず素のvideo要素を直置き
export const forceRaw = _urlParams.get("raw") === "1";

// ★ v88n: 実戦テスト識別タグ — 流入元・回線条件をログに埋め込む
// 例: ?entryTag=line&netTag=4g → testLabel: "line-4g"
export const entryTag = _urlParams.get("entryTag") || "";
export const netTag = _urlParams.get("netTag") || "";
export const testLabel = [entryTag, netTag].filter(Boolean).join("-") || "direct";

// ?cold=1: sessionStorage/localStorage の early preload キーを即削除
// → 新規客の初回アクセスを完全再現
if (forceCold) {
  const keysToDelete = ["chiba_first_hls_v1"];
  for (const k of keysToDelete) {
    try { sessionStorage.removeItem(k); } catch {}
    try { localStorage.removeItem(k); } catch {}
  }
  console.log("%c[CT] ★ FORCED COLD MODE — session/localStorage cleared", "color:#f00;font-weight:bold;font-size:14px");
}

// ─── 初回アクセス判定 ───
const _navEntry = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;

export const coldContext = {
  navType: _navEntry?.type ?? "unknown",              // "navigate" | "reload" | "back_forward" | "prerender"
  wasRestored: (document as any).wasDiscarded === true || _navEntry?.type === "back_forward",
  forceCold,                                           // ★ ?cold=1 で true
  hasSessionCache: false,  // VideoFeed で上書き
  hasEarlyPreload: false,  // VideoFeed で上書き
  hasEarlyListWithMedia: !!(window as any).__earlyListWithMediaData,  // ★ v69: index.html early fetch到着済み
  warmReasons: [] as string[],                         // ★ WARM判定理由を明示
  transferSize: _navEntry?.transferSize ?? -1,         // 0 = disk cache
  navStart: _navEntry?.startTime ?? 0,
  entryTag,                                            // ★ v88n: 流入元タグ
  netTag,                                              // ★ v88n: 回線タグ
  testLabel,                                           // ★ v88n: 合成ラベル
};

// ─── タイミングログ配列 ───
interface TimingEntry {
  t: number;      // ms from navStart
  tag: string;    // イベント名
  detail?: string;
}

const _entries: TimingEntry[] = [];
let _saved = false;

// ★ v87m: 購読者リスト — CTLogModalがLIVE更新を受け取る
const _updateListeners: Array<() => void> = [];

/** CTLogModalなどがLIVE更新を購読。解除関数を返す */
export function onCtUpdate(cb: () => void): () => void {
  _updateListeners.push(cb);
  return () => {
    const idx = _updateListeners.indexOf(cb);
    if (idx >= 0) _updateListeners.splice(idx, 1);
  };
}

function _notifyListeners() {
  for (const cb of _updateListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}

/** タイミングイベントを記録。console.logも同時出力 */
// ★ v88n: ログ冒頭にテストタグを付加（entryTag/netTag/testLabel）
const _tagPrefix = testLabel !== "direct" ? `[${testLabel}] ` : "";
export function ct(tag: string, detail?: string) {
  const t = performance.now();
  _entries.push({ t: Math.round(t), tag, detail });
  // console出力（Inspector接続時用）
  console.log(`%c[CT] ${_tagPrefix}+${t.toFixed(0)}ms ${tag}${detail ? " | " + detail : ""}`, "color:#0f0;font-weight:bold");
  // 即座にsessionStorageへ（ページ離脱対策）
  _save();
  // ★ v87m: LIVE購読者に通知
  _notifyListeners();
}
// ★ v87g: index.htmlの診断スクリプトからct()を呼べるようにwindowに公開
(window as any).__coldTimingCt = ct;

/** ネットワークリクエストの開始/終了を記録 */
export function ctNet(tag: string, startTime: number, endTime: number, extra?: string) {
  const dur = endTime - startTime;
  _entries.push({
    t: Math.round(endTime),
    tag,
    detail: `start=+${Math.round(startTime)}ms dur=${Math.round(dur)}ms${extra ? " " + extra : ""}`,
  });
  _save();
  _notifyListeners();
}

function _save() {
  try {
    const data = {
      ts: new Date().toISOString(),
      ctx: coldContext,
      entries: _entries,
    };
    const json = JSON.stringify(data);
    sessionStorage.setItem("chiba_cold_timing", json);
    // localStorage にも保存（タブ閉じても残る → ?ct=1 で後から回収可能）
    localStorage.setItem("chiba_cold_timing", json);
  } catch { /* quota exceeded etc */ }
}

/** 全ログをコンソールに出力 */
export function dumpColdTiming(): string {
  const data = {
    context: coldContext,
    entries: _entries,
  };
  const mode = coldContext.forceCold ? "FORCED-COLD" : coldContext.hasSessionCache ? "WARM" : "COLD";
  const lines: string[] = [];
  lines.push(`=== COLD TIMING (${coldContext.navType}, ${mode}) testLabel=${coldContext.testLabel} ===`);
  if (coldContext.entryTag) lines.push(`  entryTag: ${coldContext.entryTag}`);
  if (coldContext.netTag) lines.push(`  netTag: ${coldContext.netTag}`);
  lines.push(`  navType: ${coldContext.navType}`);
  lines.push(`  forceCold: ${coldContext.forceCold}`);
  lines.push(`  wasRestored: ${coldContext.wasRestored}`);
  lines.push(`  hasSessionCache: ${coldContext.hasSessionCache}`);
  lines.push(`  hasEarlyPreload: ${coldContext.hasEarlyPreload}`);
  lines.push(`  hasEarlyListWithMedia: ${coldContext.hasEarlyListWithMedia}`);
  if (coldContext.warmReasons.length > 0) {
    lines.push(`  warmReasons: ${coldContext.warmReasons.join(", ")}`);
  }
  lines.push(`  transferSize: ${coldContext.transferSize}`);
  lines.push(`---`);
  for (const e of _entries) {
    lines.push(`  +${String(e.t).padStart(5)}ms  ${e.tag}${e.detail ? "  " + e.detail : ""}`);
  }
  lines.push(`===`);
  const text = lines.join("\n");
  console.log(text);
  return text;
}

/** 前回保存されたログを復元して返す（リロード後にInspectorで確認用） */
export function loadPreviousTiming(): string | null {
  try {
    return sessionStorage.getItem("chiba_cold_timing");
  } catch {
    return null;
  }
}

// ─── グローバルアクセス ───
(window as any).__coldTiming = _entries;
(window as any).__coldContext = coldContext;
(window as any).__dumpColdTiming = dumpColdTiming;
(window as any).__loadPreviousTiming = () => {
  const raw = loadPreviousTiming();
  if (!raw) { console.log("No previous timing data"); return null; }
  const data = JSON.parse(raw);
  console.log("=== PREVIOUS COLD TIMING ===");
  console.log(JSON.stringify(data, null, 2));
  return data;
};

// ─── v87m: LIVE用フォーマッタ（CTLogModalが直接利用） ───
/** 現セッションの_entries配列からフォーマット済みテキストを生成 */
export function formatLiveLog(): string {
  const mode = coldContext.forceCold ? "FORCED-COLD" : coldContext.hasSessionCache ? "WARM" : "COLD";
  const lines: string[] = [];
  lines.push(`=== COLD TIMING LOG [LIVE] (${mode}) testLabel=${coldContext.testLabel} ===`);
  lines.push(`time: ${new Date().toISOString()}`);
  if (coldContext.entryTag) lines.push(`entryTag: ${coldContext.entryTag}`);
  if (coldContext.netTag) lines.push(`netTag: ${coldContext.netTag}`);
  lines.push(`navType: ${coldContext.navType}`);
  lines.push(`forceCold: ${coldContext.forceCold}`);
  lines.push(`wasRestored: ${coldContext.wasRestored}`);
  lines.push(`hasSessionCache: ${coldContext.hasSessionCache}`);
  lines.push(`hasEarlyPreload: ${coldContext.hasEarlyPreload}`);
  lines.push(`hasEarlyListWithMedia: ${coldContext.hasEarlyListWithMedia}`);
  if (coldContext.warmReasons.length > 0) {
    lines.push(`warmReasons: ${coldContext.warmReasons.join(", ")}`);
  }
  lines.push(`transferSize: ${coldContext.transferSize}`);
  lines.push(`---`);
  for (const e of _entries) {
    lines.push(`+${String(e.t).padStart(6)}ms  ${e.tag}${e.detail ? "  " + e.detail : ""}`);
  }
  lines.push(`=== END (${_entries.length} entries) ===`);
  return lines.join("\n");
}
(window as any).__formatLiveLog = formatLiveLog;

// ─── v87m: beforeunload / pagehide でlocalStorageに最終保存 ───
// ページ離脱時にログが消えないようにする（sendBeaconフォールバック付き）
function _saveOnUnload() {
  _save();
  // sendBeacon でデバッグログサーバーにも送信（Inspector未接続時の保険）
  try {
    const payload = JSON.stringify({
      lines: [`[CT-UNLOAD] ${new Date().toISOString()} entries=${_entries.length} ${formatLiveLog().slice(0, 500)}`]
    });
    navigator.sendBeacon?.("/api/debug-log", new Blob([payload], { type: "application/json" }));
  } catch { /* ignore */ }
}
window.addEventListener("beforeunload", _saveOnUnload);
window.addEventListener("pagehide", _saveOnUnload);

// ─── 初回記録 ───
ct("cold-timing-init", `navType=${coldContext.navType} restored=${coldContext.wasRestored} testLabel=${testLabel}`);

// ─── Performance Observer: ネットワークリクエスト自動キャプチャ ───
// ★ v69: パターン拡張 — 各品質のmanifest/segmentを区別
const _criticalPatterns = [
  { pattern: /firstVideo/, tag: "net:firstVideo" },
  { pattern: /listWithMedia|firstWithMedia/, tag: "net:listWithMedia" },
  { pattern: /\/play_(\d+)p\.mp4/, tag: "net:mp4" },           // ★ v70: MP4 direct play
  { pattern: /\/playlist\.m3u8/, tag: "net:master-m3u8" },
  { pattern: /\/(\d+)p\/video\.m3u8/, tag: "net:variant-m3u8" },
  { pattern: /\/(\d+)p\/video0\.ts/, tag: "net:seg0" },
  { pattern: /\/(\d+)p\/video\d+\.ts|seg-\d/, tag: "net:segment" },
];

try {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const res = entry as PerformanceResourceTiming;
      for (const cp of _criticalPatterns) {
        if (cp.pattern.test(res.name)) {
          _entries.push({
            t: Math.round(res.responseEnd),
            tag: cp.tag,
            detail: `start=+${Math.round(res.startTime)}ms dur=${Math.round(res.responseEnd - res.startTime)}ms size=${res.transferSize}B ${res.name.slice(-50)}`,
          });
          break;
        }
      }
    }
    _save();
    _notifyListeners();
  });
  obs.observe({ type: "resource", buffered: true });
} catch { /* PerformanceObserver not supported */ }
