# HANDOFF.md — チバガレージ TikTok Video Gallery 引き継ぎ資料

**作成日:** 2026-03-30
**現在BUILD:** v93d
**メインファイル:** `/Users/harutoguri/Downloads/chiba-garage-web-new/client/src/components/TikTokVideoGallery.tsx` (1078行)

---

## 1. 現在の状態

### v93d (最新・iPhone実機テスト待ち)
- **50ms debounce** を MediaCell の ACTIVE 判定に追加
- 高速スクロール時の黒画面（src設定→canplay前にキャンセル）を防止
- TikTok iPhone Safari 完全再現の再生シーケンス維持

### 再生シーケンス (TikTok準拠)
```
ACTIVE:
  50ms debounce → video.src = mp4Url → video.load()
  → canplay → video.play()
  → playing → サムネイル非表示

INACTIVE:
  video.pause() → video.removeAttribute("src") → video.load()
  → サムネイル表示
```

### 動作確認済み (v93b-v93d)
- ✅ 動画再生 (MP4直接、HLS廃止)
- ✅ ループ再生 (video.loop = true)
- ✅ SOLDバッジ表示 (日本語ステータス値: "売約済み", "商談中")
- ✅ 委託車両バッジ (isConsignment)
- ✅ スクロール速度 (v66f touch-assist復元: 250ms ease-out, 8%/0.15感度)
- ✅ 高速スクロール時の黒画面防止 (50ms debounce)

---

## 2. ファイル構成

| ファイル | 役割 |
|---------|------|
| `client/src/components/TikTokVideoGallery.tsx` | メインコンポーネント (1078行, v93d) |
| `client/src/components/VideoFeed.tsx` | Vehicle→VehicleData変換、Gallery呼出し |
| `client/src/lib/bunnyUrls.ts` | Bunny CDN URL生成 (MP4/サムネ/Embed) |
| `memory/TikTokVideoGallery_v66f.tsx` | 安定バックアップ (2681行, HLS時代) |

### TikTokVideoGallery.tsx エクスポート
- `default` — TikTokVideoGallery コンポーネント
- `startEarlyPreload` — no-op stub (後方互換)
- `MediaCell` — 個別セル (動画/画像)
- `VehicleData` (type) — 車両データ型
- `MediaItem` (type) — メディアアイテム型
- `getImageSrc` — 画像URL取得
- `getFirstImageUrl` — 最初の画像URL
- `DetailSheet` — 詳細シート

---

## 3. 重要な型定義

### MediaItem
```typescript
interface MediaItem {
  id: number;
  type: "video" | "image";
  url: string;
  bunnyVideoId?: string | null;  // null許容（VideoFeed/ConsignmentFeedがnull渡す）
  thumbnailUrl?: string | null;
  thumbTs?: number | null;
  optimizedUrls?: string | null;
  displayOrder?: number;
}
```

### VehicleData
```typescript
interface VehicleData {
  // ... 車両フィールド
  media: MediaItem[];  // required（undefinedでクラッシュ防止）
  status?: "在庫あり" | "商談中" | "売約済み" | string;  // APIは日本語返す
  isConsignment?: boolean;
  description?: string | null;
}
```

---

## 4. 絶対変更禁止ルール

- v88cの多重起動・hidden bootstrap・boot kill・React direct src → **変更禁止**
- WARM gate・Brand Gate・初回再生速度 → **変更禁止**
- `__cold_poster` (index.html brand gate) → 最初の `playing` イベントで除去

---

## 5. 未完了タスク

### 優先度: 高
- **iPhone実機テスト v93d** — debounce fix の動作確認待ち
- **縦スクロール+動画再生+ループの完璧化** — 監督指示: これを最優先

### 優先度: 中
- **横スワイプ修正** — 監督指示: "横スワイプは後回し"
- **サムネイル色味不一致** — ffmpeg frame0 抽出のサーバーサイド実装が必要

### 優先度: 低
- **v66f ベース全書き直し** — v93a構造のまま修正を重ねた。v66fの全UI復元は未完了
  - v66f (2681行) vs 現在 (1078行) → UIコンポーネントが簡略化されている可能性

---

## 6. 動画URL体系

```
MP4再生:    https://vz-2e234254-464.b-cdn.net/{videoId}/play_720p.mp4
サムネイル:  /api/thumb?id={videoId}  (サーバープロキシ経由、Referer問題回避)
ポスター:   https://vz-2e234254-464.b-cdn.net/{videoId}/thumbnail.jpg
HLS:       deprecated (v92aでMP4移行)
```

---

## 7. 開発環境

- **Vite dev server:** localhost:3000
- **iPhone実機:** 192.168.3.2:3000 (IP変動あり → ifconfigで確認)
- **Debug logs:** POST/GET/DELETE `/api/debug-log`
- **HMRキャッシュ問題:** 大きな変更後は `rm -rf node_modules/.vite` + サーバー再起動

---

## 8. 運用プロトコル

### 役割
- **社長** = ユーザー（実機確認のみ）
- **監督** = ChatGPT Atlas（設計判断・指示）
- **新人** = Claude Code（実装・保守・監視の全実行）

### 通信
- オペレーター通信: `pbcopy → Terminal activate → Cmd+V → Enter`、**英語のみ**、ANSI色コード禁止
- Atlas通信: ChatGPTデスクトップアプリ経由
- screencapture使用禁止（シャッター音が出る）

### Git注意
- コミットなし（No commits yet）
- `git checkout --` は初期状態に戻るので**絶対使わない**
