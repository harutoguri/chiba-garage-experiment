# チバガレージ (Chiba Garage) — Codex向けプロジェクトブリーフィング

## プロジェクト概要
中古車販売店「チバガレージ」のTikTok風縦スワイプ動画ギャラリーWebサイト。
iPhone Safari での初回訪問体験（COLD load）を大手アプリ並みに仕上げることが最重要課題。

- **リポジトリ:** `/Users/harutoguri/Downloads/chiba-garage-web-new/`
- **技術スタック:** React 19 + TypeScript + Vite + Express + embedded Vite dev server + Wouter + TanStack Query + Tailwind 4 + tRPC + Drizzle ORM + Bunny HLS（iOS native HLS + hls.js hybrid）
- **ターゲット:** iPhone Safari（4G/5G/Wi-Fi）
- **動画配信:** Bunny.net CDN（HLS）
- **dev server:** `npm run dev` → `server/_core/index.ts` を `tsx watch` で起動。通常は `localhost:3000`、埋まっていれば `3001+` に自動退避
- **公開テストURL:** Cloudflare Quick Tunnel経由（cloudflared）
- **前提:** 単なるViteフロント案件ではなく、Express + embedded Vite dev server + server-side injection + client-side playback pipeline で成立している
- **判定基準:** 古いnotes/testより iPhone Safari 実機を優先する

---

## 体制
| 役割 | 担当 | 備考 |
|------|------|------|
| **社長** | ユーザー本人 | 実機確認のみ。超多忙。出先多い |
| **監督** | ChatGPT Atlas | 設計判断・指示出し・品質管理 |
| **新人** | Claude Code | 実装・保守・監視の全実行 |
| **Codex** | OpenAI Codex | ← 今回参加。状況把握・並行作業用 |

---

## コアファイル（重要度順）

### 1. `client/src/components/TikTokVideoGallery.tsx` (~3634行)
**最重要ファイル。** 縦スワイプギャラリーの全ロジック。
- MediaCell: 動画セルの状態機械（PLAY / FREEZE / PRECONNECT / INACTIVE）
- VehicleSlide: 車両単位の横スワイプ（動画+画像）
- MobileGallery: 縦スワイプコンテナ（CSS scroll-snap + touch-assist）
- PinchZoomImage: 画像表示（ピンチズーム対応）
- showFrame0: 動画の0フレーム表示（HDR対応）
- Brand Gate: COLD時の初期表示制御

### 2. `client/src/lib/cold-timing.ts` (~265行)
CT（Cold Timing）ログシステム。sessionStorage/localStorage + console + sendBeacon。
- `ct(tag, detail)`: タイミングイベント記録
- `entryTag` / `netTag`: 流入元・回線識別（v88n）
- `coldContext`: COLD/WARM判定コンテキスト

### 3. `client/src/components/VideoFeed.tsx` (~722行)
tRPCデータフェッチ + ギャラリー初期化。displayVehicles管理。

### 4. `client/index.html` (~414行)
Bootstrap video（HLS接続先行ウォーミング）、early fetch、Brand Gate DOM。

### 5. `client/src/components/Layout.tsx` (~136行)
ボトムナビ + FAB。COLD時非表示制御（v88j）。

### COLD経路で実質重要なサーバー2ファイル
- `server/_core/vite.ts`: `__FIRST_VIDEO_DATA__` の `<head>` 注入担当。embedded Vite経由で `index.html` を返す
- `server/_core/index.ts`: dev server本体。可変ポート、`/api/debug-log` / `/api/mp4-log`、tRPC prewarm、first MP4 prewarm を担当

---

## 現在のビルド: v89c

- **注意:** 実コード上の `BUILD_ID` は `client/src/components/TikTokVideoGallery.tsx` にある。版上げ時はバージョン履歴表と `BUILD_ID` を同時更新すること

### バージョン履歴（直近の重要変更）
| ver | 内容 | 状態 |
|-----|------|------|
| v88c | hidden bootstrap + boot kill + React direct src | **絶対不変** |
| v88i | Brand Gate / bootstrap表示制御 | 確定 |
| v88j | 下部UI隠蔽（bottom nav + FAB） | 確定 |
| v88k | modulepreload | 確定 |
| v88m | phase 0隣接±1 MediaCell mount | 確定 |
| v88n | entryTag/netTag識別タグ | 確定 |
| v88o | 連続遷移ログ強化 | 確定 |
| v88r | 画像遅延化（loading=lazy, ±3制限） | 確定 |
| v88s | gesture-based tRPC delay | 確定 |
| v88t | 進行方向+2先読み | 確定 |
| v88z | 偽resume地獄防止（force clean attach） | 確定 |
| v89a | 1セッション主義（active以外完全kill） | 確定 |
| v89b | 表示レイヤー修正 | 確定 |
| v89c | placeholder attach封鎖 + grace残留対策 | **実機テスト中** |

### v89cの主修正
1. **placeholder attach禁止**: `vid=-999` placeholder vehicle では attach / play を完全禁止
2. **snap changeで旧grace即キャンセル**: snap先が変わったら旧active cellのgraceを即失効
3. **grace残留でPRECON-killが止まらないよう補正**: snap change後のPRECONNECTはkillを通す

### v89bの3つの修正（継続前提）
1. **real frame seen → thumb禁止**: 一度first_frame_visibleした動画は、revisit時にfake thumbnailを前面に出さない
2. **画像only車両は黒div禁止**: 動画を持たない車両はinactiveでも常にPinchZoomImageを描画
3. **active猶予期間**: cell_activate後1000ms以内はPRECON-killを禁止

---

## 動画再生パイプライン（COLD時）

``` 
server start (`server/_core/index.ts`)
  ├─ tRPC prewarm (`vehicles.firstVideo` / `firstWithMedia` / `listWithMedia`)
  └─ first MP4 prewarm (`/api/mp4-cache/:videoId`)

HTML response (`server/_core/vite.ts` → `client/index.html`)
  ├─ `__FIRST_VIDEO_DATA__` を `</head>` 直前に注入
  ├─ bootstrap video (HLS metadata preload)
  ├─ early fetch (vehicles.listWithMedia)
  └─ modulepreload (main.tsx)

React mount
  ├─ phase 0: 1本目 MediaCell + ±1隣接 MediaCell (v88m)
  │   └─ 1本目: earlyPreload HLS → attachMedia → play()
  │   └─ ±1: attachOnly (manifest+seg0 先読み、play()なし)
  ├─ Brand Gate: min 700ms hold → first_frame_visible or 3s timeout で解除
  ├─ ios_playing → phase 2 解禁 (or gesture-based: v88s)
  └─ phase 2: 全車両 unlock → VehicleSlide mount
      └─ 進行方向 +2 先読み (v88t)
```

### MediaCell 状態機械
```
PLAY       : isActive && isSnapSettled → v88z force clean + attachAndPlay
FREEZE     : isActive && !isSnapSettled → pause + attachOnly
PRECONNECT : ±1隣接 → v89a: 完全kill (v89b: active直後1000msは猶予 / v89c: snap changeで旧grace即キャンセル)
INACTIVE   : それ以外 → 完全kill (detachHls)
```

### 1セッション主義 (v89a)
- active以外の動画セッションを即座に完全破棄（pause + removeAttribute("src") + load() + preload="none"）
- 同時にHLS接続が生きているのは1本だけ
- activeになった時にv88z force cleanで新規HLSアタッチ

---

## 絶対に触ってはいけないもの
- **v88c系**: hidden bootstrap video / boot kill / React direct src
- **Brand Gate**: 初期表示制御（min hold / max timeout）
- **v88j**: 下部UI隠蔽（bottom nav / FAB）
- **v88k**: modulepreload
- **v88m**: phase 0 ±1隣接mount
- **v88s**: gesture-based tRPC delay
- **server側の勝ち筋**: `server/_core/vite.ts` の first video embed と `server/_core/index.ts` の prewarm
- **初回1本目/2本目の再生勝ち筋**

---

## 既知の課題（社長体感）
1. **3本目以降の動画**: 黒画面やクソサムネが出ることがある
2. **高速スワイプ/高速往復**: v88o_interrupted多発
3. **画像車両**: 黒画面/半欠けが残る個体がある
4. **全体**: 大手アプリ（TikTok/Instagram）と比べてまだ遅い

---

## 補助資料
- `LOCAL_DEV_README.md`: 現行セットアップ・ローカル運用の参照先
- `SHARED_NOTES.md`: 歴史ログ。古い版の判断や一時的な勝ち筋が混在するので、現行仕様として鵜呑みにしない
- `video_issue_root_cause.md`: 旧調査メモ。背景理解用であり、現行挙動保証ではない

---

## 開発環境
```bash
cd /Users/harutoguri/Downloads/chiba-garage-web-new
npm run dev                    # `server/_core/index.ts` を tsx watch で起動。通常は localhost:3000、埋まっていれば 3001+ に自動退避
cloudflared tunnel --url http://localhost:3000  # 公開URL生成（実際に起動したポートへ向ける）
ifconfig en0 | grep inet      # LAN IP確認
```

### デバッグ
- `?cold=1` → 強制COLDモード。client側 early preload / session-local cache を無効化するが、server起動時 prewarm までは止めない
- `?ct=1` → CTログモーダル表示
- `?entryTag=safari&netTag=4g` → テスト識別タグ
- `?debugBar=1` → 下部バー診断色
- `GET /api/debug-log` → サーバー側ログ取得
- `GET /api/mp4-log` → 初回1本目が遅い時の MP4 cache HIT/MISS / Range request 確認
- `DELETE /api/debug-log` → ログクリア

### HMRキャッシュ問題
大きな変更後: `rm -rf node_modules/.vite` + サーバー再起動

### Git注意
- コミットなし（No commits yet）
- `git checkout --` は初期状態に戻るので**絶対使わない**

---

## ルール
- 修正前に必ず社長 or 監督の承認を取る
- バージョン番号を必ずつける（v89c → v89d → ...）
- デプロイは承認なしに行わない
- 日本語で報告
- 動画パイプラインと画像パイプラインは分離して考える
- `server/tikTokVideoGallery.test.ts` は v10.33 系の歴史的テスト。現行 v89b / v89c の挙動保証ではない。最終判断は iPhone Safari 実機
- 「黒画面が短いからOK」で済ませない
