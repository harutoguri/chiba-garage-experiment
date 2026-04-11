# 現在の未解決課題メモ

## 1. 回復したもの
- 初回COLD速度
- image-only黒画面

## 2. 未解決
- 戻り時クソサムネイル
- ケツ見え
- 戻ると途中再生

## 3. 仮説
- fake thumb単体ではなく、別の表示源が前に出ている可能性
- `currentTime` reset 不全で、戻り時に途中フレーム / 途中再生が残っている可能性

### v89f仮説
- ケツ見えの直接原因は resume path の `currentTime` 未リセット
- `__attachedUrl === hlsUrl` による resume 扱いが発火条件
- 今回は speed 問題ではなく return / reset 問題として対処
- 次判定は「ケツ見え」「途中再生」「visual_source=thumb有無」

### v89fログで確定した表示源問題
- `v89f_reset_ct` から、ケツ見え対策は前進
- `v89f_visual_source active=thumb` が fake thumb の直接証拠
- `v89f_visual_source active=unknown` が黒画面の直接証拠
- 次修正は speed ではなく activation visual policy

### 確定事項
- `v89f` はケツ見え修正として有効
- `v89h` は表示源修正として未達
- 根拠は `frame_seen=true` なのに `active=thumb` と `active=unknown` が出ていること
- 次の修正対象は stop 側ではなく visual source resolver / render source selector

### 追加確定事項
- `v89i` で render 層の thumb 復活問題はほぼ確定修正
- ただし未解決の主因は `frame_seen=true` の video-only 経路で、detach 後の空 video が黒として見えること
- 初見車両の fake thumb はまだ仕様として残存
- 次の本命は canvas ではなく deferred detach / paused frame retention

### v89jの狙い
- `v89j` は `frame_seen=true` 限定の deferred detach
- 狙いは「video-only なのに空 video で黒になる」問題の解消
- 実機判定対象は 1⇄2 往復の戻り黒画面
- 初見 fake thumb は今回の主対象外

### v89j追記
- `v89j` は black gap を一部改善したが、700ms timeout が早すぎて失敗
- 本丸は `frame_seen=true` なのに `source=video / rs=0` で、既見セルの self-frame 不保持
- 次の本命は seen-adjacent keepalive
- 初見セルは `source=thumb` 判定でも社長体感は黒で、thumb layer 実表示崩れが別 issue

### v89k判定観測点
- `v89j` 比で、1⇄2往復の戻り黒画面がさらに減るか
- `frame_seen=true` の既見セルで `source=video / rs=0` が消えるか
- 初見セルの `source=thumb` 体感黒が残るか、既見セル問題と切り分けられるか

### v89k確定事項
- `v89k` は seen-adj keepalive として有効
- 戻り黒の主因はかなり改善
- 未解決本丸は `frame_seen=false / source=thumb` なのに `thumbVis=no-thumb` になる初見 adjacent
- 次の判定対象は keepalive ではなく thumb DOM 実体

## 4. 禁止事項
- `v89e` 系の canvas retain 再導入禁止
- speed path への再介入禁止
