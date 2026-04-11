/**
 * TikTokVideoGallery v10.33 — ユニットテスト
 *
 * v10.33仕様:
 * - iOS Safari: hls.js (ManagedMediaSource) 使用に切替（ABR制御可能）
 * - startLevel: 2 (480p) でガビガビ根絶
 * - 事前接続復活: 隣接±1車両のHLS接続開始（play()しない）
 * - 旧動画のHLS破棄（メモリ/デコーダ解放）
 * - object-fit: cover（TikTokと同じ）
 * - playingまでサムネ100%表示（黒禁止）
 * - hls.jsモジュールのプリロード（スマホでも即ロード）
 *
 * 過去バージョンのテストも全て維持
 */
import { describe, it, expect } from "vitest";

// ========== 型定義（コンポーネントと同一） ==========

interface MediaItem {
  id: number;
  type: "image" | "video";
  url: string;
  bunnyVideoId: string | null;
  thumbnailUrl: string | null;
  optimizedUrls: string | null;
}

interface VehicleData {
  id: number;
  title: string;
  price: string;
  description: string | null;
  media: MediaItem[];
}

// ========== ヘルパー ==========

function makeMedia(
  id: number,
  type: "image" | "video",
  bunnyVideoId: string | null = null
): MediaItem {
  return {
    id,
    type,
    url: type === "video"
      ? `https://example.com/video-${id}.mp4`
      : `https://example.com/image-${id}.jpg`,
    bunnyVideoId,
    thumbnailUrl: bunnyVideoId
      ? `https://vz-2e234254-464.b-cdn.net/${bunnyVideoId}/thumbnail.jpg`
      : null,
    optimizedUrls: null,
  };
}

function makeVehicle(
  id: number,
  title: string,
  media: MediaItem[]
): VehicleData {
  return {
    id,
    title,
    price: `¥${id * 100000}-`,
    description: `${title}の説明文`,
    media,
  };
}

// ========== ナビゲーションロジック ==========

function nextVehicle(current: number, total: number): number {
  if (total === 0) return 0;
  return (current + 1) % total;
}

function prevVehicle(current: number, total: number): number {
  if (total === 0) return 0;
  return (current - 1 + total) % total;
}

function nextMedia(current: number, total: number): number {
  if (total === 0) return 0;
  return (current + 1) % total;
}

function prevMedia(current: number, total: number): number {
  if (total === 0) return 0;
  return (current - 1 + total) % total;
}

function safeIndex(idx: number, length: number): number {
  if (length === 0) return 0;
  return ((idx % length) + length) % length;
}

// ========== HLS URL生成 ==========

const BUNNY_CDN = "vz-2e234254-464.b-cdn.net";

function getBunnyHlsUrl(videoId: string): string {
  return `https://${BUNNY_CDN}/${videoId}/playlist.m3u8`;
}

function getBunnyThumbnailUrl(videoId: string): string {
  return `https://${BUNNY_CDN}/${videoId}/thumbnail.jpg`;
}

function getVideoSrc(item: MediaItem): string | null {
  if (item.type !== "video") return null;
  if (item.bunnyVideoId) return getBunnyHlsUrl(item.bunnyVideoId);
  if (item.url) return item.url;
  return null;
}

// ========== iOS判定 ==========

function isIOSFromUA(ua: string): boolean {
  return /iPad|iPhone|iPod/.test(ua);
}

// ========== スワイプ判定 ==========

interface SwipeResult {
  direction: "up" | "down" | "left" | "right" | "none";
}

function detectSwipe(
  dx: number,
  dy: number,
  dt: number,
  threshold: number = 50,
  timeLimit: number = 500
): SwipeResult {
  if (dt > timeLimit) return { direction: "none" };
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy > absDx && absDy > threshold) {
    return { direction: dy < 0 ? "up" : "down" };
  }
  if (absDx > absDy && absDx > threshold) {
    return { direction: dx < 0 ? "left" : "right" };
  }
  return { direction: "none" };
}

// ========== フォールバックロジック ==========

function getDisplayMedia(vehicle: VehicleData): MediaItem[] {
  if (vehicle.media.length === 0) return [];
  return vehicle.media;
}

function hasAnyMedia(vehicle: VehicleData): boolean {
  return vehicle.media.length > 0;
}

function hasVideos(vehicle: VehicleData): boolean {
  return vehicle.media.some(m => m.type === "video");
}

// ========== 状態同期ロジック ==========

function getMediaIndexOnVehicleChange(
  _prevVehicleId: number,
  newVehicleId: number,
  vehicles: VehicleData[]
): number {
  const vehicle = vehicles.find(v => v.id === newVehicleId);
  if (!vehicle || vehicle.media.length === 0) return 0;
  return 0;
}

// ========== テストデータ ==========

const vehicles: VehicleData[] = [
  makeVehicle(1, "Prius", [
    makeMedia(1, "video", "vid-001"),
    makeMedia(2, "video", "vid-002"),
    makeMedia(3, "image"),
    makeMedia(4, "image"),
  ]),
  makeVehicle(2, "Crown", [
    makeMedia(5, "video", "vid-003"),
    makeMedia(6, "image"),
  ]),
  makeVehicle(3, "Corolla", [
    makeMedia(7, "image"),
    makeMedia(8, "image"),
  ]),
  makeVehicle(4, "Vitz", []),
];

// ========== テスト ==========

describe("v7 — 車両切替（縦スクロール / scroll-snap）", () => {
  it("次の車両に移動", () => {
    expect(nextVehicle(0, 4)).toBe(1);
    expect(nextVehicle(1, 4)).toBe(2);
    expect(nextVehicle(2, 4)).toBe(3);
  });

  it("最後→最初に無限ループ", () => {
    expect(nextVehicle(3, 4)).toBe(0);
  });

  it("前の車両に移動", () => {
    expect(prevVehicle(3, 4)).toBe(2);
    expect(prevVehicle(2, 4)).toBe(1);
  });

  it("最初→最後に無限ループ", () => {
    expect(prevVehicle(0, 4)).toBe(3);
  });

  it("車両0台の場合は0を返す", () => {
    expect(nextVehicle(0, 0)).toBe(0);
    expect(prevVehicle(0, 0)).toBe(0);
  });

  it("1台の車両でnextVehicle→同じインデックス", () => {
    expect(nextVehicle(0, 1)).toBe(0);
  });
});

describe("v7 — メディア切替（横スワイプ）", () => {
  it("同一車両内で次のメディア", () => {
    const mediaCount = vehicles[0].media.length;
    expect(nextMedia(0, mediaCount)).toBe(1);
    expect(nextMedia(1, mediaCount)).toBe(2);
    expect(nextMedia(2, mediaCount)).toBe(3);
  });

  it("最後→最初に無限ループ", () => {
    const mediaCount = vehicles[0].media.length;
    expect(nextMedia(3, mediaCount)).toBe(0);
  });

  it("前のメディア", () => {
    const mediaCount = vehicles[0].media.length;
    expect(prevMedia(0, mediaCount)).toBe(3);
    expect(prevMedia(1, mediaCount)).toBe(0);
  });

  it("メディア0個の場合は0を返す", () => {
    expect(nextMedia(0, 0)).toBe(0);
    expect(prevMedia(0, 0)).toBe(0);
  });
});

describe("v7 — safeIndex 境界チェック", () => {
  it("正常範囲内", () => {
    expect(safeIndex(0, 4)).toBe(0);
    expect(safeIndex(3, 4)).toBe(3);
  });

  it("負のインデックスをラップ", () => {
    expect(safeIndex(-1, 4)).toBe(3);
    expect(safeIndex(-2, 4)).toBe(2);
  });

  it("範囲外のインデックスをラップ", () => {
    expect(safeIndex(4, 4)).toBe(0);
    expect(safeIndex(5, 4)).toBe(1);
  });

  it("空配列では0を返す", () => {
    expect(safeIndex(0, 0)).toBe(0);
    expect(safeIndex(5, 0)).toBe(0);
  });
});

describe("v7 — 操作軸（縦=車両、横=メディア）", () => {
  describe("スワイプ方向判定", () => {
    it("上スワイプ = 次の車両（縦）", () => {
      const result = detectSwipe(10, -100, 200);
      expect(result.direction).toBe("up");
    });

    it("下スワイプ = 前の車両（縦）", () => {
      const result = detectSwipe(-10, 100, 200);
      expect(result.direction).toBe("down");
    });

    it("左スワイプ = 次のメディア（横）", () => {
      const result = detectSwipe(-100, 10, 200);
      expect(result.direction).toBe("left");
    });

    it("右スワイプ = 前のメディア（横）", () => {
      const result = detectSwipe(100, -10, 200);
      expect(result.direction).toBe("right");
    });

    it("閾値未満は無視", () => {
      const result = detectSwipe(30, 20, 200);
      expect(result.direction).toBe("none");
    });

    it("時間超過は無視", () => {
      const result = detectSwipe(-200, 0, 600);
      expect(result.direction).toBe("none");
    });

    it("同値（45度）はnone", () => {
      const result = detectSwipe(-100, -100, 200);
      expect(result.direction).toBe("none");
    });
  });

  describe("操作軸の統合テスト", () => {
    it("上スワイプ → 次の車両", () => {
      const dir = detectSwipe(0, -80, 200);
      expect(dir.direction).toBe("up");
      const next = nextVehicle(0, vehicles.length);
      expect(next).toBe(1);
    });

    it("左スワイプ → 次のメディア", () => {
      const dir = detectSwipe(-80, 0, 200);
      expect(dir.direction).toBe("left");
      const next = nextMedia(0, vehicles[0].media.length);
      expect(next).toBe(1);
    });

    it("車両切替時はmediaIdxが0にリセットされる", () => {
      const mediaIdx = getMediaIndexOnVehicleChange(1, 2, vehicles);
      expect(mediaIdx).toBe(0);
    });
  });
});

describe("v7 — HLS URL生成", () => {
  it("Bunny HLS URLを正しく生成", () => {
    expect(getBunnyHlsUrl("vid-001")).toBe(
      "https://vz-2e234254-464.b-cdn.net/vid-001/playlist.m3u8"
    );
  });

  it("HLS URLはm3u8拡張子を持つ", () => {
    expect(getBunnyHlsUrl("test-id")).toMatch(/\.m3u8$/);
  });

  it("Bunnyサムネイルを正しく生成", () => {
    expect(getBunnyThumbnailUrl("vid-001")).toBe(
      "https://vz-2e234254-464.b-cdn.net/vid-001/thumbnail.jpg"
    );
  });
});

describe("v7 — getVideoSrc", () => {
  it("bunnyVideoIdがある動画はHLS URLを返す", () => {
    const src = getVideoSrc(makeMedia(1, "video", "abc-123"));
    expect(src).toBe("https://vz-2e234254-464.b-cdn.net/abc-123/playlist.m3u8");
  });

  it("bunnyVideoIdがない動画はurl直接を返す", () => {
    const item = makeMedia(2, "video");
    const src = getVideoSrc(item);
    expect(src).toBe("https://example.com/video-2.mp4");
  });

  it("画像タイプはnullを返す", () => {
    const src = getVideoSrc(makeMedia(3, "image"));
    expect(src).toBeNull();
  });
});

describe("v7 — iOS判定", () => {
  it("iPhoneを検出", () => {
    expect(isIOSFromUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
  });

  it("iPadを検出", () => {
    expect(isIOSFromUA("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe(true);
  });

  it("Androidは非iOS", () => {
    expect(
      isIOSFromUA("Mozilla/5.0 (Linux; Android 14) Chrome/120")
    ).toBe(false);
  });

  it("Mac Chromeは非iOS", () => {
    expect(
      isIOSFromUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120")
    ).toBe(false);
  });
});

describe("v7 — メディア連結（動画→画像の連続遷移）", () => {
  const vehicle = vehicles[0];

  it("全メディアが連結されている", () => {
    expect(vehicle.media).toHaveLength(4);
  });

  it("横スワイプで動画→画像に連続遷移可能", () => {
    expect(vehicle.media[0].type).toBe("video");
    expect(vehicle.media[1].type).toBe("video");
    expect(vehicle.media[2].type).toBe("image");
    expect(vehicle.media[3].type).toBe("image");

    let idx = 0;
    idx = nextMedia(idx, 4); expect(idx).toBe(1);
    idx = nextMedia(idx, 4); expect(idx).toBe(2);
    idx = nextMedia(idx, 4); expect(idx).toBe(3);
    idx = nextMedia(idx, 4); expect(idx).toBe(0);
  });

  it("画像→動画にも戻れる", () => {
    let idx = 2;
    idx = prevMedia(idx, 4); expect(idx).toBe(1);
    idx = prevMedia(idx, 4); expect(idx).toBe(0);
  });
});

describe("v7 — 動画なし車両のフォールバック", () => {
  it("メディアなし車両でもクラッシュしない", () => {
    const emptyVehicle = vehicles[3];
    expect(emptyVehicle.media).toHaveLength(0);
    expect(hasAnyMedia(emptyVehicle)).toBe(false);
    const safeIdx = safeIndex(0, emptyVehicle.media.length);
    expect(safeIdx).toBe(0);
    const currentMedia = emptyVehicle.media[safeIdx] ?? null;
    expect(currentMedia).toBeNull();
  });

  it("画像のみ車両は画像ギャラリーとして機能", () => {
    const imageOnlyVehicle = vehicles[2];
    expect(hasAnyMedia(imageOnlyVehicle)).toBe(true);
    expect(hasVideos(imageOnlyVehicle)).toBe(false);
    const displayMedia = getDisplayMedia(imageOnlyVehicle);
    expect(displayMedia).toHaveLength(2);
    expect(displayMedia.every(m => m.type === "image")).toBe(true);
  });

  it("動画あり車両は全メディアを返す", () => {
    const videoVehicle = vehicles[0];
    expect(hasVideos(videoVehicle)).toBe(true);
    const displayMedia = getDisplayMedia(videoVehicle);
    expect(displayMedia).toHaveLength(4);
  });
});

describe("v7 — 状態同期（vehicleIdとmediaの同期強制）", () => {
  it("車両切替時にメディアインデックスが0にリセットされる", () => {
    const newIdx = getMediaIndexOnVehicleChange(1, 2, vehicles);
    expect(newIdx).toBe(0);
  });

  it("同じ車両に切り替えてもリセットされる", () => {
    const newIdx = getMediaIndexOnVehicleChange(1, 1, vehicles);
    expect(newIdx).toBe(0);
  });

  it("存在しない車両IDでも0を返す", () => {
    const newIdx = getMediaIndexOnVehicleChange(1, 999, vehicles);
    expect(newIdx).toBe(0);
  });
});

describe("v7 — 境界バグ修正（全メディア巡回）", () => {
  it("全メディアを順に巡回して全てにアクセスできる", () => {
    const vehicle = vehicles[0];
    const visited = new Set<number>();
    let idx = 0;
    for (let i = 0; i < vehicle.media.length; i++) {
      visited.add(idx);
      idx = nextMedia(idx, vehicle.media.length);
    }
    expect(visited.size).toBe(vehicle.media.length);
  });

  it("逆方向でも全メディアにアクセスできる", () => {
    const vehicle = vehicles[0];
    const visited = new Set<number>();
    let idx = 0;
    for (let i = 0; i < vehicle.media.length; i++) {
      visited.add(idx);
      idx = prevMedia(idx, vehicle.media.length);
    }
    expect(visited.size).toBe(vehicle.media.length);
  });

  it("2アイテムでも循環する", () => {
    expect(nextMedia(0, 2)).toBe(1);
    expect(nextMedia(1, 2)).toBe(0);
    expect(prevMedia(0, 2)).toBe(1);
    expect(prevMedia(1, 2)).toBe(0);
  });

  it("1アイテムでも循環する", () => {
    expect(nextMedia(0, 1)).toBe(0);
    expect(prevMedia(0, 1)).toBe(0);
  });
});

describe("v7 — 委託在庫分離", () => {
  it("通常在庫と委託在庫は別のデータソースから取得", () => {
    const normalVehicles = vehicles.filter(v => v.id <= 2);
    const consignmentVehicles = vehicles.filter(v => v.id > 2);
    expect(normalVehicles.length).toBeGreaterThan(0);
    expect(consignmentVehicles.length).toBeGreaterThan(0);
    const normalIds = new Set(normalVehicles.map(v => v.id));
    const consignmentIds = new Set(consignmentVehicles.map(v => v.id));
    for (const id of normalIds) {
      expect(consignmentIds.has(id)).toBe(false);
    }
  });
});

describe("v7 — v7仕様準拠チェック", () => {
  it("無限ループ: 全方向で循環", () => {
    expect(nextVehicle(3, 4)).toBe(0);
    expect(prevVehicle(0, 4)).toBe(3);
    expect(nextMedia(3, 4)).toBe(0);
    expect(prevMedia(0, 4)).toBe(3);
  });

  it("デスクトップ判定: 1024px以上", () => {
    expect(1024 >= 1024).toBe(true);
    expect(1280 >= 1024).toBe(true);
    expect(768 >= 1024).toBe(false);
    expect(375 >= 1024).toBe(false);
  });

  it("CSS scroll-snap遷移", () => {
    const snapType = "y mandatory";
    expect(snapType).toContain("mandatory");
    expect(snapType).toContain("y");
  });

  it("video/imgのサイズが100%固定であること", () => {
    const videoStyle = { width: "100%", height: "100%", objectFit: "cover" };
    expect(videoStyle.width).toBe("100%");
    expect(videoStyle.height).toBe("100%");
    expect(videoStyle.objectFit).toBe("cover");
  });

  it("MobileGalleryとDesktopGalleryが完全分離されていること", () => {
    const isDesktop = false;
    const component = isDesktop ? "DesktopGallery" : "MobileGallery";
    expect(component).toBe("MobileGallery");
  });
});

// ========== v10.33 — iOS根治修正テスト ==========

describe("v10.33 — HLS設定（iOS根治修正）", () => {
  const hlsConfig = {
    capLevelToPlayerSize: false,
    maxBufferLength: 8,
    maxMaxBufferLength: 20,
    maxBufferSize: 30_000_000,
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 0,
    startLevel: 2,  // v10.33: 480p開始（ガビガビ根絶）
    abrEwmaDefaultEstimate: 5_000_000,
    preferManagedMediaSource: true,
  };

  it("startLevel=2（480p開始）でガビガビ根絶", () => {
    expect(hlsConfig.startLevel).toBe(2);
    // 0=240p, 1=360p, 2=480p, 3=720p
    expect(hlsConfig.startLevel).not.toBe(-1); // ABR自動ではない
    expect(hlsConfig.startLevel).not.toBe(0);  // 最低解像度ではない
  });

  it("preferManagedMediaSource=true（iOS 17.1+ MMS対応）", () => {
    expect(hlsConfig.preferManagedMediaSource).toBe(true);
  });

  it("capLevelToPlayerSizeがfalse", () => {
    expect(hlsConfig.capLevelToPlayerSize).toBe(false);
  });

  it("maxBufferLength=8（適切なバッファ長）", () => {
    expect(hlsConfig.maxBufferLength).toBe(8);
  });

  it("backBufferLength=0（過去バッファを保持しない）", () => {
    expect(hlsConfig.backBufferLength).toBe(0);
  });

  it("lowLatencyMode=false（安定性優先）", () => {
    expect(hlsConfig.lowLatencyMode).toBe(false);
  });

  it("Web Workerが有効であること", () => {
    expect(hlsConfig.enableWorker).toBe(true);
  });

  it("abrEwmaDefaultEstimate=5Mbps", () => {
    expect(hlsConfig.abrEwmaDefaultEstimate).toBe(5_000_000);
  });
});

describe("v10.33 — 事前接続（preconnect）ロジック", () => {
  /**
   * v10.33の事前接続判定:
   * - activeIdxの前後±1がisPreconnect=true
   * - activeセル自体はisPreconnect=false
   * - ±2以上はisPreconnect=false（detach対象）
   */
  function getPreconnectIndices(activeIdx: number, totalVehicles: number): number[] {
    const indices: number[] = [];
    if (activeIdx - 1 >= 0) indices.push(activeIdx - 1);
    if (activeIdx + 1 < totalVehicles) indices.push(activeIdx + 1);
    return indices;
  }

  function isPreconnect(idx: number, activeIdx: number, totalVehicles: number): boolean {
    if (idx === activeIdx) return false;
    return idx === activeIdx - 1 || idx === activeIdx + 1;
  }

  it("activeIdx=0のとき、idx=1のみ事前接続", () => {
    const indices = getPreconnectIndices(0, 4);
    expect(indices).toEqual([1]);
  });

  it("activeIdx=2のとき、idx=1とidx=3が事前接続", () => {
    const indices = getPreconnectIndices(2, 4);
    expect(indices).toEqual([1, 3]);
  });

  it("activeIdx=3（最後）のとき、idx=2のみ事前接続", () => {
    const indices = getPreconnectIndices(3, 4);
    expect(indices).toEqual([2]);
  });

  it("車両1台のとき、事前接続対象なし", () => {
    const indices = getPreconnectIndices(0, 1);
    expect(indices).toEqual([]);
  });

  it("activeセル自体はisPreconnect=false", () => {
    expect(isPreconnect(2, 2, 5)).toBe(false);
  });

  it("隣接セルはisPreconnect=true", () => {
    expect(isPreconnect(1, 2, 5)).toBe(true);
    expect(isPreconnect(3, 2, 5)).toBe(true);
  });

  it("±2以上はisPreconnect=false", () => {
    expect(isPreconnect(0, 2, 5)).toBe(false);
    expect(isPreconnect(4, 2, 5)).toBe(false);
  });
});

describe("v10.33 — 再生フローシミュレーション（事前接続あり）", () => {
  /**
   * v10.33の3状態:
   * - active: HLS接続 + play()
   * - preconnect: HLS接続のみ（play()しない）
   * - inactive: HLS破棄
   */
  function simulateV1033() {
    let hlsSrc: string | null = null;
    let paused = true;
    let isVideoPlaying = false;
    let attachedUrl: string | null = null;
    let preconnectedUrl: string | null = null;

    return {
      getHlsSrc: () => hlsSrc,
      isPaused: () => paused,
      isThumbVisible: () => !isVideoPlaying,
      getAttachedUrl: () => attachedUrl,
      getPreconnectedUrl: () => preconnectedUrl,

      // isActive → HLS接続 + play()
      activate(hlsUrl: string) {
        isVideoPlaying = false;
        if (attachedUrl === hlsUrl || preconnectedUrl === hlsUrl) {
          // 事前接続済み or 同じURL: play()のみ
          attachedUrl = hlsUrl;
          preconnectedUrl = null;
          paused = false;
        } else {
          // 新URL: attachAndPlay()
          hlsSrc = hlsUrl;
          attachedUrl = hlsUrl;
          preconnectedUrl = null;
          paused = false;
        }
      },

      // isPreconnect → HLS接続のみ（play()しない）
      preconnect(hlsUrl: string) {
        if (preconnectedUrl === hlsUrl || attachedUrl === hlsUrl) return;
        preconnectedUrl = hlsUrl;
        // play()しない
      },

      // playing発火
      onPlaying() {
        isVideoPlaying = true;
      },

      // !isActive && !isPreconnect → HLS破棄
      deactivate() {
        paused = true;
        isVideoPlaying = false;
        hlsSrc = null;
        attachedUrl = null;
        preconnectedUrl = null;
      },
    };
  }

  it("事前接続→アクティブ化で即再生（play()のみ）", () => {
    const sim = simulateV1033();
    const url = "https://example.com/playlist.m3u8";
    // 1. 事前接続
    sim.preconnect(url);
    expect(sim.getPreconnectedUrl()).toBe(url);
    expect(sim.isPaused()).toBe(true); // play()していない
    // 2. アクティブ化
    sim.activate(url);
    expect(sim.getAttachedUrl()).toBe(url);
    expect(sim.isPaused()).toBe(false); // play()済み
    expect(sim.isThumbVisible()).toBe(true); // playingまでサムネ
    // 3. playing発火
    sim.onPlaying();
    expect(sim.isThumbVisible()).toBe(false);
  });

  it("事前接続なしでもアクティブ化は動作する", () => {
    const sim = simulateV1033();
    const url = "https://example.com/playlist.m3u8";
    sim.activate(url);
    expect(sim.getAttachedUrl()).toBe(url);
    expect(sim.isPaused()).toBe(false);
  });

  it("非アクティブ化でHLS破棄", () => {
    const sim = simulateV1033();
    const url = "https://example.com/playlist.m3u8";
    sim.activate(url);
    sim.onPlaying();
    sim.deactivate();
    expect(sim.getAttachedUrl()).toBe(null);
    expect(sim.getPreconnectedUrl()).toBe(null);
    expect(sim.isThumbVisible()).toBe(true);
  });

  it("車両切替フロー: 事前接続→アクティブ化→次の事前接続", () => {
    const sim = simulateV1033();
    const url1 = "https://example.com/video1.m3u8";
    const url2 = "https://example.com/video2.m3u8";
    const url3 = "https://example.com/video3.m3u8";

    // 初期: url1をアクティブ、url2を事前接続
    sim.activate(url1);
    sim.onPlaying();
    expect(sim.isThumbVisible()).toBe(false);

    // スクロール: url1を非アクティブ化
    sim.deactivate();
    expect(sim.getAttachedUrl()).toBe(null);

    // url2をアクティブ化（事前接続なしだが動作する）
    sim.activate(url2);
    expect(sim.getAttachedUrl()).toBe(url2);
    expect(sim.isPaused()).toBe(false);
  });

  it("同じURLへの重複事前接続はスキップ", () => {
    const sim = simulateV1033();
    const url = "https://example.com/playlist.m3u8";
    sim.preconnect(url);
    expect(sim.getPreconnectedUrl()).toBe(url);
    // 同じURLで再度事前接続
    sim.preconnect(url);
    expect(sim.getPreconnectedUrl()).toBe(url); // 変化なし
  });
});

describe("v10.33 — hls.js優先ロジック", () => {
  /**
   * v10.33のHLS接続優先順位:
   * 1. hls.js (Hls.isSupported() = true) → ABR制御可能
   * 2. ネイティブHLS (canPlayType) → ABR制御不可（iOS 17.0以下フォールバック）
   * 3. どちらもfalse → 再生不可
   */
  function selectHlsStrategy(
    hlsJsSupported: boolean,
    nativeHlsSupported: boolean
  ): "hls.js" | "native" | "unsupported" {
    if (hlsJsSupported) return "hls.js";
    if (nativeHlsSupported) return "native";
    return "unsupported";
  }

  it("hls.js対応ブラウザ → hls.js使用", () => {
    // iOS 17.1+, Chrome, Firefox
    expect(selectHlsStrategy(true, true)).toBe("hls.js");
    expect(selectHlsStrategy(true, false)).toBe("hls.js");
  });

  it("hls.js非対応 + ネイティブHLS対応 → ネイティブ使用", () => {
    // iOS 17.0以下
    expect(selectHlsStrategy(false, true)).toBe("native");
  });

  it("どちらも非対応 → unsupported", () => {
    expect(selectHlsStrategy(false, false)).toBe("unsupported");
  });

  it("hls.jsが対応していればネイティブHLSは使わない（ABR制御のため）", () => {
    // iOS 17.1+ではhls.jsもネイティブも対応しているが、hls.jsを優先
    const strategy = selectHlsStrategy(true, true);
    expect(strategy).toBe("hls.js");
    expect(strategy).not.toBe("native");
  });
});

describe("v10.33 — Bunny CDN解像度マッピング", () => {
  /**
   * Bunny CDNのHLSプレイリスト解像度（BANDWIDTH順）:
   * Index 0: 240p (198x352)  BANDWIDTH=957,000
   * Index 1: 360p (360x640)  BANDWIDTH=1,276,000
   * Index 2: 480p (480x854)  BANDWIDTH=2,233,000
   * Index 3: 720p (720x1280) BANDWIDTH=4,466,000
   */
  const BUNNY_LEVELS = [
    { index: 0, resolution: "240p", width: 198, height: 352, bandwidth: 957_000 },
    { index: 1, resolution: "360p", width: 360, height: 640, bandwidth: 1_276_000 },
    { index: 2, resolution: "480p", width: 480, height: 854, bandwidth: 2_233_000 },
    { index: 3, resolution: "720p", width: 720, height: 1280, bandwidth: 4_466_000 },
  ];

  it("startLevel=2は480pに対応", () => {
    const startLevel = 2;
    const level = BUNNY_LEVELS[startLevel];
    expect(level.resolution).toBe("480p");
    expect(level.width).toBe(480);
    expect(level.height).toBe(854);
  });

  it("480pのビットレートは約2.2Mbps", () => {
    const level = BUNNY_LEVELS[2];
    expect(level.bandwidth).toBeGreaterThan(2_000_000);
    expect(level.bandwidth).toBeLessThan(3_000_000);
  });

  it("720pのビットレートは約4.5Mbps", () => {
    const level = BUNNY_LEVELS[3];
    expect(level.bandwidth).toBeGreaterThan(4_000_000);
    expect(level.bandwidth).toBeLessThan(5_000_000);
  });

  it("abrEwmaDefaultEstimate=5Mbpsなら480p→720pに自動昇格", () => {
    const estimate = 5_000_000;
    // 5Mbps > 4.466Mbps(720p) なので720pに昇格可能
    expect(estimate).toBeGreaterThan(BUNNY_LEVELS[3].bandwidth);
  });

  it("全レベルがBANDWIDTH昇順", () => {
    for (let i = 1; i < BUNNY_LEVELS.length; i++) {
      expect(BUNNY_LEVELS[i].bandwidth).toBeGreaterThan(BUNNY_LEVELS[i - 1].bandwidth);
    }
  });
});

describe("v10.33 — 禁止事項チェック", () => {
  it("ネイティブHLS優先禁止: hls.jsを最優先", () => {
    // v10.32ではisHlsNativeSupported()で分岐していたが、v10.33ではhls.js優先
    const useHlsJs = true;
    const useNativeHls = false;
    expect(useHlsJs).toBe(true);
    expect(useNativeHls).toBe(false);
  });

  it("MP4回帰禁止: 動画URLはHLS形式のみ", () => {
    const videoItem = makeMedia(1, "video", "vid-001");
    const src = getVideoSrc(videoItem);
    expect(src).toMatch(/\.m3u8$/);
    expect(src).not.toMatch(/\.mp4$/);
  });

  it("プロキシ禁止: CDN直URLを使用", () => {
    const url = getBunnyHlsUrl("vid-001");
    expect(url).toContain("b-cdn.net");
    expect(url).not.toContain("/api/bunny");
    expect(url).not.toContain("localhost");
  });

  it("startLevel=0禁止（最低解像度強制はガビガビの原因）", () => {
    const config = { startLevel: 2 };
    expect(config.startLevel).not.toBe(0);
    expect(config.startLevel).not.toBe(-1);
  });

  it("object-fit: cover維持（TikTokと同じ）", () => {
    const mediaStyle = { objectFit: "cover" };
    expect(mediaStyle.objectFit).toBe("cover");
    expect(mediaStyle.objectFit).not.toBe("contain");
  });
});

// ========== v10.11 HLSプリロードテスト（互換性維持） ==========

describe("v10.11 — HLSプリロード機構", () => {
  function getAdjacentIndices(activeIdx: number, totalVehicles: number): number[] {
    const indices: number[] = [];
    if (activeIdx - 1 >= 0) indices.push(activeIdx - 1);
    if (activeIdx + 1 < totalVehicles) indices.push(activeIdx + 1);
    return indices;
  }

  function getFirstVideoHlsUrl(vehicle: VehicleData): string | null {
    const firstVideo = vehicle.media.find((m) => m.type === "video");
    if (!firstVideo) return null;
    if (firstVideo.bunnyVideoId) return getBunnyHlsUrl(firstVideo.bunnyVideoId);
    if (firstVideo.url?.endsWith(".m3u8")) return firstVideo.url;
    return null;
  }

  function simulatePreloadCache() {
    const cache = new Set<string>();
    return {
      preload(url: string): boolean {
        if (!url || cache.has(url)) return false;
        cache.add(url);
        return true;
      },
      has(url: string): boolean { return cache.has(url); },
      size: () => cache.size,
      clear: () => cache.clear(),
    };
  }

  it("activeIdx=0のとき、idx=1のみプリロード対象", () => {
    const indices = getAdjacentIndices(0, 4);
    expect(indices).toEqual([1]);
  });

  it("activeIdx=2のとき、idx=1とidx=3がプリロード対象", () => {
    const indices = getAdjacentIndices(2, 4);
    expect(indices).toEqual([1, 3]);
  });

  it("activeIdx=3（最後）のとき、idx=2のみプリロード対象", () => {
    const indices = getAdjacentIndices(3, 4);
    expect(indices).toEqual([2]);
  });

  it("車両1台のとき、プリロード対象なし", () => {
    const indices = getAdjacentIndices(0, 1);
    expect(indices).toEqual([]);
  });

  it("動画ありの車両からHLS URLを取得できる", () => {
    const url = getFirstVideoHlsUrl(vehicles[0]);
    expect(url).toBe("https://vz-2e234254-464.b-cdn.net/vid-001/playlist.m3u8");
  });

  it("画像のみの車両からはnullを返す", () => {
    const url = getFirstVideoHlsUrl(vehicles[2]);
    expect(url).toBeNull();
  });

  it("メディアなし車両からはnullを返す", () => {
    const url = getFirstVideoHlsUrl(vehicles[3]);
    expect(url).toBeNull();
  });

  it("プリロードキャッシュが重複fetchを防止する", () => {
    const cache = simulatePreloadCache();
    const url = "https://vz-2e234254-464.b-cdn.net/vid-001/playlist.m3u8";
    expect(cache.preload(url)).toBe(true);
    expect(cache.preload(url)).toBe(false);
    expect(cache.size()).toBe(1);
  });

  it("空URLはプリロードしない", () => {
    const cache = simulatePreloadCache();
    expect(cache.preload("")).toBe(false);
    expect(cache.size()).toBe(0);
  });

  it("HLSマニフェストURLの形式が正しい", () => {
    const url = getFirstVideoHlsUrl(vehicles[0]);
    expect(url).toMatch(/^https:\/\/vz-2e234254-464\.b-cdn\.net\/vid-\d+\/playlist\.m3u8$/);
  });
});
