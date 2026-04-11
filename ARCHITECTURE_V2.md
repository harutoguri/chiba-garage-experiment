# チバガレージ V2 アーキテクチャ設計書

## 目標
- TikTok級のスワイプ動画体験（黒画面ゼロ、即再生）
- iPhone/Androidから誰でも簡単に動画アップロード→自動掲載
- Bunny CDN依存脱却、自前エンコーディング
- 1ヶ月で完成

## 現状の問題
- Bunny CDN → HLS配信 → iOS Safariの同時HLSセッション上限（6-8本）に引っかかる
- HLS = manifest取得 + segment取得 = 初回再生まで2-5秒
- サムネイル = Bunny生成のJPEG（色味違い=クソサムネ）
- keepalive/guard/bridge等の複雑なhack層が30+バージョン積み重なり破綻

## V2設計

### 1. 動画配信方式: MP4 Progressive Download
- HLSを廃止。MP4 progressive downloadに切り替え
- 理由: iOS Safariで同時接続制限なし。Range requestで即再生開始
- 品質: 720p（メイン） + 360p（プリロード用） + 4K（オプション）
- フォーマット: H.264/AAC MP4（全デバイス対応）

### 2. 自前エンコーディングパイプライン
```
スマホで撮影 → アップロード → サーバーでFFmpeg処理 → 3品質MP4生成 → S3/R2保存
```

#### エンコード仕様
- 入力: iPhone/Android撮影動画（H.265/H.264、MOV/MP4）
- 出力:
  - `{id}_360p.mp4` — プリロード用（ファイルサイズ小）
  - `{id}_720p.mp4` — メイン再生用
  - `{id}_4k.mp4` — 高品質（元が4Kの場合のみ）
  - `{id}_thumb.avif` — サムネイル（frame 0、AVIF HDR対応）
  - `{id}_thumb.jpg` — サムネイルfallback
  - `{id}_poster.jpg` — OGP/SNS用

#### FFmpegコマンド例
```bash
# 720p MP4（faststart = progressive download）
ffmpeg -i input.mov \
  -c:v libx264 -preset medium -crf 23 \
  -vf "scale=-2:720" \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -f mp4 output_720p.mp4

# Frame 0 サムネイル（AVIF）
ffmpeg -i input.mov -vframes 1 -f image2pipe - | \
  avifenc --speed 6 --min 20 --max 30 - output_thumb.avif
```

### 3. アップロードフロー（スマホ対応）

```
社長/スタッフ操作:
1. スマホでチバガレージ管理画面を開く
2. 「動画追加」ボタン → カメラロールから選択 or 撮影
3. 動画を選んで「アップロード」
4. プログレスバー表示 → 完了
5. 自動でエンコード開始 → 数分で掲載

技術フロー:
1. スマホブラウザ → <input type="file" accept="video/*" capture>
2. チャンク分割アップロード（tus protocol or multipart）
3. サーバーが受信 → 一時保存
4. FFmpegキューに追加 → バックグラウンドエンコード
5. 完了 → DB更新 → 即掲載
```

### 4. ストレージ
- **候補A: Cloudflare R2**（S3互換、エグレス無料、安い）
- **候補B: AWS S3**（実績あり、CloudFront CDN付き）
- **候補C: サーバーローカル + nginx**（最安、スケール限界あり）

#### コスト見積もり（50台 x 10本 = 500本動画）
- 平均30秒/本 x 720p = 約15MB/本
- 500本 x 15MB = 7.5GB
- R2: ストレージ $0.015/GB/月 = $0.11/月 + 無料エグレス
- S3+CloudFront: ストレージ $0.17 + 転送量次第

### 5. フロントエンド変更

#### TikTokVideoGallery.tsx v2
- HLS.js完全撤去
- video.src = MP4 URL（直接）
- preload="metadata" or "auto"（隣接セル）
- iOS SafariのMP4 Range requestで即再生
- frame 0表示 = video.currentTime=0 + seeked → canvas描画不要
- keepalive不要（MP4はsrc設定するだけで即再生可能）

#### 簡素化
- 現在3600行 → 目標1500行以下
- 30+バージョンのhack層を全撤去
- 状態機械: PLAY / PAUSE / PRELOAD の3状態のみ

### 6. 管理画面（スマホ対応）

```
/admin/upload — 動画アップロード
  - 車両選択（既存 or 新規）
  - 動画ファイル選択（複数可）
  - アップロード + プログレス
  - エンコードステータス表示

/admin/vehicles — 車両管理
  - 動画の並び替え
  - 動画削除
  - 車両情報編集
```

### 7. マイグレーション計画

#### Week 1: インフラ
- [ ] FFmpegサーバーセットアップ
- [ ] R2/S3バケット作成
- [ ] アップロードAPI実装
- [ ] エンコードキュー実装

#### Week 2: エンコーディング
- [ ] FFmpegパイプライン完成
- [ ] 既存Bunny動画をMP4に変換
- [ ] サムネイル自動生成
- [ ] 品質テスト

#### Week 3: フロントエンド
- [ ] TikTokVideoGallery v2（MP4 progressive）
- [ ] 管理画面（スマホアップロード）
- [ ] 実機テスト（iPhone/Android）

#### Week 4: 仕上げ
- [ ] パフォーマンスチューニング
- [ ] Bunny CDN完全撤去
- [ ] 本番デプロイ
- [ ] 社長最終確認

## 期待する改善
- 初回再生: 5秒 → 0.3秒（MP4 Range request）
- スワイプ切替: 4秒 → 0.1秒（src切替のみ）
- 黒画面: あり → ゼロ（MP4はsrc設定で即frame表示）
- クソサムネ: あり → ゼロ（frame 0からAVIF生成）
- ケツ見え: あり → ゼロ（MP4のcurrentTime=0が即座に効く）
- コード量: 3600行 → 1500行
