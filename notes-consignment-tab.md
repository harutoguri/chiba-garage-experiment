# 委託在庫タブの問題分析

## 現在の状態
- 委託在庫ページ (/consignment) は表示されている
- 下部タブバー（在庫一覧、委託在庫一覧、買取、販売、会社概要、特商法）は表示されている
- タブはクリック可能に見える（index 13-18）

## 問題の可能性
- Consignment.tsxのsnap-y snap-mandatoryコンテナが画面全体を占有し、下部タブのクリックイベントを妨害している可能性
- z-indexの問題: snap containerがタブバーの上に被さっている可能性
- overflow-y-scrollのコンテナがタブバーの領域まで拡張されている可能性

## 修正方針
- Consignment.tsxのメインコンテナの高さを`h-[calc(100vh-4rem)]`に制限し、下部タブバーの領域を確保する
- 下部タブバーのz-indexを確認し、snap containerより上に配置する
