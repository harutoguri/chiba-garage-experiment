# v89e 失敗分析

## 結論
- `v89e` は全撤回。
- 方向性そのものは完全否定ではないが、実装タイミングと保護条件が悪く、`v89d` の勝ち筋を崩した。

## 失敗の構造

### 1. canvas capture失敗多発
- `readyState < 2`、または `videoWidth = 0` の状態で capture を試行していた。
- capture 失敗時に fallback thumb へ流れたため、fake thumb / クソサムネが全面復活した。
- 「retainしたい」のに、実際には fallback 支配になっていた。

### 2. 初回COLD大崩れ
- attach 後 20.8 秒で初再生に到達する個体が出た。
- `v89d` では問題になっていなかったため、canvas retain 処理が初回ロード経路へ余計な負荷を載せた可能性が高い。
- 初回1本目の勝ち筋を壊してまで retain を入れる形になっていた。

### 3. 二重stop問題
- `PRECONNECT kill` と `INACTIVE kill` の両方で capture を試行していた。
- 同一停止系イベントに対して重複処理が走り、失敗率と負荷をさらに上げた。
- stop 時の capture は1回で十分なのに、実装上は二重発火しうる構造だった。

## 教訓
- suppress → retain の方向性自体は正しい。
- ただし capture timing を「kill直前」に置くのは遅すぎる。
- `readyState` / `videoWidth` の確認が弱いと、retain ではなく fallback が主役になる。
- 初回COLD経路に重い処理を混ぜると、見え方改善どころか再生開始そのものが崩れる。

## 次のアクション
- まず `v89d` の状態へ戻したうえで、次の黒画面対策案を検討する。
- capture を使うなら、kill直前ではなく「再生中の良好なフレーム」を常時保持する方式を検討する。
- retain をやるにしても、初回COLD勝ち筋と stop 系処理を絶対に汚さない設計が前提。

## メモ
- 今回の失敗は「retain の発想が間違い」ではなく、「capture の置き場所と guard 条件が悪かった」失敗。
- 次回は fallback 依存を減らし、good frame を先に持っておく方向で考える。
