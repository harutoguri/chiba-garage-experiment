# チバガレージ — AI向け最短版

## 1. 案件の目的
- 目的は、チバガレージの縦動画ギャラリーを iPhone Safari で TikTok / Reels 級に自然で速く見せること。
- 最優先は初回1本目の立ち上がりと、2本目以降の縦スワイプで破綻しないこと。
- 速さだけでなく自然な見え方が重要。黒画面、fake thumb、クソサムネ、止まり絵を極力出さない。fake thumb復帰はNG。

## 2. 勝ち筋
- 核は `v88c` 系: hidden bootstrap video / boot kill / React direct src。
- 初期表示は Brand Gate 前提。UIより先に不自然なものを見せない。
- 動画管理は 1セッション主義。active 以外の動画セッションは kill。
- 一度 real frame を見せた動画は、seenRealFrame 後に fake thumb を戻さない。
- 現行の基準ビルドは `v89c`。`v89b` の表示レイヤー修正を引き継ぎつつ、placeholder attach 封鎖と grace 残留対策が入っている。

## 3. 未解決
- 初回1本目と2本目は良い回があるが、3本目以降で黒画面 / クソサムネ / 停止がまだ残る。
- 高速スワイプや往復で崩れる個体がある。image-only 車両も要注意。
- 完了判定は必ず iPhone Safari 実機。notes や test より実機が最終判断。

## 4. 誤認禁止
- これは React / Vite 単体案件ではない。Express + embedded Vite dev server + server-side injection + client-side playback pipeline。
- 動画配信は Bunny HLS。iOS native HLS と hls.js の hybrid 前提。
- `?cold=1` は client 側 early preload / session-local cache を無効化するが、server 起動時 prewarm までは止めない。
- `npm run dev` は通常 `localhost:3000` だが、埋まっていれば `3001+` に自動退避する。cloudflared は実際に起動したポートへ向ける。
- 古い notes / test は補助資料であって現行保証ではない。特に `server/tikTokVideoGallery.test.ts` は歴史的テスト。

## 5. 最重要ファイル
- コア5: `client/src/components/TikTokVideoGallery.tsx` / `client/src/lib/cold-timing.ts` / `client/src/components/VideoFeed.tsx` / `client/index.html` / `client/src/components/Layout.tsx`
- COLD経路で重要: `server/_core/index.ts` / `server/_core/vite.ts`
- `BUILD_ID` の管理位置は `client/src/components/TikTokVideoGallery.tsx`

## 6. 禁止事項
- fake thumb を再び前面に戻すこと
- React ownership conflict を起こす変更
- hidden bootstrap video / boot kill / React direct src を壊すこと
- 実機未確認のまま「直った」「完了」と断定すること

## 7. 確認先
- `GET /api/debug-log`
- `GET /api/mp4-log`
- `__FIRST_VIDEO_DATA__` の注入経路
- iPhone Safari 実機の COLD ログと first frame の見え方

- これは「初回再生の速さ」だけでなく「自然な見え方」を守る案件。
- 勝ち筋は `v88c` 系 + Brand Gate + 1セッション主義 + seenRealFrame 後 thumb 禁止 + 現行 `v89c`。
- 誤認しやすい点は server 依存、`?cold=1` の効き方、可変ポート、古い notes/test 非保証、そして最終判断が実機であること。
