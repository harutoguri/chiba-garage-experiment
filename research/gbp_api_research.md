# Google Business Profile API 調査結果

## 調査日: 2026-01-31

## localPosts API の状況

Google Business Profile API の localPosts（投稿）機能は、v4.9 API として現在も利用可能です。
廃止スケジュールには localPosts API は含まれていません（Q&A API は 2025年11月3日に廃止済み）。

### 利用可能な機能
- accounts.locations.localPosts.create - 投稿の作成
- accounts.locations.localPosts.delete - 投稿の削除
- accounts.locations.localPosts.get - 投稿の取得
- accounts.locations.localPosts.list - 投稿一覧の取得
- accounts.locations.localPosts.patch - 投稿の更新
- accounts.locations.localPosts.reportInsights - インサイトの取得

### LocalPost リソースの構造
- name: 投稿のID
- summary: 本文
- media[]: メディア（画像）
- createTime: 作成日時
- topicType: STANDARD, EVENT, OFFER, ALERT
- callToAction: CTAボタン

## 実装に必要なもの

### 1. Google Cloud Project の設定
- Google Cloud Console でプロジェクト作成
- Google My Business API を有効化
- OAuth 2.0 認証情報を作成

### 2. 認証フロー
- OAuth 2.0 による認証が必要
- ビジネスオーナーの Google アカウントでの認証が必要
- スコープ: https://www.googleapis.com/auth/business.manage

### 3. 実装の複雑さ
- OAuth 2.0 フローの実装が必要
- リフレッシュトークンの管理が必要
- Google Cloud Console での設定が必要

## 代替案

### 案1: 手動入力方式（現在実装済み）
管理画面から「タイトル＋URL」を手入力し、会社概要ページに表示。
- メリット: シンプル、追加設定不要
- デメリット: 手動コピペが必要

### 案2: Google Business Profile API 連携
OAuth 2.0 認証を実装し、API から自動取得。
- メリット: 自動連携
- デメリット: OAuth 設定が複雑、ユーザーの Google アカウント認証が必要

### 案3: RSS/Atom フィード（非推奨）
Google Business Profile は RSS フィードを提供していない。

## 結論

Google Business Profile API の localPosts 機能は利用可能ですが、OAuth 2.0 認証の実装が必要です。
ユーザー（千葉様）に Google Cloud Console での設定作業をお願いする必要があります。

実装手順:
1. Google Cloud Console でプロジェクト作成
2. Google My Business API を有効化
3. OAuth 2.0 認証情報を作成
4. ホームページ側で OAuth フローを実装
5. アクセストークン/リフレッシュトークンを保存
6. 定期的に投稿を取得して表示
