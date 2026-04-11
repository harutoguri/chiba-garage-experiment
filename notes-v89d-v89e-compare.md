# v89d rollback後 vs v89e悪化時 比較メモ

## 目的
- 社長の次ログが来た時に、問題が `v89e` 固有の悪化か、もともと残っていた問題かを即座に切り分ける。
- 新規実装用メモではなく、比較観点の固定が目的。

## 監督の現仮説
- `v89e` の canvas retain はかなり濃い悪化要因。
- 初回 20 秒級遅延が `v89e` だけのせいかは未確定。
- rollback後に症状が戻れば、`v89e` 犯人でほぼ確定。

## 比較表

| 比較軸 | v89d rollback後 | v89e悪化時 | 現時点の見立て |
|---|---|---|---|
| 初回COLD速度 | baseline。少なくとも `v89e` ほどの大崩れは前提にしない | attach後 20.8 秒で初再生の個体あり | `v89e` の retain/canvas 負荷が濃いが、単独犯かは未確定 |
| 画像only黒画面 | まだ残課題の可能性あり。`imgReady` 待ち + 親黒背景は元から候補 | `v89e` の主犯とは限らない | rollback後にも残るなら元からの問題線が濃い |
| fake thumb頻度 | `frame_seen` 後 suppress 前提。残っても限定的なはず | capture失敗 → fallback thumb 乱発 → クソサムネ全面復活 | ここは `v89e` 固有悪化の本命 |
| 戻り時黒画面 | 既存残課題の可能性あり。ただし `active target protection` が効いていれば悪化は限定的 | retain失敗 / fallback支配で悪化しうる | rollback後に改善するか要確認 |
| frame_seen周辺の挙動 | `frame_seen` 後は thumb suppress が基本挙動 | retain狙いが capture失敗で fallback支配になり、suppressの利きが弱まる | `v89e` で既存方針が崩れた可能性大 |
| active target protectionの効き具合 | `v89d_active_target_protected` が効けば PRECON/INACTIVE kill を active target に当てない想定 | retain系追加処理で別経路悪化の可能性 | rollback後ログで protection が素直に効くか確認したい |

## 軸ごとの補足

### 初回COLD速度
- `v89e` では初回 COLD が大崩れした。
- rollback後に初回速度が戻るなら、retain/canvas が強い犯人。
- rollback後も遅いなら、`v89e` 以外の既存ボトルネックも残っている。

### 画像only黒画面
- ここは `v89e` 固有とはまだ言えない。
- 既存コード上は `PinchZoomImage` の `imgReady` 待ち + 親黒背景が候補。
- rollback後も残るなら「元から残っていた問題」側で扱う。

### fake thumb頻度
- ここは `v89e` の失敗構造と直結。
- capture失敗時に fallback thumb が支配的になったなら、`v89e` 固有悪化と見てよい。

### 戻り時黒画面
- `v89d` 時点でも完全解決とは言い切れない。
- ただし `v89e` は retain失敗で見え方をさらに崩した可能性がある。
- rollback後の改善量を見ると切り分けしやすい。

### frame_seen周辺
- 基本線は「real frame seen 後は fake thumb を戻さない」。
- `v89e` は retain失敗で fallback thumb が前に出る構造になり、この原則を壊した疑い。

### active target protection
- `v89d` には `v89d_active_target_protected` ログがあり、active target には PRECON/INACTIVE kill を当てない意図がある。
- rollback後ログでこの protection が効いているかは要確認。

## 次ログで優先して見たいもの
- 初回COLDの first frame / first playing 時刻
- fake thumb が出た時、`frame_seen` 後なのか前なのか
- 戻り時黒画面が rollback後に減るか据え置きか
- `v89d_active_target_protected` が出ているのに黒画面化するか
- image-only 車両で `imgReady` 待ち由来の黒が残るか

## 暫定判定ルール
- rollback後に初回速度と fake thumb頻度が戻る:
  - `v89e` 固有悪化の可能性が高い
- rollback後も image-only 黒画面が残る:
  - それは `v89e` ではなく元からの残課題線が濃い
- rollback後も戻り時黒画面が残る:
  - active target protection だけでは塞げていない別経路を疑う
