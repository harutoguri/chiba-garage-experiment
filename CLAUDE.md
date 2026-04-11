# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (Express + Vite HMR on port 3000)
pnpm build      # Build: Vite (frontend → dist/public/) + esbuild (server → dist/index.js)
pnpm start      # Run production build
pnpm check      # TypeScript type checking
pnpm format     # Prettier formatting
pnpm test       # Vitest unit tests
pnpm db:push    # Apply schema changes via Drizzle Kit (drizzle/schema.ts → DB)
```

## Architecture

Full-stack monorepo: React 19 frontend + Express/tRPC backend + MySQL (TiDB Cloud).

```
client/src/       → React 19 + Vite 7 frontend
server/           → Express 4 + tRPC 11 backend
shared/           → Types shared between client and server
drizzle/          → Drizzle ORM schema, relations, and migrations
```

**Request flow:** Client tRPC calls → `/api/trpc` → Express server → Drizzle ORM → TiDB Cloud MySQL

**Key architectural files:**
- `server/_core/index.ts` — Express app setup, port discovery, Vite middleware
- `server/_core/context.ts` — tRPC context; DEV_MODE auto-injects admin user, bypassing OAuth
- `server/_core/trpc.ts` — `publicProcedure` and `protectedProcedure` definitions
- `server/routers.ts` — All tRPC procedures (vehicles, media, analytics, news, etc.)
- `server/db.ts` — Drizzle ORM query helpers
- `drizzle/schema.ts` — Database tables and column definitions
- `client/src/lib/trpc.ts` — tRPC client with superjson + batch links
- `client/src/components/TikTokVideoGallery.tsx` — Core TikTok-style vertical video gallery (~50KB)

## Development Environment

`DEV_MODE=true` (set in `.env`) bypasses Manus OAuth and auto-logs in as an admin user. No authentication setup needed for local development. The database connection is optional in dev mode — missing `DATABASE_URL` returns empty arrays instead of crashing.

Access the admin dashboard at `/admin` when running locally.

## tRPC Pattern

Procedures are split into `publicProcedure` (no auth) and `protectedProcedure` (requires session). Admin-only operations use an `adminProcedure` middleware that checks `ctx.user.role === 'admin'`.

Input validation uses Zod schemas. Types flow from Drizzle's `$inferSelect`/`$inferInsert` through the router to the client.

## Video Architecture

Videos are hosted on Bunny Stream CDN via HLS. Upload flow: file → S3/Forge presigned URL → stored → background migration to Bunny Stream → `bunnyStatus` tracked as `pending → processing → ready → error`. The client uses `hls.js` with adaptive bitrate, starting at 480p. Adjacent videos are prefetched by `client/src/lib/videoPreloadManager.ts`.

CDN base: `vz-2e234254-464.b-cdn.net` (HLS), `iframe.mediadelivery.net` (embed)

## Database

Schema defined in `drizzle/schema.ts`. After changing the schema, run `pnpm db:push` to apply. Key tables: `vehicles`, `vehicleMedia`, `purchaseRecords`, `slideshowMedia`, `newsItems`, `pageViews`, `businessMetrics`.

## Image Optimization

The `server/imageOptimizer.ts` uses `sharp` to generate WebP + JPEG at sm/md/lg sizes. Resulting URLs are stored as JSON in `vehicleMedia.optimizedUrls`.

## ユーザー（チバガレージオーナー）の指示スタイル

- **日本語で応答すること**（常に）
- 辛辣なフィードバックをする。「直ってない」「ちゃんとやれ」等。指摘は正確なので素直に受け取る
- iPhoneで実機テストしている。Safariコンソールを見ている
- BUILD_ID（TikTokVideoGallery.tsx内）を変えてビルド確認する習慣がある

## Production Build & Deploy（ローカルLAN配信）

```bash
# クライアント + サーバー両方ビルド必須
cd /Users/harutoguri/Downloads/chiba-garage-web-new
npx vite build && npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# サーバー起動（ポート3000、0.0.0.0バインド）
lsof -ti:3000 | xargs kill -9 2>/dev/null
NODE_ENV=production node dist/index.js

# Mac IP確認（iPhoneからアクセス用）
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**重要**: サーバーコード（routers.ts, db.ts等）を変更した場合、`esbuild`も必ず実行すること。`vite build`だけではサーバーは更新されない。

## TikTokVideoGallery 現在の状態（v65j）

### 横スクロール（メディア切替）— v65j: overflow:hidden + JS完全制御 + 2フェーズwheel lock
- **`overflow: hidden`** + `display: flex` — ネイティブスクロール無効、JSが`scrollLeft`を直接制御
- **`touch-action: pan-y`** → ブラウザは横スクロールを一切しない（ゴムバンド根絶）
- **Touch (iPhone)**: JSが`touchMove`で`scrollLeft`を直接制御（clamp付き）、`touchEnd`でrAFアニメーション
- **Wheel (Mac trackpad)**: モジュールレベル2フェーズlock（animating→cooling→idle）で慣性制御
  - `isActiveRef`チェックで非アクティブインスタンスの重複処理防止
  - deltaXフィルター: `ax < 2 || ax * 2 < ay`
- CSS `scroll-snap` 廃止 — JSがスナップも制御
- ファイル: `client/src/components/TikTokVideoGallery.tsx`

### 縦スクロール（車両切替）— CSS scroll-snap + touch-assist
- `scroll-snap-type: y mandatory` は維持
- touch-assist: touchStart→snap無効、touchEnd→scrollTo(smooth)、scrollEnd→snap復元
- snapSettled ゲート: scroll中はfalse（全動画pause）、snap確定でtrue（active動画play）

### MediaCell 状態機械
- PLAY: `isActive && isSnapSettled` → HLS attach + play
- PRECONNECT: `(isActive && !isSnapSettled) || isPreconnect` → manifest取得のみ
- INACTIVE: detach + poster表示

### HDR対応（v52）
- video frame 0を"サムネイル"として使用（TikTok本家と同じ）
- JPEG(SDR)ではHLG動画の色を再現不可能 → video frame 0で解決

### SwipeHintOverlay
- 表示時間: 5秒（v54で3s→5s変更）

### gzip圧縮（v55b）
- `server/_core/vite.ts`の`serveStatic`にgzipハンドラ追加
- JS/CSSアセットをzlib.gzipSync(level:6)で圧縮配信
- 1,268KB → 365KB（71%削減）
- gzipCacheでメモリキャッシュ（同一ファイルは1回圧縮）

### 委託在庫ページ（Consignment.tsx）
- `listConsignmentWithMedia` — 1リクエストで車両+メディア取得（v54で2段ウォーターフォール解消）
- `<Layout>`で囲んで底タブ表示（在庫一覧と同じ見た目）
- 説明セクションで最初の動画HLSを`startEarlyPreload`で先行取得

## セッション引き継ぎ（2026-03-06時点）

### バージョン履歴（v52〜v65j）

1. **v52**: HDRサムネイル対応（video frame 0をサムネとして使用）
2. **v53**: 横スクロールのunification（在庫一覧と委託在庫で同じ挙動）
3. **v54**: 委託在庫ページ高速化（2クエリ→1クエリ）、Layout追加、SwipeHint 3s→5s、touch方向判定追加、メディアプリロード追加
4. **v55**: touch-action:pan-y + JS手動制御。PinchZoomImageスピナー問題発生
5. **v55b**: PinchZoomImage修正 + gzip圧縮追加。**ユーザー確認: 横スワイプ正常動作**
6. **v65e〜v65j**: Mac trackpadの横スワイプ（wheelイベント）修正を試行。**全て失敗、v55bより悪化した**
   - v65e: gap-based detection (100ms) → 慣性リーク
   - v65f: gap 400ms → lastWheelTimeが全イベントで更新され機能せず
   - v65g: idle timer 200ms → 複数インスタンス重複で50%検出
   - v65h: spike detection → 誤検出多発 / native scroll → scroll-snap-stop:always無効
   - v65i: 2フェーズlock（per-instance変数）→ 62%検出、ダブル発火
   - **v65j（現在）**: モジュールレベルphase変数 + isActiveRef + deltaXフィルター緩和。未テスト

### ユーザーが報告した未修正バグ（全件）

1. **横スワイプが効かない時がある** — スワイプしても反応しない（Mac trackpad。v55bでは正常だった）
2. **1回スワイプしただけで2枚以上飛ぶ** — 慣性イベントの制御不全
3. **横スワイプの端（最後のメディア）で画面半分黒くなる** — 全車両・全ページで発生
4. **けつ見え** — 縦スワイプでA→B→Aに戻った時、Aの動画が途中位置から一瞬見える
5. **サムネイルと動画の色が全然違う** — SDR(JPEG) vs HDR(HLG動画)の色空間差異
6. **初回動画再生が遅すぎる** — 両ページ（在庫一覧・委託在庫）で発生

### 現在のサーバー状態

- ポート3000でVite dev server（HMR）が動作中
- ファイル: `client/src/components/TikTokVideoGallery.tsx`（BUILD_ID = "v65j"）

### 重要な注意事項

- **Gitリポジトリ未初期化** — コミットがないため過去バージョンに戻せない
- **コード変更前に必ずバージョン番号を振ること**（ユーザーからの明確な指示）
- **v55bの横スワイプは正常だった**（ユーザーが映像記録で確認済み）。v65系の変更で壊した
- ユーザーへの応答は**日本語**で
