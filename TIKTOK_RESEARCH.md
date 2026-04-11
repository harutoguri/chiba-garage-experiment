# TikTok Web版 技術調査（実機確認）

## 調査日: 2026-03-29
## 調査方法: Mac Safari + Web Inspector (do JavaScript) + fetch interceptor

---

## 1. PC Safari (Mac) での確認

### video要素
- **video要素数**: 2個（固定プール）
- **初回ロード時**: 両方 `<video src="直接MP4URL">` （blob:なし）
- **スクロール後**: **blob: URL に切り替わる**（MSE使用）
- **preload**: `auto`
- **muted**: `true`（初期状態）、再生中は `muted: false` に変化
- **crossOrigin**: `use-credentials`

### ★ 重要発見: ハイブリッド方式

**初回表示（COLD）:**
- video.src = `https://v16-webapp-prime.tiktok.com/video/tos/...` （直接MP4）
- initiatorType = `video`（ブラウザネイティブ読み込み）
- blob: URL なし → MSE不使用
- 解像度: 576x1024

**スクロール後（2本目以降）:**
- video.src = `blob:https://www.tiktok.com/xxxxx` → **MSE使用**
- JS fetch() で MP4 を **Range Request** で部分取得
- fetch headers: `{"Range": "bytes=474089-"}`, `{"Range": "bytes=938346-"}`
- 取得した MP4 データを MediaSource SourceBuffer に投入
- 解像度: 720x1280（初回より高い）

### fetch interceptor で捕捉したリクエスト

```
1回目スクロール:
  URL: v16-webapp-prime.tiktok.com/video/tos/.../oAwD4tTz...
  Method: GET
  Headers: {"Range": "bytes=474089-"}
  credentials: include

2回目スクロール:
  URL: v16-webapp-prime.tiktok.com/video/tos/.../osnDZ...
  Method: GET
  Headers: {"Range": "bytes=938346-"}
```

→ TikTok は **MP4ファイルの途中から** Range Request で取得している
→ moov atom（メタデータ）は先頭にある前提（faststart）
→ 先頭部分は別のリクエストで先に取得済み、残りを追加取得

### video要素の状態変化

| タイミング | video[0] | video[1] |
|---|---|---|
| 初回ロード | src=直接MP4, playing | src=直接MP4, paused |
| 1回目スクロール | src=直接MP4, playing | src=**blob:**, paused, rs=4 |
| 2回目スクロール | src=**blob:**, playing | src=**blob:**, paused, rs=0 |

→ video要素を**リサイクル**。再生中のvideoと次のvideoを交互に使用

### Service Worker
- **登録あり**: `https://www.tiktok.com/sw.js`（3523 bytes）
- **Workbox** 使用（Google製SWライブラリ）
- **用途**: PWA用アセットキャッシュのみ
  - スプラッシュ画像: precacheAndRoute
  - CDN静的ファイル: CacheFirst（7日有効期限）
  - フォントファイル: CacheFirst（7日有効期限）
  - sf-tb-sg.ibytedtos.com: NetworkFirst
- **動画キャッシュ**: なし（sw.jsに video/mp4/m3u8/range の文字列なし）
- **結論**: SWは動画再生に一切関与していない

### MediaSource / MSE
- `MediaSource`: ブラウザに存在
- `ManagedMediaSource`: ブラウザに存在
- **実際の使用**: あり（2本目以降でblob: URL確認）

### CDN
- ホスト: `v16-webapp-prime.tiktok.com`
- 配信: **Akamai**（AkamaiGHost）
- `accept-ranges: bytes` → Range Request サポート
- `access-control-allow-headers: range` → CORS で Range 許可
- 署名付きURL（expire + signature パラメータ）

### URL パラメータ
- `a`: 1988（アプリID）
- `br`: ビットレート（1656, 1676）
- `bt`: 828, 838
- `mime_type`: video_mp4
- `qs`: 11（品質スコア）
- `ply_type`: 2
- `expire`: 署名有効期限
- `signature`: ハッシュ署名
- `tk`: tt_chain_token

### ネットワーク統計（Network タブ）
- 総リクエスト数: 356
- 総転送サイズ: 19.2MB
- video関連JSファイル:
  - `video-player.7470ebe.js` — 5.54KB
  - `video-content-side-effect.2fbcba33.js` — 7.69KB
  - `stories-player.da285679.js` — 23.90KB

---

## 2. iPhone Safari での確認（実機Web Inspector調査済み 2026-03-29）

### 調査方法
- Mac Safari → 開発メニュー → iPhone → TikTok（Safari内WebView）
- Web Inspectorのコンソールタブで JavaScript 実行
- ネットワークタブで全リクエストのヘッダーを確認
- iPhone上でTikTok動画を一時停止した状態で調査

### video要素
- **video要素数**: 1個
- **src**: `https://v16-webapp-prime.tiktok.com/video/tos/alisg/...` （直接MP4 URL）
- **blob: URL なし** → MSE不使用
- **preload**: `auto`
- **muted**: `true`
- **playsinline**: あり
- **readyState**: 4 (HAVE_ENOUGH_DATA)

### ★ 重要発見: PC版と完全に違う

| 項目 | PC版 (Mac Safari) | iPhone版 (iOS Safari) |
|---|---|---|
| 初回 | MP4直接URL | MP4直接URL |
| 2本目以降 | MSE (blob:) に切替 | **MP4直接URLのまま** |
| MediaSource | 使用あり | **undefined（存在しない）** |
| ManagedMediaSource | 存在 | **存在するが未使用** |
| video要素数 | 2個プール | **1個** |
| Range Request | JS fetch() | **ブラウザネイティブ** |

### MediaSource確認結果
```javascript
typeof MediaSource    // → "undefined"
typeof ManagedMediaSource  // → "function"
```
→ iPhone SafariにはMediaSourceが存在しない。MSE方式は物理的に不可能。
→ ManagedMediaSourceは存在するがTikTokは使っていない。

### ネットワーク — Safari Range Requestの3ステップ

TikTok動画1本に対してSafariが自動的に3つのリクエストを発行:

**リクエスト1: プローブ（844B）**
```
Request:  Range: bytes=0-1
Response: 206, Content-Range: bytes 0-1/4625498, Content-Length: 2
```
→ moov atomの存在確認 + ファイルサイズ取得

**リクエスト2: フルリクエスト（~4.41MB）**
```
Request:  Range: bytes=0-4625497
Response: 206, Content-Range: bytes 0-4625497/4625498
```
→ ファイル全体のダウンロード開始

**リクエスト3: moov以降（~4.37MB）**
```
Request:  Range: bytes=49143-4625497
Response: 206, Content-Range: bytes 49143-4625497/4625498
```
→ moov atom（先頭49,143バイト）を読み終えた後、映像データ本体を取得

### リクエストヘッダー詳細
```
Sec-Fetch-Dest: video        ← ブラウザネイティブ（JSのfetch()ではない）
Sec-Fetch-Mode: no-cors
Sec-Fetch-Site: cross-site
Accept: */*
Accept-Encoding: identity     ← 動画は圧縮不要
Referer: https://www.tiktok.com/
```

### レスポンスヘッダー詳細
```
Content-Type: video/mp4
Accept-Ranges: bytes
Cache-Control: max-age=2592000  ← 30日キャッシュ
Server: AkamaiGHost
Access-Control-Allow-Origin: https://www.tiktok.com
```

### 動画スペック
- **解像度**: 720x1280（720p固定）
- **ビットレート**: ~2962kbps（URLパラメータ br=2962）
- **コーデック**: H.264（iPhoneハードウェアデコード対応）
- **moov atomサイズ**: ~49KB（先頭配置 = faststart）
- **ファイルサイズ**: ~4.4MB（15秒程度の動画）

### Service Worker
- iPhone版でも動画に一切関与なし（PC版と同じ）

### 結果（体感）
- 0フレームサムネイル（動画の最初のフレームが即表示）
- 720p最初から（360p→720p遷移なし）
- 再生開始 0.5秒以下
- 黒画面ゼロ
- クソサムネゼロ

---

## 3. 確定事実（PC + iPhone 両方実測）

### 共通
1. 動画は **MP4** フォーマット（HLSではない）
2. Service Worker は **動画に一切関与なし**（PWAアセットのみ）
3. CDN は **Akamai**、Range Request サポート、30日キャッシュ
4. **MP4 faststart** — moov atom先頭配置が前提

### PC版のみ
5. **ハイブリッド方式**: 初回は直接MP4、2本目以降はMSE (blob:)
6. **fetch() + Range Request** でMP4を部分取得
7. **video要素 2個のプール** — リサイクル方式
8. xgplayerの直接証拠は確認不可（難読化）

### iPhone版のみ
9. **MP4直接URL一本** — MSE一切不使用（MediaSource === undefined）
10. **ブラウザネイティブRange Request** — JSのfetch()ではない
11. **video要素 1個** — プール不要
12. **Safari自動3ステップ**: probe(0-1) → full → data after moov

## 4. ChatGPT分析との比較

| 項目 | ChatGPT分析 | PC実測 | iPhone実測 |
|---|---|---|---|
| xgplayer使用 | ○ | 確認不可（難読化） | N/A（MSE自体なし） |
| MSE使用 | ○ | **○（2本目以降）** | **×（undefined）** |
| Range Request | ○ | **○（JS fetch）** | **○（ブラウザネイティブ）** |
| SW未使用(動画) | ○ | **○** | **○** |
| MP4配信 | ○ | **○** | **○** |

→ ChatGPTの分析はPC版について概ね正確。ただし**iPhone版はMSE不使用という最重要事実が欠落**していた。

## 5. 千葉ガレージ実装方針

### ターゲット: iPhone Safari（TikTok iPhone版と同一方式）

千葉ガレージのユーザーはiPhoneメイン。PC版MSEハイブリッドは後回し。
**iPhone版TikTokが最もシンプルかつ最速** → これを完全再現する。

### やること（Bunny CDN完全撤去）
1. **FFmpeg `-movflags +faststart`** で720p H.264 MP4エンコード
2. **Cloudflare R2** にMP4ホスト（エグレス無料、Range Request対応）
3. **`<video src="R2_URL" preload="auto" muted playsinline>`** — これだけ
4. **hls.js完全撤去** — HLS_CONFIG、attachOnly、attachAndPlay、getVariantUrl全部消す
5. **frame0Precache簡略化** — MP4 preload="auto"で最初のフレームが自動取得される
6. **TikTokVideoGallery.tsx** — 4254行のHLSハック層を剥がして大幅簡略化

### やらないこと（iPhone版には不要）
- MSE / MediaSource / ManagedMediaSource
- xgplayer
- Service Worker動画キャッシュ
- HLS（完全廃止）
- blob: URL

### PC版対応（後回し）
- iPhone版が完成してから検討
- MSEハイブリッド方式を追加する形（iPhone版コードに上乗せ）
