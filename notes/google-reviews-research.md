# Google口コミ埋め込み調査結果

## 結論
Google公式では口コミの埋め込みウィジェットを提供していない。
以下の選択肢がある：

### 1. Elfsight Google Reviews Widget（推奨）
- 無料プランあり（月200ビュー制限）
- 埋め込みコードをコピー＆ペーストするだけ
- 実際のGoogleマップ口コミを自動取得
- URL: https://elfsight.com/google-reviews-widget/

### 2. Google Places API
- 有料（1000リクエストあたり$17）
- 開発が必要
- 最新5件の口コミのみ取得可能

### 3. 手動でスクリーンショット
- 無料だが更新が手動

## 実装方針
Elfsightの無料プランを使用するか、
Googleマップの「口コミを見る」ボタンへの誘導のみにする。

## チバガレージのGoogleマップURL
https://www.google.com/maps/place/%E3%83%81%E3%83%90%E3%82%AC%E3%83%AC%E3%83%BC%E3%82%B8/@38.5999395,141.0189689,17z/
