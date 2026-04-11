# チバガレージ — ローカル開発ガイド

## 概要

TikTok風の縦スクロール動画ギャラリーを中心とした中古車買取・販売サイト。
Manus上で構築されたプロジェクトを、ローカル環境で完全に動作させるためのガイドです。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + Tailwind CSS 4 + shadcn/ui |
| バックエンド | Express 4 + tRPC 11 |
| データベース | MySQL (TiDB) — Drizzle ORM |
| 動画配信 | Bunny Stream (HLS) + hls.js |
| 認証 | Manus OAuth → **DEV_MODE で完全バイパス可能** |
| ビルド | Vite + esbuild |

## クイックスタート（最短手順）

```bash
# 1. 依存関係インストール
pnpm install

# 2. 環境変数を設定
cp .env.template .env
# .env はそのまま（DEV_MODE=true）で OK

# 3. 起動
pnpm dev
```

ブラウザで `http://localhost:3000` を開くと、サイトが表示されます。

## 起動モード

### DEV_MODE=true（推奨）

Manus の OAuth / Forge API / 通知サービスに一切依存しません。

- **認証**: 固定の管理者ユーザー（`dev-admin-user`）で自動ログイン
- **データベース**: `DATABASE_URL` 未設定なら空のリストが表示される（クラッシュしない）
- **Bunny Stream**: API キー未設定でも起動可能。既存の動画は CDN 直リンクで再生可能
- **GBP**: トークン未設定でもクラッシュしない（空配列を返す）
- **ストレージ**: Forge API 未設定ならローカルの `local-storage/` ディレクトリに保存
- **通知**: Forge API 未設定ならコンソールにログ出力のみ

### DEV_MODE=false（本番相当）

Manus の全サービスに接続します。`.env` に全キーを設定する必要があります。

## データベース接続（任意）

本番データを使いたい場合は、Manus 管理画面の **Settings > Secrets** から `DATABASE_URL` を取得して `.env` に設定してください。

```bash
# .env に追加
DATABASE_URL=mysql://user:password@host:4000/dbname?ssl={"rejectUnauthorized":true}
```

### ダミーデータの挿入

```bash
# DATABASE_URL が設定されている場合のみ動作
node scripts/seed-dev-data.mjs
```

## ファイル構成

```
client/                    ← フロントエンド
  src/
    components/
      TikTokVideoGallery.tsx  ← ★ 動画ギャラリー（修正対象）
    pages/                 ← ページコンポーネント
    lib/
      bunnyUrls.ts         ← Bunny CDN URL生成
server/                    ← バックエンド
  _core/
    context.ts             ← 認証コンテキスト（DEV_MODE対応済み）
    env.ts                 ← 環境変数定義
    oauth.ts               ← OAuth（DEV_MODEでバイパス）
    sdk.ts                 ← Manus SDK
    gbp.ts                 ← Google Business Profile
    notification.ts        ← 通知（未設定時はログのみ）
  db.ts                    ← データベースクエリ
  routers.ts               ← tRPC ルーター
  bunnyStream.ts           ← Bunny Stream API
  storage.ts               ← S3ストレージ（ローカルフォールバック付き）
drizzle/
  schema.ts                ← DBスキーマ定義
scripts/
  seed-dev-data.mjs        ← ダミーデータ挿入
shared/
  const.ts                 ← 共通定数
```

## 動画ギャラリーの修正について

動画再生の問題を修正する場合、主に以下のファイルを編集します：

| ファイル | 役割 |
|---------|------|
| `client/src/components/TikTokVideoGallery.tsx` | メインの動画ギャラリーコンポーネント（HLS再生、スクロール制御、事前接続） |
| `client/src/lib/bunnyUrls.ts` | Bunny CDN の HLS/サムネイル URL 生成 |

### 現在の動画再生アーキテクチャ

1. **HLS配信**: Bunny Stream → CDN (`vz-2e234254-464.b-cdn.net`) → hls.js
2. **利用可能な解像度**: 240p, 360p, 480p, 720p, 1080p
3. **hls.js設定**: `startLevel: 2`（480p開始）、ABRで自動昇格
4. **事前接続**: 隣接±1車両のHLS接続を事前開始（play()しない）
5. **iOS対応**: hls.js の ManagedMediaSource を使用（iOS 17.1+）

### Bunny CDN URL構造

```
HLS:        https://vz-2e234254-464.b-cdn.net/{videoId}/playlist.m3u8
サムネイル:  https://vz-2e234254-464.b-cdn.net/{videoId}/thumbnail.jpg
```

## Claude Code に渡す場合

このリポジトリをそのまま Claude Code に渡せます：

```bash
# Claude Code で開く
cd chiba-garage-web
claude
```

Claude Code に伝えるべきポイント：
- `client/src/components/TikTokVideoGallery.tsx` が動画ギャラリーの本体
- HLS再生には hls.js を使用（iOS の ManagedMediaSource 対応）
- `pnpm dev` で起動、`DEV_MODE=true` で認証バイパス
- 動画は Bunny CDN から HLS で配信（API キー不要で再生可能）

## 環境変数一覧

| キー | 必須 | 説明 |
|------|------|------|
| `DEV_MODE` | ○ | `true` で Manus 依存を全バイパス |
| `DATABASE_URL` | × | MySQL 接続文字列。未設定なら空リスト表示 |
| `JWT_SECRET` | × | セッション署名。DEV_MODE ではデフォルト値使用 |
| `BUNNY_STREAM_API_KEY` | × | 動画アップロード用。再生には不要 |
| `BUNNY_STREAM_LIBRARY_ID` | × | Bunny ライブラリ ID |
| `BUNNY_CDN_TOKEN_AUTH_KEY` | × | CDN トークン認証キー |
| `GBP_CLIENT_ID` | × | Google Business Profile |
| `GBP_CLIENT_SECRET` | × | Google Business Profile |
| `GBP_REFRESH_TOKEN` | × | Google Business Profile |
| `OAUTH_SERVER_URL` | × | Manus OAuth（本番専用） |
| `VITE_OAUTH_PORTAL_URL` | × | Manus OAuth（本番専用） |
| `VITE_APP_ID` | × | Manus アプリ ID（本番専用） |
| `BUILT_IN_FORGE_API_URL` | × | Manus Forge API（本番専用） |
| `BUILT_IN_FORGE_API_KEY` | × | Manus Forge API（本番専用） |

## npm スクリプト

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # プロダクションビルド
pnpm test         # テスト実行
pnpm db:push      # DBマイグレーション（DATABASE_URL必須）
```
