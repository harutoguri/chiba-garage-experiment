# Progress Notes

## Phase 1: 背景動画HLS直接再生方式 - 完了
- VideoFeed.tsx: BackgroundVideoをHLS直接再生方式に切替済み
- ConsignmentFeed.tsx: 同上
- Consignment.tsx: 同上
- TypeScriptエラー: 0
- プレビュー: 在庫一覧ページ正常表示（Prius画像表示確認）

## Phase 2: TikTokVideoGallery v6 全面作り直し - 進行中
- TikTokVideoGallery.tsx: 全面書き直し完了
  - scroll-snap → CSS animation (translateY/translateX) ベースの遷移
  - 操作軸: 縦=車両切替、横=同車両内メディア切替
  - スマホ: タッチスワイプ + CSS transition
  - デスクトップ: 2カラム固定（左=車両情報+サムネ、右=メディア大表示）
  - HLS直接再生（poster/再生ボタン禁止）
  - vehicleId+mediaIdでkey付け → 状態同期保証
  - 境界ラップアラウンド対応

## 残タスク
- [ ] 委託在庫タブの操作不能問題修正
- [ ] テスト作成・実行
- [ ] チェックポイント保存
