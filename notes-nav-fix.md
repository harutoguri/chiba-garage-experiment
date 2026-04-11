# Nav Tab Fix Analysis

## Problem
委託在庫タブに遷移すると下のナビゲーションタブが選択できない

## Root Cause
- Layout.tsxのnav: `fixed bottom-0 z-40` (h-12 + safe-area-inset-bottom)
- Consignment.tsxのsnap container: `h-[calc(100vh-4rem)]` = viewport - 64px
- スマホでは100vhがアドレスバー含む高さなので、実際の表示領域より大きい
- snap containerがnav領域の背後まで伸びている
- snap containerのoverflow-y-scrollがタッチイベントを消費してnavのクリックが効かない

## Fix
- snap containerの高さを `h-[calc(100dvh-4rem)]` に変更（dvh = dynamic viewport height）
- 各snap-startアイテムも同様に変更
- padding-bottomを追加してnavの高さ分のスペースを確保
- VideoFeed.tsxも同様に修正

## Files to Fix
1. Consignment.tsx: lines 522, 533, 536, 637
2. VideoFeed.tsx: lines 585, 594, 613
