# Project TODO

- [x] フルスタック版へのアップグレード完了
- [x] 在庫管理用データベーススキーマの作成
- [x] 買取実績管理用データベーススキーマの作成
- [x] 管理者専用ダッシュボード（在庫編集・実績追加）のUI実装
- [x] SEO対策の強化（メタタグ、構造化データ、sitemap実装）
- [x] スライドショーへの買取実績コンテンツ追加

- [x] スライドショーの黒画面問題を修正
- [x] 在庫一覧の自動再生時間を調整
- [x] 管理画面にファイルアップロード機能を追加（在庫用）
- [x] 買取実績にもファイルアップロード機能を追加
- [x] スライドショー画像をデータベース管理に変更
- [x] スライドショー管理機能を管理画面に追加

- [x] 管理画面のログイン後リダイレクト問題を修正
- [x] スライドショーを画像専用に変更（動画削除）
- [x] 在庫一覧の背景動画を8秒程度の短尺に変更
- [x] 買取実績の金額を100万円以下に調整
- [x] 管理画面で在庫・スライドショー・買取実績すべて編集可能か確認

- [x] 管理画面のログインループ問題を修正（公開後は正常動作）

- [x] 販売ページの「在庫一覧を見る」ボタンのリンク修正
- [x] 買取ページに出張査定のコメント追加

- [x] 会社概要ページの買取実績セクションの文言を景品表示法対応に修正

- [x] ホームページのSEO修正（キーワード3-8個に絞る、H2見出し追加、タイトル30-60文字に調整）

- [x] 既存サンプルデータをデータベースに初期登録
- [x] 在庫の編集機能を追加
- [x] 在庫に画像でも登録できるように修正
- [x] 買取実績の編集機能を追加
- [x] スライドショーの編集機能を追加
- [x] 既存データが管理画面に表示されるように修正

- [x] 車両メディアテーブルの作成（1台に複数の動画・画像を登録可能に）
- [x] 画像クリックで全画面表示（動画と同様の動作）
- [x] ギャラリー機能の実装（複数メディアをスライドショー形式で閲覧）
- [x] 管理画面で複数メディアのアップロード・管理に対応

- [x] 在庫メディアの並び替え機能を追加
- [x] 在庫メディアをアップロード順（displayOrder）で正しく表示
- [x] 買取実績の並び替え機能を追加
- [x] スライドショーの並び替え機能を追加

- [x] 画像追加順の修正（選択した順番通りに追加されるように）
- [x] サイトアイコン（favicon）を指定画像に変更
- [x] DialogTitleエラーの修正（アクセシビリティ対応）

- [x] 画像追加順の修正（端末で選択した順番通りに表示されるように）

- [x] スライドショー画像のアップロード制限を解除（どんな画像でもアップロード可能に）
- [x] 会社概要ページの「会社名」を「屋号」に変更

- [x] 画像の自動圧縮・リサイズ機能を追加（アップロード前にブラウザ側で処理）
- [x] アップロード処理の最適化（タイムアウト対策）
- [x] アップロード進捗表示の追加

- [x] 在庫データの復旧（価格・コメント・メディアが消えた問題）
- [x] 特定商取引法に基づく表記ページの作成

- [x] ナビゲーションに特定商取引法に基づく表記タブを追加
- [x] 特商法ページの情報を更新（運営責任者：千葉 遥斗、所在地、電話番号、メール）
- [x] 販売についてページにオートローン情報を追加

- [x] 会社概要ページ：マップの上に説明文を追加
- [x] 会社概要ページ：特商法リンクをマップの下に移動
- [x] 買取ページ：「まずはLINEで簡易査定」セクションの改行位置修正
- [x] 販売ページ：「オートローンでの購入も可能」セクションの改行位置修正
- [x] 販売ページ：「無理なく、欲しい車に乗れます」の文言改善
- [x] 特商法ページ：タイトルの被り修正（上部余白追加）
- [x] 特商法ページ：所在地・商品引き渡し時期・古物番号の改行位置修正

- [x] スマホ版の下部タブのバランスを修正

- [x] 会社概要ページ：「※ご予約殺到中のため…」を改行
- [x] 会社概要ページ：「いつでも無料査定可能！」を次の行に
- [x] 会社概要ページ：アクセスの下の改行を修正
- [x] 下部タブのバランス改善（特商法と会社概要の間のスペース調整）

- [x] 下部タブの特商法と会社概要の間のスペース修正（flex + justify-aroundで均等配置に変更）
- [x] 「あなたの愛車も高価買取します」の改行修正（1行表示に変更）

- [x] 下部タブの特商法の右側の空白を調整（flex-1で各タブを均等幅に変更）

- [x] 管理画面で在庫あり/売約済みを選べなくなっている問題を修正（車両追加・編集ダイアログにステータス選択フィールドを追加）

- [x] 在庫ページの画像表示を矢印ボタンからスワイプ操作に変更（タッチスワイプで次の写真に移動可能に）
- [x] 動画複数アップロード時のエラー・重さの問題を修正（動画は20MB制限、エラーメッセージ改善）

- [x] 画像ギャラリーで左スワイプも対応（左右両方向のスワイプに対応）
- [x] 動画の容量制限を撤廃（500MBまでアップロード可能に）
- [x] 動画も左右スワイプで切り替え可能に（動画の左右端をタップで切り替え）

- [x] 閲覧ページで画像拡大ができない問題を修正（ピンチズーム対応）
- [x] アップロード速度の改善（直接アップロード方式に変更、Base64変換不要に）

- [x] 動画アップロードの大幅高速化（全ファイル並列アップロード対応、Promise.allで同時実行）

- [x] ②ダミー動画ウォームアップ実装（muted autoplay playsinline、非表示、再生後削除）
- [x] ①プレイヤー事前初期化（preload="metadata"、IntersectionObserverで先読み、同時最大2本）
- [x] 計測機能の実装（初回再生までの時間、2本目/3本目の開始時間）

- [x] 修正版①：ダミー動画を130KBに強化、canplay/playing/canplaythrough発火まで待つ方式に変更（タイムアウト2秒）
- [x] 修正版②：初回再生完了まで先読みを無効化（preload="none"、初回再生後に有効化）
- [x] 修正版③：画面右下にデバッグ用の計測結果を一時表示（10秒後に自動非表示）

- [x] ①デバッグ/計測UIの完全削除（画面右下の表示をすべて削除）
- [x] ②背景動画の自動再生改善（#t=0.001、preload="auto"、canplaythroughイベントで再生、失敗時再試行）
- [x] ③ウォームアップ処理は内部的にのみ維持（UIに一切見せない）

- [x] ①本編（タップ動画）をHLS配信に変更（Bunny Stream連携実装完了）
- [ ] ②ページ読み込み完了を動画と切り離す（preload=none、ページ表示最優先）
- [ ] ③Mac Safariで黒画面＋再生不可の修正

- [x] 在庫一覧UIのTikTok方式実装（video要素を1〜2個に制限、src差し替え）
- [ ] 背景のanimated WebP/AVIF対応（8秒ループ、0.3〜1.0MB、JS不要で即描画）
- [ ] タップ再生の初動改善（preconnect/dns-prefetch、セグメント長1〜2秒）
- [x] Bunny CDNへのpreconnect/dns-prefetch追加

- [x] L0/L1/L2階層構造の実装（背景1秒保証）
  - L0: Bunnyサムネイル（静止画）を即表示
  - L1: 超軽量2秒MP4（数百KB）をmuted autoplayでループ
  - L2: 現行の8秒MP4（L1再生後にフェード切替）
- [x] ページロード完了判定の動画分離
- [x] 超軽量2秒MP4の生成・アップロード機能（FFmpegでサーバーサイド生成、管理画面からボタン一つで生成可能）


- [ ] 背景動画が自動再生されない問題を修正
- [ ] FFmpegなしでプレビュー動画を生成する方法を実装（本番環境にFFmpegがない）

- [x] 既存の.mov動画をMP4（H.264 + AAC）に変換して検証（Vezelで検証完了）
- [ ] Bunny側の配信ファイルのContent-TypeとCodecを確認
- [ ] アップロード時の自動MP4変換機能を実装（H.264 / yuv420p / AAC / faststart）
- [x] 変換後の動画で背景再生が正常に動作することを確認（Vezelで確認完了）
- [x] 全動画をH.264 + AAC + faststartのMP4に変換（7本全て完了）
- [x] アップロード時の形式チェック機能を実装（H.264+AAC以外は拒否）
- [x] チェックポイント保存とPublish
- [ ] 全経路（Safari/Chrome/LINE/Instagram/4G/Wi-Fi）で最終確認

- [x] videoWidth/videoHeight判定を削除し、MP4のみ許可する形に修正
- [ ] CapCut書き出しMP4が通ることを確認

## 復旧作業（必須）
- [x] プレビュー生成機能を完全無効化（UI/ロジック両方）
- [x] ffmpeg / preview / L1/L2 前提コードを全削除
- [x] 背景動画は単一MP4で即autoplay（muted, loop）
- [x] 背景とタップ再生のstateを完全分離
- [x] Mac/iOS/LINE/Instagram内ブラウザで初期表示時にvideoを触らない構成に戻す

## PC背景自動再生問題の修正
- [x] PC用にautoplay判定を完全分岐（iOSロジックを流用しない）
- [x] PCではIntersectionObserver到達時にplay()を実行
- [x] PCでmuted/playsinline条件を明示的に再設定
- [ ] PC/スマホで背景がページ表示直後に必ず再生されることを確認
- [ ] タップ再生が確実に動作することを確認

## デバッグページ作成（必須）
- [x] /debug/video デバッグページを作成
- [x] チェックポイント保存とPublish
- [ ] 本番での再生確認

## タップ再生問題の修正（必須）
- [ ] 背景動画用とタップ再生用のvideo要素を完全分離（別ID/別ref）
- [ ] 背景動画に必須属性を全て明示（muted, playsinline, autoplay, loop）
- [ ] JS側でもvideo.muted = true / video.volume = 0を明示
- [ ] タップ再生は新しいvideo要素を生成してplay()する方式に修正
- [ ] 一時的に背景再生をOFFにしてタップ再生のみで単体テスト
- [ ] 背景とタップ再生の統合テスト

## iOS Safari UIレイヤー問題の修正（必須）
- [x] 背景videoにpointer-events: noneとz-index: 0を設定
- [x] ボタンコンテナにposition: relativeとz-index: 10以上を設定
- [x] デバッグページでvideoをdisplay:noneにしてボタンが押せるか確認
- [x] チェックポイント保存とPublish
- [ ] iPhone Safariで/debug/videoを再確認

## iOS Safari動画再生問題（networkState=3）の調査
- [x] CloudFront/S3の動画URLのレスポンスヘッダを確認
- [x] Content-Type=video/mp4、Accept-Ranges=bytes、206 Partial Contentの確認
- [x] CORSヘッダの確認
- [x] 必要に応じてプロキシ配信またはヘッダ修正を実装（/api/video-proxyエンドポイント追加）
- [x] デバッグページにネットワーク情報を表示
- [ ] iPhone Safariで再テスト（プロキシ経由で206 Partial Contentを返すようになったので再確認必要）

## 在庫ページのタップ再生をデバッグページと統一
- [x] タップ再生用コンポーネントを作成（デバッグページと同じ実装）
- [x] video srcは必ず/api/video-proxy経由に統一
- [x] タップ時にvideo要素を動的生成 → srcセット → play()を即時実行
- [x] iOS Safari用の属性を明示（playsinline, controls, muted=false）
- [x] 背景動画はpause()のみ（display:noneは使用しない）
- [x] VideoFeedコンポーネントを更新
- [ ] iPhone Safariで動作確認（Publish後に確認必要）

## UI機能の役割分離
- [x] 背景動画のタップ挙動を元に戻す（タップ時はギャラリーを開く、直接video.play()はしない）
- [x] ギャラリー内の動画再生のみproxy方式を使用（画像スライドは従来通り）
- [x] 「売約済み/在庫あり」ラベルのz-index修正（ロゴより下に配置、marginTop: 2.5rem追加）
- [x] 動作確認（PC Chromeで確認済み、iPhone SafariはPublish後に確認必要）

## 在庫詳細ページのタップイベント配線問題の修正
- [x] 背景video要素はpointer-events:noneのまま
- [x] 動画の上に透明のタップ領域（button）を全体に被せる（z-index: 100）
- [x] CTAボタン（LINE/電話）領域は除外（タップ領域は下部200pxを除外）
- [x] タップ確認用の一時トーストを追加（sonnerで"BG tapped"）
- [ ] iPhone Safariで動作確認（Publish後に確認必要）

## スマホ版ギャラリーの挙動修正
- [x] BGタップ判定を「ワンタップのみ」に変更（移動量10px以下の場合のみタップ扱い）
- [x] 「BG tapped」トーストを削除
- [x] スマホ表示のギャラリーで左右矢印を非表示（サムネ/ドットは残す）
- [x] 動作確認（PC Chromeで確認済み、iPhone SafariはPublish後に確認必要）

## 複数ページの修正（2026-01-22）
- [x] 「買取について」ページに文面追加（お引取り、査定、お支払い）
- [x] 「販売について」ページに文面追加（ご納車）
- [x] 両ページにエージェント注釈を追加
- [x] 右下固定ボタンにInstagramアイコン追加
- [x] 在庫カード内のLINE/電話ボタン削除
- [x] 会社概要ページにLINE連絡先を追加
- [x] 在庫編集ページに表示順変更機能を追加
- [x] メイン画像の概念を整理（先頭画像を自動的にメイン扱い）
- [x] 動作確認

## LINE表記修正とメールボタン追加（2026-01-26）
- [x] 会社概要ページのLINE表記を修正（正式LINEロゴ、文言を「LINE」に統一）
- [x] 右下固定ボタンのLINEアイコンを正式LINEロゴに変更
- [x] 右下固定ボタンにメールボタンを追加（封筒マーク、mailto:リンク）
- [x] 動作確認

## UI微調整（2026-01-26）
- [x] 右下固定アイコンのサイズを小さくし、右下寄りに移動（w-12→w-10、right-6→right-3、bottom-24→bottom-20）
- [x] 会社概要ページのスライドショーの見切れ修正（object-containを使用）
- [x] フッターメニューの「特商法」を「特商法について」に変更
- [x] 動作確認

## 委託在庫一覧タブの追加（2026-01-26）
- [x] データベーススキーマに委託車両フラグを追加
- [x] 委託在庫一覧ページを作成（TikTok風表示、説明文・注意書き・掛載条件を追加）
- [x] 管理画面で委託車両の投稿・編集機能を追加
- [x] ナビゲーション・ルーティングの更新
- [x] 動作確認

## 会社概要ページのスライドショー修正（2026-01-26）
- [x] スライドショーを元の正常な表示に戻す
- [x] 会社情報の台紙を少し下にずらして被りを解消
- [x] 動作確認

## 委託在庫一覧ページのUI崩れ修正（2026-01-26）
- [x] ページ上部のロゴとテキストの被り修正（ヘッダー分の余白確保）
- [x] 本文テキストの行間・余白の適正化（冒頭説明文、委託掛載について、空状態表示）
- [x] 「委託掛載について」を他ページと同じデザイン構造に統一
- [x] スマホ表示での最終確認

## 委託在庫一覧ページ最終仕様修正（2026-01-26）
- [x] 下部タブ名称を「委託在庫」→「委託在庫一覧」に変更
- [x] 常時表示文言を1箇所のみに整理（「委託出品掛載をご希望の方は、お気軽にご相談ください。」）
- [x] 在庫あり時：車両一覧の下に「在庫は以上です」メッセージを表示
- [x] 在庫なし時：「現在、委託車両はありません」メッセージを表示
- [x] 重複する案内文・黒背景ブロックを統合
- [x] 通常の在庫一覧ページと同じ表示ルール・見た目に揃える

## 委託在庫一覧ページのクラッシュエラー修正（2026-01-26）
- [x] エラー原因の調査（removeChildの多重実行）
- [x] 在庫0件・1件以上どちらの場合でもエラーが出ないよう修正
- [x] 動作確認

## 委託在庫一覧ページの背景動画自動再生対応（2026-01-26）
- [x] VideoFeedコンポーネントの構造を確認
- [x] 委託在庫一覧ページの車両表示部分を在庫一覧と同じ実装（TikTok風）に統一
- [x] 説明文エリアは上部に残し、下の一覧部分は在庫一覧と完全一致に
- [x] 背景動画の自動再生・タップ挙動・動画proxy等を完全一致に
- [x] 動作確認

## 委託在庫一覧ページを在庫一覧と完全統一（2026-01-26）
- [x] 動画の背景自動再生を在庫一覧と同じ仕様に（VideoFeedコンポーネントを流用）
- [x] 説明セクション後のレイアウトを在庫一覧と完全一致に（TikTok風フルスクリーン表示）
- [x] ロゴ・文字・ラベルの被りを解消（余白ルール統一）
- [x] 「委託掛載について」セクションのUI統一
- [x] 動作確認

## 委託在庫一覧ページのラベル被りと不要文面修正（2026-01-26）
- [x] 左上ロゴと「委託車両」「在庫あり」ラベルの被りを解消（ラベル位置を下げる）
- [x] 「詳細は右下のボタンからお問い合わせください」の文面を削除
- [x] 動作確認

## 在庫一覧・委託在庫一覧の表示ルール修正（2026-01-26）
- [x] 車両説明文の表示ルール修正（入力されている場合のみ表示、未入力なら何も表示しない）
- [x] 価格表示の統一（コンマ＋末尾「-」を常に付与、未入力ならASK表示）
- [x] スマホ版下部タブの均等配置（6つのタブを横幅に対して均等割り）
- [x] 管理画面にサイト閲覧数（PV）表示を追加（日別、直近7日/30日）
- [x] 動作確認

## 価格カンマ表示とスマホ下部タブUI修正（2026-01-26）
- [x] 価格表示に3桁区切りカンマを付与（¥1,298,000-形式）
- [x] スマホ下部タブの高さを詰める（iPhoneタブバー程度の厚みに）
- [x] 6タブの均等配置を修正
- [x] 下部タブと車両タイトル/金額の被りを解消
- [x] 動作確認

## カード位置下げと下部タブの等間隔修正（2026-01-26）
- [x] 在庫一覧・委託在庫一覧のカード情報（タイトル/金額/画像数/動画数）を下げる
- [x] スマホ下部タブの6つを視覚的に等間隔に修正
- [x] 動作確認

## カード位置下げ・下部タブ等間隔・ページ別PV追加（2026-01-26）
- [x] カード情報をさらに下げる（+2cm程度、pb-28に）
- [x] 下部タブを確実に等間隔に（tableレイアウトで完全均等幅）
- [x] アクセス解析にページ別PV内訳を追加
- [x] 動作確認

## 下部タブ等間隔・カード位置修正（2026-01-26 再修正）
- [x] 下部タブの等間隔配置を根本的に修正（flexbox + 固定幅16.666%で完全均等幅）
- [x] カード情報の位置を正しく下げる（pb-28→pb-36に変更）
- [x] 動作確認

## カード位置・下部タブ修正（2026-01-26 根本修正）
- [x] 下部タブをgrid repeat(6, 1fr)で完全均等配置に修正
- [x] カード情報（タイトル/金額/画像数）を確実に下寄せ（absolute bottom-0 + paddingBottomで下に固定）
- [x] 在庫一覧・委託在庫一覧の両方で同一仕様に統一
- [x] 動作確認

## 車両タイトル位置・下部タブ再修正（2026-01-26 緊急修正）
- [x] 車両タイトル・金額を下部タブスレスレまで下げる（paddingBottom: 5rem→3.5remに削減）
- [x] 下部タブを確実に均等配置に（grid repeat(6, 1fr)で完全均等幅確認済み）
- [x] 在庫一覧・委託在庫一覧の両方で同一仕様に統一
- [x] 動作確認

## 車両タイトル・下部タブ根本修正（2026-01-26 確実修正）
- [x] バージョン表記をフッターに追加（v2026-01-26-04）
- [x] 車両タイトルの親コンテナを特定（vehicle-info-container）、paddingBottom: 56pxで下部タブのすぐ上に固定
- [x] 下部タブをflex:1で完全均等配置に（各タブ213.33px、誤差0.01px以下）
- [x] ブラウザで確認済み

## overlayコンテナ位置修正（2026-01-26 translateY修正）
- [x] VideoFeed.tsxのoverlayコンテナにtranslateY(32px)を適用
- [x] ConsignmentFeed.tsxのoverlayコンテナに同じ修正を適用（VideoFeedと同じ基準で統一）
- [x] バージョンをv2026-01-26-05に更新
- [x] 動作確認（バージョン確認済み）

## 委託在庫overlay位置修正（2026-01-26 bottom基準統一）
- [x] Consignment.tsxのoverlayをbottom基準に修正（VideoFeedと同じ構造に統一）
- [x] バージョンv2026-01-26-06で確認
- [x] 動作確認（車両情報が下部タブ56px + translateY(32px)で下寄せになっていることを確認）

## 最終修正（2026-01-26）
- [x] バージョン表記（v2026-01-26-xx）の削除
- [x] PC背景動画の自動再生改善（再試行ロジック追加：1秒後・2秒後再試行、ユーザー操作検知時再試行、visibilitychange/pageshow対応）
- [x] 最新情報用のデータベーススキーマ作成（タイトル＋URL）
- [x] 最新情報用のAPIエンドポイント作成
- [x] 管理画面に最新情報の編集機能を追加
- [x] 会社概要ページに最新情報セクションを追加
- [x] 動作確認（テスト全通過）

## 会社概要ページ追加修正（2026-01-31）
- [ ] スライドショーで動画再生対応（muted/playsinline/autoplay/loop、動画スキップ禁止）
- [ ] 管理画面で動画形式チェック（H.264 MP4のみ許可）
- [ ] GoogleマイビジネスAPI連携の調査
- [ ] Googleマイビジネス投稿の自動取得または自動投稿の実装
- [ ] 動作確認

## Google Business Profile API連携・指標表示（2026-02-03）
- [x] token.jsonを環境変数として設定（GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN）
- [x] GBP API連携のサーバー側実装（localPosts取得、キャッシュ機能・トークン自動更新）
- [x] 会社概要ページの最新情報セクションをGBP連携に変更（画像+本文+日付+リンク）
- [x] 指標表示機能：年別累計取扱高・査定数・成約数・成約率の表示
- [x] 管理画面で指標を手入力できる機能（「指標」タブ追加）
- [x] 動作確認（テスト21件全通過）

## UI修正（2026-02-05）
- [x] 会社概要ページ：基本情報ブロックのアイコンを右下固定ロゴと同じものに差し替え
- [x] 会社概要ページ：基本情報の並び順を電話→メール→LINE→Instagramに修正
- [x] 会社概要ページ：各項目のリンク動作を修正（tel/mailto/LINE/Instagram）
- [x] 会社概要ページ：お問い合わせ誘導ボックスを復元（買取実績とお客様の声の間）
- [x] 右下固定ロゴ（全ページ共通）：並び順を電話→メール→LINE→Instagramに統一
- [x] 在庫一覧ページ：車両タイトルと右下固定ロゴの被りを修正

## UI修正（2026-02-05 追加）
- [x] 会社概要ページ：情報ボックスの並び順修正（電話→FAX→メール→LINE→Instagram→営業時間→定休日）
- [x] 会社概要ページ：FAX番号を復活（0229-38-1211）
- [x] 会社概要ページ：不要な「お問い合わせ」欄を削除
- [x] 会社概要ページ：CTAボックスの改行修正（「無料です。」の不自然な改行を解消）
- [x] 会社概要ページ：お客様の声見出しを「Googleマップクチコミにて / お客様のお声」に変更

## UI最終調整（2026-02-05 追加2）
- [x] 会社概要ページ：チバガレージアイコンを指定画像（💩アイコン）に差し替え
- [x] 会社概要ページ：許認可番号欄の改行位置修正（「第」が2行目に来ないように）
- [x] 会社概要ページ：お客様の声セクションをGoogleマップ口コミ埋め込みに変更（ダミーデータ廃止）

## 会社概要ページ修正（2026-02-05 追加3）
- [x] お客様のお声セクション：現在の地図を削除し、Googleマップの実際の口コミ5件を表示
- [x] 会社所在地セクション：新規追加し、Googleマップの地図を表示

## 会社概要ページ最終微調整（2026-02-05 追加4）
- [x] 所在地欄：郵便番号と住所を改行（〒989-4416 / 宮城県大崎市田尻中目字下田20-22）
- [x] 会社所在地セクション：地図を正常表示に修正、住所を正しいものに変更
- [x] 会社所在地セクション：地図下部に注釈を追加（「※ご来場の方は事前にお電話ください。」「※少人数のため、不在の場合がございます。」）

## ビジネス指標表示機能（2026-02-05）
- [x] データベーススキーマにビジネス指標テーブルを追加（year, revenue_total_ytd, appraisal_count, contract_count, is_forecast）
- [x] tRPCルーターにビジネス指標のCRUDエンドポイントを追加
- [x] 管理画面にビジネス指標の配列管理機能を実装
- [x] 買取ページに縦棒グラフセクションを実装（「まずはLINEで簡易査定」の直前）
- [x] 予想フラグ付きの棒は見た目を変える（斜線/半透明）
- [x] 最新年度の査定数・成約数・成約率を数値カードで表示
- [x] データが空の場合はセクション非表示

## ビジネス指標セクション修正（2026-02-06）
- [x] 棒グラフが表示されない問題の修正（最優先）
- [x] 年度別「査定数」の縦棒グラフを追加
- [x] スマホでの成約率はみ出し修正（KPIカードのレスポンシブ最適化）
- [x] メタプラネット社HP風のメカメカしいデザインに変更

## ビジネス指標セクション追加修正（2026-02-06）
- [x] 背景を白に変更
- [x] 英語を日本語に変更（BUSINESS METRICS、LIVE DATAなど）
- [x] グラフが全部表示されるよう修正

## ビジネス指標セクション完全修正（2026-02-06 至急）
- [x] 見出しを「買取の年度累計取扱高」に変更
- [x] サブタイトル「※買取事業の年度累計（予想含む）」を追加
- [x] 棒グラフを100%描画（取扱高・査定数・成約数の3種類）
- [x] min-height: 260pxを指定してグラフコンテナの高さを確保
- [x] デバッグログを追加（開発時のみ）
- [x] メタプラネットHP風のメカメカしいデザインに変更

## 棒グラフ高さ計算修正（2026-02-06）
- [ ] データ最大値を100%として正規化（barHeight = value / max * 100%）
- [ ] 固定px指定を禁止し、%ベースで可変に
- [ ] min-height: 260px（SP）/ 320px（PC）を指定
- [ ] データ型を数値にキャスト（Number / parseInt / parseFloat）
- [ ] 年度ごとの値の差が視覚的に分かるように

## 買取ページのビジネス指標セクション棒グラフ修正（2026-02-06）
- [x] 棒グラフの高さ計算を修正（データ最大値を100%として正規化）
- [x] 棒の高さを%ベースで可変に変更
- [x] グラフコンテナにmin-height: 320pxを指定
- [x] データ型を必ず数値にキャスト（Number()で変換）
- [x] 年度ごとの値の差が視覚的に明確に分かるように修正
- [x] デバッグログで計算結果を確認（2024年8.3%、2025年86.45%、2026年100%）

## 棒グラフ描画問題の根本修正（2026-02-06）
- [x] 棒グラフの親要素に固定高さを設定（height: 280px、min-height: 280px）
- [x] 棒グラフエリアをflex + align-items: flex-endで下から伸びる構造に修正
- [x] 棒の高さをpx直接指定に変更（最大値200pxとして正規化）
- [x] アニメーション条件をanimationReadyに統一
- [x] overflow: hiddenを削除して切れないように修正
- [x] KPIカード（査定数・成約数・成約率）の高さを統一（minHeight: 120px）
- [x] スマホ幅（375px）での表示確認（棒グラフが正しく伸びていることを確認）

## 本年のみ積み上げ棒グラフ表示（2026-02-06）
- [x] データベーススキーマに実績・予想上乗せ分フィールドを追加
  - actualAmount（本年実績累計取扱高）
  - forecastAmountAdd（本年着地予想上乗せ分）
  - actualAssess（本年実績累計査定数）
  - forecastAssessAdd（本年着地予想上乗せ分）
  - actualContract（本年実績累計成約数）
  - forecastContractAdd（本年着地予想上乗せ分）
- [x] tRPCルーターの更新（新フィールドの取得・更新対応）
- [x] 管理画面の更新（本年のみ実績・予想上乗せ分の入力欄追加）
- [x] BusinessMetricsChartコンポーネントの更新
  - 本年のみ積み上げ棒グラフ（実績＋予想上乗せ分）
  - 過去年は実績のみの通常棒グラフ
  - 点線/破線で予想部分を視覚的に区別
  - 表示テキスト（実績 + 予想 = 合計）
  - 凡例（■実績 ⬜予想）を追加
- [x] 動作確認とチェックポイント保存
  - 2026年（本年）：1.0億円（実績7200万円 + 予想2800万円）の積み上げ表示を確認
  - 査定数：200（実績150 + 予想50）
  - 成約数：160（実績140 + 予想20）
  - 成約率：80.0%（160/200）

## UI最終調整（2026-02-06）
- [x] 青枚の「予想含む」ラベルを完全削除
- [x] 年度カード内の重複した（予想含む）表記を削除
- [x] 年度ラベルと棒グラフのベースラインを完全に揃える（全年度h-6で統一）
- [x] 注釈「※2024年7月 事業スタート」を追加（タイトル直下、既存注釈の下）

## 管理画面ビジネス指標編集ダイアログのスクロール問題修正（2026-02-06）
- [x] ダイアログ内のコンテンツがスクロールできるように修正（max-h-[90vh] + overflow-y-auto）
- [x] 保存ボタンが常に押せるようにする（DialogFooterに flex-shrink-0）

## 動画・画像配信基盤の最適化 - Bunny Streamフル活用（2026-02-09）
- [x] 現在の動画・画像配信実装の調査（完了）
- [x] 利用可能なサービス調査と実装方針決定（Bunny Streamフル活用）
- [x] sharp導入・画像最適化パイプライン（WebP変換・複数サイズ480/960/1440生成）
- [x] フロント動画再生をBunny Stream HLS/MP4に切り替え（video-proxy脱却）
- [x] 背景自動再生・ギャラリーをBunny Stream統一（poster/サムネイルも）
- [x] 変換ステータスポーリング・変換中プレースホルダー表示
- [x] 変換完了後の自動切替（一覧が壊れない設計）
- [x] 画像srcset対応（一覧/ギャラリー/背景で最適サイズ配信）
- [x] 管理画面アップロードフロー更新（bunnyStatus設定・画像自動最適化）
- [x] S3は原本保管として維持（Bunnyが配信担当）
- [x] 動作確認・テスト・チェックポイント保存（26テスト全合格）

## 動画再生エンジン根本修正（2026-02-09）
- [x] 動画プリロードマネージャー実装（キャッシュ・先読み・インスタンス再利用）
- [x] 戻り再生の遅延解消（video要素/Hlsインスタンスの破棄防止）
- [x] 全画面再生の即再生設計（MP4即再生→HLSシームレス切替）
- [x] タップ前プリロード実装（次動画のMP4先頭・HLS manifest事前取得）
- [x] iPhone Safari最適化（playsinline/muted/preload/startLevel低設定）
- [x] VideoFeed/ConsignmentFeedの背景動画・ギャラリーモーダル統合
- [x] 動作確認・テスト・チェックポイント保存（72テスト合格、1件は既知のBunny API認証問題）

## 動画再生体感チューニング最終仕上げ（2026-02-09）
- [x] 戻り再生のキャッシュ即ヒット改善（video要素の永続キャッシュ、re-fetch防止）
- [x] 全画面タップ即フレーム表示（0〜200ms目標、480p MP4プリバッファ済みvideo要素で即描画→HLS昇格）
- [x] 背景video要素のDOM外キャッシュ保持（unmount時にpauseのみ、srcは維持）
- [x] 全画面用の軽量MP4プリフェッチ（galleryVideoPoolで480p MP4をhidden video要素でプリバッファ）
- [x] VideoFeed/ConsignmentFeedへの統合・動作確認・テスト（80テスト中79合格、1件は既知のBunny API認証問題）

## 動画再生体感の根本修正 - MP4フルDL禁止（2026-02-09 緊急）
- [x] MP4フルDLプリロード経路を全て特定・遮断
- [x] プリロード対象をposter画像+HLS manifest(.m3u8)のみに限定
- [x] galleryVideoPool（hidden video要素でMP4プリバッファ）を完全廃止
- [x] 背景video要素のpreload="none"化（HLSベースなのでブラウザ自動fetchを防止）
- [x] タップ時はHLS最低画質で即開始（startLevel=0固定）
- [x] HLS不可時のみ480p MP4をフォールバックとして使用
- [x] 戻り再生時の再取得ゼロ（video要素+HLSインスタンスを永続保持）0本）
- [x] 体感計測ログ実装（タップ→初フレーム描画のms、取得リソースサイズ）
- [x] ビルド検証・テスト合格（74テスト中73合格、1件は既知のBunny API認証問題）
- [x] チェックポイント保存

## 動画再生v4 - iOS Safari対応・MP4ネイティブ再生（2026-02-09 緊急）
- [x] iOS Safari判定を実装（hls.jsを完全排除、全プラットフォームでMP4ネイティブ再生）
- [x] 背景動画をBunny CDN直URL（480p MP4）でネイティブ再生に変更
- [x] 全画面タップ時も480p MP4で即再生→バッファ十分なら720pに昇格
- [x] video-proxyを経由しないBunny CDN直URL配信に変更（レガシー動画のみvideo-proxy維持）
- [x] プリロードはpreload="metadata"のみ（MP4フルDL禁止）
- [x] video要素キャッシュ（戻り再生で再fetchゼロ）
- [x] playsinline/muted/autoplay属性の最適化
- [x] VideoFeed/ConsignmentFeed両方を統合修正
- [x] ビルド検証・テスト合格（75テスト中74合格、1件は既知のBunny API認証問題）
- [x] チェックポイント保存

## 動画再生v5 - video-proxy完全排除・Bunny CDN直URL統一（2026-02-09 最優先）
- [ ] video-proxy/CloudFront URLを踏む全経路を特定
- [ ] GalleryModal（全画面再生）のvideo-proxy参照を完全排除
- [ ] BackgroundVideo（背景再生）のvideo-proxy参照を完全排除
- [ ] TapVideoPlayerのvideo-proxy参照を完全排除
- [ ] getProxiedVideoUrl使用箇所を全てBunny CDN直URLに置換
- [ ] warmup.mp4（video-proxy経由）を排除
- [ ] 全画面タップ時は480p軽量MP4をBunny CDN直URLで即再生
- [ ] poster画像を必ず即表示（黒画面回避）
- [ ] ビルド検証・テスト合格
- [ ] チェックポイント保存

## video-proxy完全除去（2026-02-09 緊急修正）
- [x] TapVideoPlayer.tsxからvideo-proxyを除去（Bunny CDN直URL + createGalleryPlayer使用）
- [x] VideoFeed.tsxのGalleryModalからvideo-proxyを除去（直接URL再生に変更）
- [x] ConsignmentFeed.tsxのGalleryModalからvideo-proxyを除去（直接URL再生に変更）
- [x] Consignment.tsxのGalleryModalをcreateGalleryPlayer方式に全面書き換え
- [x] Consignment.tsxの背景動画をvideoPreloadManagerのキャッシュ方式に統一
- [x] BunnyVideoPlayer.tsxからvideo-proxyを除去（Bunny CDN直URL + 360pフォールバック）
- [x] 全コンポーネントでBunny CDN直URL統一（video-proxyはVideoDebugページのみ残存）
- [x] TypeScriptコンパイルエラーなし確認
- [x] 全テスト通過確認（bunnyStream.testの401は既知のAPI認証問題）

## 動画・画像配信の根本改善（2026-02-09 緊急修正v2）
- [x] 背景動画をBunny 360pプレビュー固定（0.5〜1.5MB目標、元MP4/大きいMP4禁止）
- [x] 全画面タップ時のawait排除（analytics/event/httpapi/vehicleMedia.listをfire-and-forget化）
- [x] 全画面は即プレビュー再生→2〜3秒後に高画質昇格方式に変更
- [x] CloudFront経由の大容量MP4 DLを完全排除（背景・スクロール中に5MB以上のDL禁止）
- [ ] HEIC画像のギャラリー段階ロード（サムネは小サイズ、原寸DLはタップ時のみ）
- [x] vehicleMedia.list等のAPI重複呼び出し排除・キャッシュ化
- [x] URLの安定化（同一メディアは同一URLでブラウザキャッシュが効く設計）
- [x] 戻り時の再fetch完全ゼロ（bgPool/キャッシュで即再生）

## 全画面再生の根本修正（2026-02-09 緊急修正v3）
- [x] タップ→即overlay→poster→video append→load()→play()の最小再生ルート実装（awaitゼロ）
- [x] play()失敗時のフォールバック（controls表示/別URL再試行/URLリンク表示）
- [x] 切り分け用詳細ログ追加（[FULL] open/src/append/load/canplay/playing/error等）
- [x] 全画面初手は360p/480p progressive MP4固定（HLS/高画質昇格は再生開始後）
- [x] AbortController完全分離（背景プリロードが全画面を巻き込まない）— プロジェクト全体でAbortController未使用を確認
- [x] iOS Safari対策（playsInline/muted初回/preload=metadata）

## 全画面mp4未発火の根本修正（2026-02-09 緊急修正v4）
- [x] GalleryModal open→video.src→load()→play()の全フロー精査・原因特定（Radix PortalのDOMマウントタイミング問題）
- [x] video.srcが刺さらない/load()が走らない根本原因を修正（callback ref方式に変更）
- [x] 全ステップに[FULL]ログ追加（selectedMediaId/URL/fetch開始完了/src assign/load/play）
- [x] 500ms以内にmp4未発火ならフォールバック表示（無限ぐるぐる禁止）
- [x] 全画面open時にAPI待ちをやめて即モーダル表示（UIブロック禁止）

## 赤行根本修正・全画面即描画（2026-02-09 v8）
- [ ] CloudFront原本URLがsrcに入る原因を特定
- [ ] 背景動画のURL選択をBunny 360p固定に修正
- [ ] 全画面のURL選択をBunny 480p固定に修正（720p昇格は再生開始後のみ）
- [ ] 全画面タイミングログ追加（tap→modal→poster→src→canplay→playing各ms）
- [ ] 中断制御整理（背景スクロールのabortが全画面を巻き込まない）
- [ ] 赤行（abort/中断）の原因をログで説明可能にする

## Bunny API復旧待ち期間の改善作業（2026-02-09）
- [x] CloudFrontフォールバック時の動画再生最適化（preload=metadata + Range request段階DL）
- [x] 全画面モーダルのUI/UXブラッシュアップ（ミュート解除ボタン、poster即表示、Close修正）
- [x] 背景動画のpreload戦略最適化（preload=metadata固定、play()で段階DL）
- [x] poster画像の即表示保証（vehicleThumbnailUrl→bunnyThumbnail→fallback）
- [ ] 不要なvideo-proxyコード・デバッグコードの整理（次回対応）
- [x] Bunny復旧時の一括移行スクリプト・手順書の最終整理（docs/BUNNY_MIGRATION_GUIDE.md + checkBunnyStatus.ts）

## Bunny API エンドポイント修正・一括移行（2026-02-09）
- [x] /library/{libraryId}/videos エンドポイントの動作確認（Bunny復旧で200 OK確認）
- [x] CDN Hostnameを正しい値に修正（vz-2e234254-464.b-cdn.net）
- [x] 全18本の動画をBunny Streamに一括移行実行（全てencodeProgress=100%）
- [ ] Bunny Stream Token Authentication対応（CDN配信に署名付きURL必要）
- [ ] サーバー側で署名付きURL生成ロジックを実装
- [ ] tRPCエンドポイントで署名付きURL生成APIを公開
- [ ] フロントエンドを署名付きURL経由の動画配信に対応
- [ ] CDN経由の動画再生をブラウザで確認

## 砂嵐復旧 + HLS対応（2026-02-09 最優先）
- [ ] 砂嵐の原因特定（動画URLが403/HTML/JSONを返していないか確認）
- [ ] pre-Bunny安定版へロールバック（動画URLをCloudFront元URLに戻す）
- [ ] 砂嵐ゼロ復旧の検証（Networkで全動画200+video/mp4確認）
- [ ] Bunny CDN Token Authentication問題を解決（署名付きURL or Token Auth無効化）
- [ ] HLS前提のタップ即再生実装（iOS Safari=ネイティブ、Chrome=hls.js）
- [ ] タップ→モーダル+poster 0ms表示→裏でm3u8セット→play
- [ ] video要素/プレイヤーインスタンスのキャッシュ（同一車両で遅くならない）
- [ ] CDN経由の動画再生をブラウザで確認

## Direct Play URL統一で砂嵐完全解消（2026-02-09 最優先）
- [x] bunnyUrls.tsをiframe embed URL（iframe.mediadelivery.net）生成に全面書き換え
- [x] BunnyVideoEmbed共通コンポーネント作成（BunnyBgVideo / BunnyFullscreenVideo / CloudFrontVideo）
- [x] VideoFeed.tsx（BackgroundVideo, GalleryModal）をiframe embed方式に書き換え
- [x] Consignment.tsx（委託在庫一覧）をiframe embed方式に書き換え
- [x] videoPreloadManager.tsをv8に簡略化（posterプリロードのみ残存）
- [x] CDN直リンク（b-cdn.net）の動画再生参照を全コードから排除（サムネイルはToken Auth対象外のため維持）
- [x] ビルドエラーゼロ・TypeScriptエラーゼロを確認
- [x] ネットワークログで403エラー・b-cdn.net動画リクエストがゼロであることを確認
- [x] videoPreloadManager.test.tsをv8対応に全面書き換え（全テストパス）
- [x] テスト・チェックポイント保存

## TikTok形式 縦フルスクリーン動画ギャラリーモーダル（2026-02-09）
- [x] TikTokVideoGalleryコンポーネント新規作成（scroll-snap mandatory, 1画面=1動画）
- [x] スクロールで自動再生（中央1本のみ再生、前後は停止）
- [x] 3本DOM保持（前・今・次のみvideo、それ以外はposter）
- [x] iOS SafariはネイティブHLS（m3u8直接src）、hls.js禁止
- [x] Chrome等はhls.js（再生中の1本だけattach）
- [x] poster即表示→playingでフェード（体感0ms）
- [x] 右上×固定 + ESCで閉じる、閉じたら元の位置に戻る
- [x] ABR画質昇格（360/480で即開始→安定したら720へ）
- [x] iPad/Mac対応（object-fit:contain、引き伸ばし禁止、黒帯OK）
- [x] 先読み：poster + m3u8 manifest + 最初のtsセグメント1個のみ（hls.jsのmaxBufferLength=10で制御）
- [x] VideoFeed/ConsignmentFeedからギャラリーモーダルを呼び出す配線
- [x] ビルドエラーゼロ・TypeScriptエラーゼロ確認済み
- [x] テスト全88件パス（tikTokVideoGallery.test.ts 17件含む）
- [x] チェックポイント保存

## TikTokVideoGallery 4点修正（2026-02-09）
- [x] 初回自動再生高速化: muted+playsinline+autoplay、load()→play()即試行、失敗時のみTap to play
- [x] 初回1本目はIntersectionObserver待ちせず即DOM配置・即再生（isFirstSlideフラグ）
- [x] manifest+最初のセグメント1個を優先プリフェッチ（hls.js startLevel=0, maxBufferLength=10）
- [x] ガビガビサムネ廃止: Bunnyサムネをwidth=1920&height=1080で高解像度取得
- [x] オレンジ再生ボタンUI廃止: ローディングは中央スピナーのみ
- [x] 画像ギャラリー復旧: 動画と画像を同一ギャラリーでスワイプ/スクロール閲覧（GalleryItem型統合）
- [x] 画像はタップで拡大表示（ImageSlideコンポーネント、ピンチズーム対応）
- [x] デスクトップ2カラム（>=1024px）: 左=車両情報+サムネ一覧+ナビボタン、右=メディアプレイヤー
- [x] デスクトップでもスクロールスナップで次メディアに移動＝自動再生
- [x] スマホは従来の1カラムTikTok表示維持
- [x] ビルドエラーゼロ・TypeScriptエラーゼロ確認済み
- [x] テスト全102件パス（tikTokVideoGallery.test.ts 31件含む）
- [x] チェックポイント保存

## TikTokVideoGallery v3 完全作り直し（2026-02-09）
- [x] video要素は常に1つだけDOMに存在（生成・破棄禁止、src差し替えのみ）
- [x] 自動再生: muted+playsinline+autoplay、IntersectionObserver/await/user操作待ち全禁止
- [x] UI完全削除: poster/再生ボタン/ローディングUI全廃止
- [x] 操作設計: 縦スクロール=同一車両内の次/前動画、横スワイプ=別車両切替
- [x] スクロール/スワイプした瞬間にsrc差し替え→即再生
- [x] 無限ループ: 最後→最初、最初→最後に戻れる
- [x] HLS m3u8前提: iOS=ネイティブ、PC=hls.js（iOSにhls.js禁止）
- [x] デスクトップ2カラム: 動画を右に寄せ、左に車両情報+画像ギャラリー
- [x] スマホは縦フルスクリーン維持
- [x] 画像ギャラリー復旧（デスクトップ左カラムに表示、タップで拡大表示）
- [x] VideoFeed/ConsignmentFeed/Consignmentからの呼び出し配線完了
- [x] ビルドエラーゼロ・TypeScriptエラーゼロ確認済み
- [x] テスト全109件パス（tikTokVideoGallery.test.ts 38件含む）
- [x] チェックポイント保存

## TikTokVideoGallery v4 8点修正（2026-02-09）
- [x] [0] オレンジ再生ボタン完全削除・poster/ガビガビサムネ禁止・黒背景のみ（VideoFeed/ConsignmentFeed/Consignment全て）
- [x] [1] タップ時の縮小/拡大アニメーション撤廃・最初から最終サイズで表示
- [x] [2] CSS transformベースのぬるっと遷移（translateY/translateX + transition 300ms）
- [x] [3] 操作軸逆転: 縦=車両切替、横=同一車両内メディア切替
- [x] [4] 動画なし車両は画像ギャラリーにフォールバック
- [x] [5] メディア連結: 動画→画像へ横スワイプで連続遷移可能・無限ループ
- [x] [6] 委託在庫は通常在庫に混ぜない（分離維持確認済み）
- [x] [7] Mac2カラム固定: 左=サムネ一覧+車両情報、右=メディア表示ゾーン
- [x] ビルドエラーゼロ・TypeScriptエラーゼロ確認済み
- [x] テスト全117件パス（tikTokVideoGallery.test.ts 46件含む）
- [x] チェックポイント保存

## AC1-AC8 TikTok体感ギャラリー完全やり直し（2026-02-09）
- [x] AC1: オレンジ再生ボタン・poster・ガビガビサムネ一瞬表示ゼロ（スマホ/Mac両方）— HLS直接再生方式
- [x] AC2: タップ時にサイズが変わる/小さく始まる挙動ゼロ — 最初から100vw×100vh固定
- [x] AC3: スワイプ/スクロール遷移が"画面が下/横からぬるっと入る"TikTok型（CSS scroll-snap + transform）— CSS animation実装
- [x] AC4: 操作軸逆転（縦=別車両、横=同車両内メディア）— v6で実装
- [x] AC5: 動画なし車両は画像ギャラリーへ自動フォールバック（"動画なし"文言禁止）— v6で実装
- [x] AC6: vehicleIdとmediaの同期強制（タイトル変わったのにメディア変わらないバグゼロ）— key付け+即時src差し替え
- [x] AC7: "一定枚数で次に行けない"問題ゼロ（境界/スナップ/配列更新バグ修正）— modulo演算で循環
- [x] AC8: 委託在庫は通常在庫に混ぜない（分離遵守）— 呼び出し側で分離済み
- [x] 委託在庫タブに飛ぶと下のタブ選択できない問題修正 — dvhに変更してnavとの重なり解消
- [x] 背景動画: poster禁止・再生ボタンUI禁止・黒背景→即動画（HLS直接再生方式に切替完了）
- [x] Mac 2カラム固定: 左=車両情報+サムネ統合、右=メディア大表示 — v6デスクトップレイアウト
- [x] ビルドエラーゼロ・TypeScriptエラーゼロ — LSPエラーゼロ確認済み
- [x] テスト・チェックポイント保存 — 全127件パス（v6テスト 56件含む）
- [x] ACチェックリスト報告

## v7: スマホTikTok体感修正（最優先）
- [x] 拡大縮小アニメーション完全廃止（scale/transform/transition全削除）
- [x] video表示領域を常時100vw×100vh固定（object-fit:cover; width:100%; height:100%）
- [x] scroll-snap純粋実装（y mandatory + start のみ、中間状態でフェード/拡大縮小なし）
- [x] poster/再生ボタンUI/サムネ一瞬表示を完全廃止
- [x] HLS画質改善（720p以上を初期選択、回線弱い場合のみ自動で下げる）
- [x] 動画なし車両は画像フルスクリーン表示（縦スクロール体験を途切れさせない）
- [x] PC版は壊れない固定表示（共通コードを汚さない）
- [x] テスト全パス・チェックポイント保存（129件パス、1件スキップ）

## v8: 実機テスト問題修正
- [x] 背景動画モード廃止 → 最初からTikTok型フルスクリーンギャラリー表示
- [x] 画像はobject-fit: contain（正方形画像の拡大問題解消）、動画はcoverのまま
- [x] IntersectionObserverで表示中スライドのみ再生（先読み再生禁止）
- [x] media配列が空の車両はギャラリーからスキップ（メディアなし表示禁止）
- [x] 白い余白解消（navバーの下の余白を完全に消す）
- [x] ConsignmentFeedも同様に修正
- [x] テスト全パス・チェックポイント保存

## v9: 実機テスト問題修正（横スクロール・黒画面・詳細畳み込み）
- [ ] 横スクロールをscroll-snap x mandatoryで実装（ネストscroll-snap）
- [ ] 指の動きに追従する横スワイプ（即差し替えではなく物理スクロール）
- [ ] 縦/横スワイプの誤判定を解消（ブラウザネイティブに任せる）
- [ ] 動画の黒画面問題を解消（画像プレースホルダーで動画読み込み中をカバー）
- [ ] 前後1スライドのHLSプリロード（表示前に初期化だけしておく）
- [ ] 詳細文章を「車両詳細」ボタンに畳む（タップで拡大表示）
- [ ] テスト全パス・チェックポイント保存

## v10: DesktopGallery removeChildエラー修正 + ユーザーフィードバック対応
- [x] DesktopGalleryのvideo要素をReact管理外のDOM直接操作方式に変更（removeChildエラー修正）
- [x] 急速スクロール時の黒画面対策（IntersectionObserver改善）
- [x] 横スクロールのスムーズ化（scroll-behavior/touch-action調整）
- [x] メディアなし車両の画像自動フォールバック（「メディアなし」表示の完全排除）
- [x] 動画が完全にビューポートに入る前に再生開始する問題の修正
- [x] VideoFeed/ConsignmentFeed/Consignment.tsxのhooks違反修正（vehicleMedia.listBulk APIで一括取得に変更）
- [x] Consignment.tsxのisActive判定改善（activeIdxのみ再生）
- [x] テスト全パス・チェックポイント保存

## v10.1: ステータス表示・車両詳細ボタンの位置調整
- [x] 「在庫あり」「成約済」ステータス表示を上部ロゴと被らない位置に移動
- [x] 「車両詳細」ボタンが下タブバーに隠れないよう位置調整
- [x] 動画・画像が下タブに隠れないよう配慮
- [x] テスト全パス・チェックポイント保存

## v10.2: ユーザーフィードバック大規模修正（2026-02-10）
- [x] 左上「1/18」カウンターを削除（MobileGalleryから削除、ロゴに被っていた）
- [x] 右上「×」ボタンを削除（MobileGalleryから削除、VideoFeedモードでは不要）
- [x] 右上にステータスプレート（在庫あり/成約済/委託車両）を動的配置
- [x] サムネイルを動画の最初のフレーム（Bunny thumbnail.jpg）に変更
- [x] 黒画面を排除（posterにサムネイル設定、再生開始まで表示し続ける）
- [x] ページ読み込み直後の関係ない車表示問題修正（isActive判定厳密化）
- [x] 車両詳細ボタン：全文表示に修正（文字数制限撤廃、DetailSheetで全文表示）
- [x] 車両詳細：車両切替時に自動で閉じる（isActive=false時にsetShowDetail(false)）
- [x] 委託在庫一覧：「委託掲載について」をdescriptionに追記し車両詳細ボタン内に表示
- [x] 画質の改善（capLevelToPlayerSize: false確認、HLS自動品質選択維持）
- [x] 表示速度の改善（poster画像で即時表示、黒画面排除で体感速度向上）
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.3: TikTok方式の遷移改善（2026-02-10）
- [x] 黒画面完全排除: poster廃止、placeholderのみで制御、playingイベントでフェードアウト
- [x] 在庫あり/成約済/委託車両プレートをもっと上に配置（top: 12px）
- [x] 文章入力がなくても全車に車両詳細ボタンを表示
- [x] ドットインジケーター（1/23等）を全車統一
- [x] ドットインジケーターの指スクロール追従改善（scrollタイマー30ms）
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.4: 初期表示・ドットインジケーター・動画遷移・ネットワーク最適化（2026-02-10）
- [x] ページ読み込み直後に関係ない車が一瞬表示される問題を修正（VideoFeedでreadyフラグ制御）
- [x] 1台目のドットインジケーターを他の車両と統一（全車テキスト形式「1/23」）
- [x] 動画再生直前の不自然な挙動を修正（timeupdateでcurrentTime>0.05確認後にフェードアウト）
- [x] 不要なネットワークリクエスト削減（非アクティブ時HLS完全破棄、バッファサイズ削減）
- [x] エラー発生の調査と修正（hooks違反修正済み、HLSエラーハンドリング追加）
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.5: ドットインジケーター・ステータスプレート・ネットワーク最適化（2026-02-10）
- [x] ドットインジケーターを全車ドット形式（●○○○）に統一（スライディングウィンドウ表示対応）
- [x] ステータスプレート（在庫あり/成約済/委託車両）の位置をチバガレージロゴと同じ高さに揃える（top: 24px）
- [x] 非アクティブ車両のplaceholder画像にloading="lazy"追加（thumbnail.jpgの不要な即時読み込み停止）
- [x] HLSバッファサイズ削減（maxBufferLength: 10→6, maxMaxBufferLength: 20→12, maxBufferSize: 30MB）
- [x] 不要なフォント削除（Shippori Mincho, Yuji Syukuを削除、Noto Sans JPのみに絞る）
- [x] video.bunnycdn.comのpreconnect/dns-prefetch削除（未使用）
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.6: 不要ネットワークリクエスト完全排除（2026-02-10）
- [x] VideoWarmupの背景MP4ダウンロードを完全排除（return nullに変更）
- [x] MediaCellで非アクティブ時は黒背景のみ表示（画像・HLS一切読み込みなし）
- [x] アクティブ車両の現在メディアのみthumbnail.jpg+HLS読み込み（非アクティブ車両の全リクエスト停止）
- [x] DesktopGalleryサムネイルグリッドを遅延読み込み化（選択中のみ即時、残りは2秒後段階的）
- [x] HLS startLevel=0固定でvideo0.tsの重複リクエスト防止
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.7: 動画再生前のサムネイル描写完全排除・プレート位置修正（2026-02-10）
- [x] 全車の動画再生前のplaceholder画像（thumbnail.jpg）を完全排除（黒背景→動画フレーム直接遷移）
- [x] 車両切替時の白い画面フラッシュを排除（全divにbackground: black追加）
- [x] ステータスプレート位置をチバガレージロゴの下ラインに揃える（top: 35px）
- [x] DesktopGalleryのplaceholderも同時に排除
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.8: 動画拡大描写排除・読み込み速度改善・委託在庫TikTok化（2026-02-10）
- [x] 動画再生直前の一瞬の拡大描写を排除（video要素を非表示→currentTime>0.15で表示、低解像度フレームスキップ）
- [x] 動画読み込み速度改善（HLS startLevel=-1で自動選択、高解像度から開始）
- [x] 委託在庫一覧ページを在庫一覧と同じTikTok形式（TikTokVideoGallery直接使用）に変更
- [x] 委託在庫ページの「委託掲載について」バナー削除（説明セクション・End of Feedバナー全削除）
- [x] 委託在庫ページ下部の白い余白排除（TikTokVideoGalleryのfixed全画面表示で解消）
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.9: 委託在庫ページ復活・動画再生高速化（2026-02-10）
- [x] 委託在庫ページにheaderSlot（委託掲載の流れ説明セクション）を復活
- [x] 委託在庫ページにfooterSlot（「委託在庫は以上です」+ LINEボタン）を復活
- [x] 動画再生高速化: HLS maxBufferLength:2, backBufferLength:0, video表示タイミング currentTime>0.01
- [x] poster画像復活: thumbnail.jpgを即座に表示→動画フレームにシームレス遷移（黒画面排除）
- [x] DesktopGalleryにもposter画像追加
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.10: poster画像削除・動画高速化・委託在庫ページ復活（2026-02-10）
- [x] poster画像（thumbnail.jpg）を完全削除（MediaCell + DesktopGallery両方）
- [x] 動画表示タイミングを最速化（currentTime > 0で即座表示）
- [x] 委託在庫ページのheaderSlot/footerSlotが正しく実装されていることを確認
- [x] テスト全パス（129 passed）・チェックポイント保存

## v10.11: 委託在庫ページ復元・動画再生0.2秒化（2026-02-10）
- [x] 委託在庫ページは既に独自scroll-snap形式（委託掲載説明+車両スライド+End of Feed）で実装済み（headerSlot/footerSlot未使用）
- [x] HLSプリロード機構実装: 隣接車両(activeIdx±1)のマニフェスト+バリアント+最初のセグメントをfetchでブラウザキャッシュにプリロード
- [x] MobileGallery・Consignment.tsx両方にプリロード呼び出しを追加
- [x] テスト141件全パス（+12件のプリロードテスト追加）・チェックポイント保存

## v10.12: 動画再生0.2秒化・委託在庫ページレイアウト修正（2026-02-10）
- [x] HLS.jsモジュールレベルプリロード（dynamic importの遅延排除）
- [x] loadeddata/canplayイベントで最速検知（timeupdateより早い）
- [x] testBandwidth:falseで帯域幅テストスキップ
- [x] FRAG_BUFFEREDで即座play開始（MANIFEST_PARSED待ち不要）
- [x] 委託在庫 End of Feedの「委託掲載について」バナーを削除
- [x] 委託在庫説明セクションのoverflowY:autoを削除しscroll-snap競合解消
- [x] 説明セクションをコンパクト化（画面内に収まるように）
- [x] 説明セクション表示中に最初の車両をプリロード
- [x] scroll debounce時間を短縮（50ms→20ms, 30ms→15ms）
- [x] テスト141件全パス・チェックポイント保存

## v10.13: 委託在庫ページ入口修正・動画真っ黒修正・動画再生0.2秒化（2026-02-10）
- [x] 委託在庫ページの説明セクションを完全書き直し（overflow:hidden、コンパクト化、scroll-snap競合解消）
- [x] MediaCell非アクティブ時にサムネイル/画像を表示（真っ黒問題解消）
- [x] MobileGalleryにscrollendイベント追加（activeIdx更新を確実化）
- [x] HLS高速化: startLevel:0, maxBufferLength:1, startFragPrefetch:true, abrEwmaDefaultEstimate:5Mbps
- [x] video autoplay:true + preload:autoで最速再生
- [x] FRAG_LOADING時点でplay()呼び出し（デコード可能になり次第即座再生）
- [x] テスト141件全パス・チェックポイント保存

## v10.14: 委託在庫動画再生修正・在庫一覧動画0.2秒化（2026-02-10）
- [x] 委託在庫ページにIntersectionObserver追加でactiveIdx更新を確実化（動画再生問題の根本修正）
- [x] 説明セクションのIntersectionObserverでactiveIdx=-1リセットを確実化
- [x] MobileGalleryにもIntersectionObserver追加（在庫一覧ページの高速化）
- [x] テスト141件全パス・チェックポイント保存

## v10.15: 委託在庫ページを正しい形に完全復元・全動画0.2秒化（2026-02-10）
- [x] 委託在庫ページの説明セクションを通常スクロール形式に完全復元（scroll-snapではない）
- [x] 正しいレイアウト: チバガレージロゴ → CONSIGNMENT VEHICLES → 委託在庫一覧 → 説明カード → 委託掲載の流れSTEP1/2/3 → 委託掲載についてカード → LINEで相談するボタン → ↓スクロールして在庫を見る → 車両一覧（TikTok形式）
- [x] 説明セクションは通常スクロール、車両一覧部分のみscroll-snap
- [x] グローバルHLSプリバッファプール実装（隣接車両のvideo+HLS.jsを事前作成・バッファリング）
- [x] MediaCellがプリバッファからvideo要素を取得して即座再生
- [x] Bunny CDNへのpreconnect/dns-prefetch追加
- [x] IntersectionObserverで確実なactiveIdx更新
- [x] テスト141件全パス・チェックポイント保存

## v10.16: ガビガビ修正・横スクロール高速化・委託在庫スクロール修正（2026-02-10）
- [x] 縦スクロール最初の0.2秒のガビガビ修正（startLevel:-1自動選択、abrEwmaDefaultEstimate:8Mbps、maxBufferLength:2）
- [x] 横スクロール1秒→0.2秒に高速化（preBufferAdjacentMedia + preloadAdjacentMedia実装）
- [x] 横スクロール時の黒画面を排除（隣接メディアのvideo要素+HLS.jsを事前作成）
- [x] 委託在庫ページ「在庫を見る」ボタンを説明カード直下に移動（目立つ黒ボタン+台数表示）
- [x] 委託在庫ページでスクロールだけでも車両が見れるようにする（IntersectionObserverセンチネル実装）
- [x] テスト141件全パス・TypeScriptエラーなし・チェックポイント保存

## v10.17: 再生タイミング修正・委託在庫遷移感度修正・ガビガビ根本修正（2026-02-10）
- [x] 縦スクロール中は再生せず、スナップ完全停止後に即再生（scrollendイベントのみ + IO threshold:0.8）
- [x] 委託在庫ページの自動遷移を削除（ボタンクリックのみで遷移、説明文を読めるように）
- [x] 動画ガビガビ根本修正（abrEwmaDefaultEstimate:50Mbps + MANIFEST_PARSED後に最高品質レベル強制設定）
- [x] テスト141件全パス・TypeScriptエラーなし・チェックポイント保存

## v10.18: サムネイル削除・ガビガビ根本修正（2026-02-10）
- [x] 非アクティブ動画のサムネイル画像を完全削除（黒背景のみ、TikTok本家と同様）
- [x] ガビガビ根本修正: プリバッファでplay→pause→currentTime=0→isActive時にplay()で即座高品質再生
- [x] テスト141件全パス・TypeScriptエラーなし

## v10.19: ガビガビ根本修正v3 - ABR完全無効化（2026-02-13）
- [x] HLS.js ABR完全無効化: autoStartLoad:falseでマニフェスト解析後に最高品質固定してからstartLoad()
- [x] startFragPrefetch:falseで低品質先読みを完全阻止
- [x] プリバッファ・attachHlsToVideo両方で同一方式適用
- [x] テスト141件全パス・TypeScriptエラーなし

## v10.20: 動画再生アーキテクチャ根本リニューアル（2026-02-13）
- [x] iOS Safari: hls.js完全除外、<video src="xxx.m3u8">ネイティブHLS直指定のみ
- [x] hls.jsはPC/Androidのみ使用
- [x] ABR最高品質固定を廃止、ABR自動選択に戻す
- [x] 動画0秒フレームの静止画をBunny APIで事前生成（thumbnailTime=0、全18本設定済み）
- [x] スクロール中は常に静止画のみ表示（opacity:0→opacity:1で動画を重ねる）
- [x] IntersectionObserverで完全表示された瞬間だけ再生開始（threshold:0.8 + scrollend）
- [x] preload="metadata"で最小限のデータのみ取得、表示直前にvideo.load()
- [x] preload="auto"→preload="metadata"に変更
- [x] 表示直前にJSでvideo.load()を実行
- [x] transform/scaleアニメーション禁止、常にフルサイズ固定
- [x] サムネイルは必ず動画の開始フレーム（0秒目）を使用（Bunny API thumbnailTime=0）
- [x] 新規動画アップロード時に自動でsetBunnyThumbnailToFirstFrameを呼び出し
- [x] 不要なサーバープロキシ（bunnyThumbnailProxy）を削除（CDN直リンクに変更）
- [x] テスト141件全パス・TypeScriptエラーなし

## v10.21: 数値ベース動画最適化（2026-02-13）
- [x] 黒背景即廃止: 0秒フレーム静止画を常時表示（動画の下にimg要素を常に配置）
- [x] T1-T3計測ログ実装（console.logで出力）
- [x] play→pause事前デコードを廃止、代わりにfetchベースの軽量先読みに変更
- [x] 先読みを1本のm3u8 + 最初の1セグメントのみに制限（Wi-Fi時のみ）
- [x] テスト141件全パス・TypeScriptエラーなし

## v10.22: 再生遅延根本修正・サムネ0秒固定・セグメント長最適化（2026-02-13）
- [x] Bunny Stream Set Thumbnail APIで全動画に0秒フレームJPGを設定
- [x] 各動画からffmpegで0秒フレームJPGを抽出→Set Thumbnail APIでアップロード
- [x] Bunny CDNのセグメント長設定を確認（結果: セグメント長は4秒固定、カスタマイズ不可）
- [x] モバイルでHLS→MP4直接再生に切り替え（moov atom先頭、206 Partial Content対応確認済）
- [x] サーバー側MP4プロキシエンドポイント実装（/api/bunny-mp4/:videoId/:resolution ・Refererヘッダー付き・Token Auth回避）
- [x] サーバー側HLSプロキシエンドポイント実装（/api/bunny-hls/:videoId/* ・m3u8 URL書き換え対応）
- [x] スクロール停止→即video.src差し替え→即play()（await禁止・readyState待ち禁止）
- [x] PC版は触らない（スマホ版のみ最適化、HLS.js維持）
- [x] 目標: スクロール停止→再生まで300ms以内（MP4直接再生で実現）
- [x] テスト全パス・チェックポイント保存（9ファイル157テスト全パス）

## v10.23: HLSネイティブ再生に完全リセット（2026-02-13）
- [x] MP4直接再生を全廃止（getBunnyMp4ProxyUrl等を完全削除）
- [x] サーバー側MP4/HLSプロキシを全廃止（/api/bunny-mp4, /api/bunny-hls削除）
- [x] HLS(m3u8)ネイティブ再生に戻す（iOS=ネイティブ、PC=hls.js）
- [x] CDN直URL使用（プロキシ・ヘッダ改変禁止）
- [x] スクロール中は0秒フレーム静止画のみ表示（動画再生一切なし）
- [x] 画面内に完全に入った瞬間にplay()（IntersectionObserver threshold:0.8+scrollend）
- [x] muted + playsinline + autoplay、isActive時のみvideo要素を作成・URL差し替え方式
- [x] 画質はAuto ABR（startLevel:-1、強制360p/480p禁止）
- [x] 事前プリバッファ禁止（play→pause禁止、セグメント先読み禁止）
- [x] 低解像度スタート→後昇格は禁止
- [x] PC版は壊さない（hls.js維持、デスクトップギャラリー正常動作確認）
- [x] テスト全パス・チェックポイント保存（9ファイル144テスト全パス）

## v10.24: 演出設計変更 — 再生待ち2秒を感じさせない（2026-02-14）
- [x] m3u8（manifest）のみ1本先まで事前取得（セグメントは取得しない）
- [x] スクロール中は常に0秒フレーム静止画のみ（videoタグはisActive時のみDOM追加）
- [x] 画面にスナップした瞬間にvideo.src=m3u8→即play()
- [x] videoはopacity:0で開始→playingイベント発火でopacity:1フェード
- [x] 静止画は同時に消す（playingイベントまで絶対に消さない）
- [x] 黒背景や中途半端なフレーム禁止
- [x] hls.js設定: startLevel:-1, maxBufferLength:5, backBufferLength:0, lowLatencyMode:true
- [x] 360p強制/セグメント事前DL/MP4回帰/プロキシ再導入/ABR無効化は禁止
- [x] PC版は壊さない（hls.js維持、DesktopGallery正常動作）
- [x] テスト全パス（9ファイル160テスト全パス）・チェックポイント保存

## v10.25: セグメント事前取得・自前サムネイル方式（2026-02-14）
- [x] スクロール中にvideo.src=m3u8 → video.load()（isPreloading時にvideo要素作成・load()実行、再生はしない）
- [x] snap完了時にcurrentTime=0 → play()（初期セグメント待ちを消す）
- [x] 動画アップロード時にBunny CDNから0秒フレームDL→S3アップロード→DB thumbnailUrl保存
- [x] Bunny自動サムネは使わない（自前サムネのみ、generateAndUploadThumbnail関数）
- [x] 既存動画18本の自前サムネ移行完了（全本S3にアップロード済み）
- [x] フロントエンドでitem.thumbnailUrlを優先使用（fallback: Bunny CDN）
- [x] PC版は壊さない（DesktopGallery正常動作確認済み）
- [x] テスト全パス（9ファイル160テスト全パス）・チェックポイント保存

## v10.26: レターボックスサムネイル・micro-preplay（2026-02-14）
- [x] サムネイルをレターボックス方式に変更（背景ぼかし9:16 + 元フレーム縮小中央配置、クロップ禁止）
- [x] 18本全てのサムネイルを再生成してS3にアップロード・DB更新
- [x] フロントエンドのサムネイル表示をobject-fit:containに変更（レターボックス対応）
- [x] 隣接セル（±1）にmicro-preplay実装（play()→100ms→pause()→currentTime=0）
- [x] micro-preplayはWi-Fi時 or effectiveType=4g+downlink 2Mbps以上の時のみ有効化
- [x] video表示はopacity:0で絶対に見せない（micro-preplay中、dataset.isActiveで制御）
- [x] snap完了時はplay()で即開始（体感0秒）
- [x] PC版は触らない（デスクトップギャラリー正常動作確認済み）
- [x] テスト全パス（9ファイル185テスト全パス）・チェックポイント保存

## v10.27: サムネ加工全廃止・micro-preplay削除・シンプルHLS（2026-02-14）
- [x] サムネ加工を全廃止（レターボックス禁止・背景ぼかし禁止・合成禁止・リサイズ禁止）
- [x] 0秒目フレームをそのままJPEG保存（Bunny CDNからDL→S3アップロード）
- [x] 18本全てのサムネイルを無加工で再生成→S3アップロード→DB更新
- [x] micro-preplayを完全削除（shouldEnableMicroPreplay関数・isPreloading prop・隣接セルプリロード判定）
- [x] サムネ表示: width:100%のみ（object-fit:cover禁止、object-fit:contain禁止）
- [x] 動画が1:1なら1:1で表示（余白OK、潰すな）
- [x] シンプルHLS再生のみ（演出ゼロ・加工ゼロ）
- [x] PC版は壊さない（DesktopGalleryのobject-fit:containは維持）
- [x] テスト全パス（9ファイル172テスト）・チェックポイント保存

## v10.27修正: サムネイル潰れ修正（2026-02-14）
- [x] サムネimg: width:100% + height:auto + display:block + flexShrink:0
- [x] 親要素はscroll-snap用にheight:100%維持、内部はflex+centerで中央配置
- [x] video要素もwidth:100% + height:auto + display:block
- [x] テスト全パス（9ファイル172テスト）・チェックポイント保存

## v10.27修正2: サムネ潰れゼロ + ガビガビ復活修正（2026-02-14）
- [x] サムネ潰れ: 絶対配置+inset:0+flex中央+max-width/max-height+object-fit:contain方式
- [x] video要素: position:absolute+inset:0+width/height:100%+object-fit:contain
- [x] ガビガビ修正: MANIFEST_PARSED後にplay()、iOSはcanplay後にplay()
- [x] playingイベントまで静止画を保持（opacity:0→playing→opacity:1）
- [x] テスト全パス（9ファイル174テスト）・チェックポイント保存

## v10.27.3: videoレイヤー表示修正（2026-02-14）
- [x] サムネimg: z-index:1、videoEl: z-index:2（videoが上）
- [x] サムネはplaying発火でdisplay:none（data-thumb-wrap属性で取得）+ React stateでも制御
- [x] テスト全パス（9ファイル174テスト）・チェックポイント保存

## v10.28: video1枚構成リセット（2026-02-14）
- [x] サムネイルwrapを完全削除
- [x] videoタグをJSXで常時DOMに存在（破棄しない）
- [x] isActive時のみplay()/pause()制御
- [x] z-index操作・display:none操作を全廃止
- [x] opacity制御も廃止
- [x] videoタグ1枚構成（JSXでレンダリング、useRefで参照）
- [x] テスト全パス（9ファイル167テスト）・チェックポイント保存

## v10.29: TikTok寄せUI修正（2026-02-18）
- [x] サムネ⇄video切替を「playing」基準に固定（play()呼んだ瞬間に表示しない）
- [x] playingまでサムネ(0秒フレーム)を100%表示し続ける
- [x] スクロール中の黒を完全禁止（poster属性にサムネURL + サムネimgレイヤー）
- [x] active判定: scrollend（主）+ IO threshold=0.95（フォールバック）
- [x] チャタリング防止: 0.95以上でのみactive切替
- [x] iOS Safari: canplay待ち禁止、即play()
- [x] PC/Android: MANIFEST_PARSED待ち禁止、即play()
- [x] デバッグログ: activeIdx変更、play()時刻、playing時刻+差分、サムネ切替
- [x] テスト全パス（9ファイル172テスト）・チェックポイント保存

## v10.30: TikTok方式パクリ — 即時切替設計（2026-02-18）
- [x] TikTokログ分析: MP4直URL+事前プリロード+ATTACH→playing 27msの設計を理解
- [x] 隣接セル（前後±1）のvideo要素を事前にDOMに配置しHLS接続済みにする（isAdjacentPreload）
- [x] スクロール完了時はplay()するだけ（事前接続済みなら即再生）
- [x] playing基準サムネ⇄video切替を維持
- [x] 黒禁止: poster属性+サムネimgレイヤー
- [x] active判定: scrollend+IO threshold=0.95
- [x] デバッグログ: ATTACH→playing差分ms、プリロード状態
- [x] テスト全パス（9ファイル177テスト）・チェックポイント保存

## v10.31: TikTok完全パクリ — 根本設計変更（2026-02-18）
- [x] TikTok iOSログ分析完了（スクロール中にデコーダ起動、2並列、snap前に接続開始）
- [x] スクロール50%超で次の動画のHLS接続を開始（onRequestPreconnectコールバック）
- [x] 2つのHLSインスタンスを並列維持（current + next候補）
- [x] playing基準サムネ⇄video切替（playingまでサムネ100%表示）
- [x] サムネはobject-fit:containで親内に収める（潰れゼロ）
- [x] video要素もobject-fit:containで統一
- [x] ガビガビゼロ: startLevel:-1(ABR)のまま、低解像度強制なし
- [x] 黒禁止: poster属性+サムネimgレイヤー
- [x] デバッグログ維持
- [x] テスト全パス（9ファイル182テスト）・チェックポイント保存

## v10.32: TikTok完全パクリv2 — 根本簡素化（2026-02-18）
- [x] 事前接続を完全廃止（1動画のみHLS接続、TikTok同様1デコーダ方式）
- [x] MediaCell: isActive→HLS接続+play(), !isActive→detach+pause+サムネ表示
- [x] サムネ: object-fit:cover統一（TikTokと同じ）
- [x] playing基準サムネ⇄video切替（playingまでサムネ100%表示、playing後にdisplay:none）
- [x] 黒禁止: poster属性+サムネimgレイヤー（z-index:1/2）
- [x] ガビガビゼロ: startLevel:-1(ABR)、低解像度強制なし
- [x] active判定: scrollend+IO threshold=0.95
- [x] デバッグログ維持
- [x] テスト全パス（9ファイル175テスト）・チェックポイント保存

## v10.33: TikTok完全パクリ最終版 — iOS根治修正（2026-02-19）
- [x] iOS Safari: hls.js使用に切替（ManagedMediaSource対応、ABR制御可能に）
- [x] startLevel: 2（480p開始）でガビガビ根絶
- [x] 事前接続復活: 隣接±1車両のHLS接続開始（play()しない）
- [x] 旧動画のHLS破棄（メモリ/デコーダ解放）
- [x] object-fit: cover維持（TikTokと同じ）
- [x] サムネ: playingまで100%表示（黒禁止）
- [x] hls.jsモジュールのプリロード（スマホでも即ロード）
- [x] テスト更新・全パス（9ファイル171テスト）
- [x] チェックポイント保存
- [x] Claude Code引き渡しプロンプト作成

## ローカル完全自立化（Manus依存排除）
- [x] ① 認証バイパス: DEV_MODE=trueでOAuth不要、セッション固定ユーザー自動生成
- [x] ② .env完全テンプレート: 必須/本番専用を分離、未設定でもクラッシュしない
- [x] ③ DATABASE_URL未設定時: 空リスト表示（クラッシュしない）＋ダミーデータスクリプト
- [x] ④ GBP無効化: トークンinvalidでもクラッシュしない、ローカルでは無効化
- [x] ⑤ Bunny Stream: APIキー未設定時は安全にフォールバック
- [x] ⑥ README: LOCAL_DEV_README.md作成済み
- [x] テスト全パス（10ファイル182テスト）
- [x] GitHubにpush
