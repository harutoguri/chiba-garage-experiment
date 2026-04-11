# 動画が表示されない根本原因

## 問題
- 動画のsrcは正しく設定されている
- readyState: 4（HAVE_ENOUGH_DATA）
- paused: false（再生中）
- currentTime: 進行している
- **videoWidth: 0, videoHeight: 0** ← これが問題

## 原因
動画ファイルは`.mov`形式（QuickTimeコンテナ）で、Content-Typeは`video/quicktime`。

ChromiumベースのブラウザはQuickTime形式の動画を**音声のみ**再生できる場合があるが、
**映像フレームのデコード**ができない場合がある。

特に、.movファイルがProResやHEVCなどのコーデックを使用している場合、
Chromiumではデコードできない。

## 解決策

### 方法1: 動画をMP4（H.264）形式に変換してアップロード
- 最も確実な方法
- ユーザーが動画をアップロードする際に、MP4形式に変換する

### 方法2: Bunny Streamのトランスコード済みMP4を使用
- Bunny Streamは自動的にH.264 MP4にトランスコードする
- ただし、CDN Token Authenticationが有効なため、直接アクセスできない

### 方法3: サーバーサイドで動画を変換
- FFmpegを使用して.movをMP4に変換
- ただし、本番環境にFFmpegがない

### 方法4: Bunny Streamのiframe埋め込みを使用
- 背景動画には不向き（iframeは背景として使いにくい）
- ギャラリー再生には適している

## 推奨解決策
1. **短期**: 動画アップロード時にMP4形式を推奨するメッセージを表示
2. **中期**: Bunny StreamのCDN Token Authenticationを無効化
3. **長期**: 動画アップロード時にサーバーサイドでMP4に変換
