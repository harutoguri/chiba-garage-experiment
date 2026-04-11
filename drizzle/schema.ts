import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 在庫車両テーブル
 * TikTok風の縦動画表示に対応した車両情報を管理
 */
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  /** 車両名（例: TOYOTA LAND CRUISER PRADO） */
  title: varchar("title", { length: 255 }).notNull(),
  /** 価格（円）。ASKの場合はnull */
  price: int("price"),
  /** 価格表示用テキスト（例: "2,480,000" or "ASK"） */
  priceDisplay: varchar("priceDisplay", { length: 50 }),
  /** 動画URL（S3に保存） */
  videoUrl: text("videoUrl"),
  /** サムネイル画像URL */
  thumbnailUrl: text("thumbnailUrl"),
  /** 画像URL（動画がない場合に表示） */
  imageUrl: text("imageUrl"),
  /** 車両説明 */
  description: text("description"),
  /** ステータス: 在庫あり、商談中、売約済み */
  status: mysqlEnum("status", ["在庫あり", "商談中", "売約済み"]).default("在庫あり").notNull(),
  /** 表示順序（小さいほど先に表示） */
  displayOrder: int("displayOrder").default(0),
  /** 公開フラグ */
  isPublished: boolean("isPublished").default(true),
  /** 委託車両フラグ（true = オーナー様保有の委託車両） */
  isConsignment: boolean("isConsignment").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * 買取実績テーブル
 * スライドショーやアピールに使用する買取実績を管理
 */
export const purchaseRecords = mysqlTable("purchase_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 車両名（例: BMW 3シリーズ） */
  vehicleName: varchar("vehicleName", { length: 255 }).notNull(),
  /** 買取価格（円） */
  purchasePrice: int("purchasePrice").notNull(),
  /** 買取価格表示用テキスト */
  priceDisplay: varchar("priceDisplay", { length: 50 }),
  /** 画像URL（S3に保存） */
  imageUrl: text("imageUrl"),
  /** 買取日 */
  purchaseDate: timestamp("purchaseDate"),
  /** 一言コメント（例: 「他社より50万円高く買取！」） */
  comment: text("comment"),
  /** 表示順序（小さいほど先に表示） */
  displayOrder: int("displayOrder").default(0),
  /** 公開フラグ */
  isPublished: boolean("isPublished").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseRecord = typeof purchaseRecords.$inferSelect;
export type InsertPurchaseRecord = typeof purchaseRecords.$inferInsert;

/**
 * スライドショーメディアテーブル
 * 会社概要ページのスライドショーに表示する画像・動画を管理
 */
export const slideshowMedia = mysqlTable("slideshow_media", {
  id: int("id").autoincrement().primaryKey(),
  /** メディアタイプ: image or video */
  type: mysqlEnum("type", ["image", "video"]).notNull(),
  /** メディアURL（S3に保存） */
  url: text("url").notNull(),
  /** サムネイルURL（動画の場合） */
  thumbnailUrl: text("thumbnailUrl"),
  /** タイトル（管理用） */
  title: varchar("title", { length: 255 }),
  /** 表示順序（小さいほど先に表示） */
  displayOrder: int("displayOrder").default(0),
  /** 公開フラグ */
  isPublished: boolean("isPublished").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SlideshowMedia = typeof slideshowMedia.$inferSelect;
export type InsertSlideshowMedia = typeof slideshowMedia.$inferInsert;

/**
 * 車両メディアテーブル
 * 1台の車両に複数の動画・画像を紐付ける
 */
export const vehicleMedia = mysqlTable("vehicle_media", {
  id: int("id").autoincrement().primaryKey(),
  /** 車両ID（外部キー） */
  vehicleId: int("vehicleId").notNull(),
  /** メディアタイプ: image or video */
  type: mysqlEnum("type", ["image", "video"]).notNull(),
  /** メディアURL（S3に保存、原本保管用） */
  url: text("url").notNull(),
  /** サムネイルURL（動画の場合） */
  thumbnailUrl: text("thumbnailUrl"),
  /** サムネイル抽出タイムスタンプ（秒）: 0.00 = 冒頭, 黒フレーム時は 0.20〜0.50 */
  thumbTs: float("thumb_ts"),
  /** Bunny StreamのビデオID（HLS配信用） */
  bunnyVideoId: varchar("bunnyVideoId", { length: 64 }),
  /** Bunny Stream変換ステータス: pending=アップロード中, processing=変換中, ready=配信可能, error=エラー */
  bunnyStatus: mysqlEnum("bunnyStatus", ["pending", "processing", "ready", "error"]).default("pending"),
  /** Bunny Streamエンコード進捗（0-100） */
  bunnyEncodeProgress: int("bunnyEncodeProgress").default(0),
  /** L1用超軽量プレビュー動画URL（2秒・数百KB） */
  previewUrl: text("previewUrl"),
  /** 画像最適化済みURL（JSON: {webp: {sm, md, lg}, jpeg: {sm, md, lg}} ） */
  optimizedUrls: text("optimizedUrls"),
  /** 表示順序（小さいほど先に表示） */
  displayOrder: int("displayOrder").default(0),
  /** メインメディアフラグ（最初に表示されるメディア） */
  isMain: boolean("isMain").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VehicleMedia = typeof vehicleMedia.$inferSelect;
export type InsertVehicleMedia = typeof vehicleMedia.$inferInsert;

/**
 * ページビューテーブル
 * サイトのアクセス数を記録
 */
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  /** アクセスされたページパス */
  path: varchar("path", { length: 255 }).notNull(),
  /** アクセス日（日別集計用） */
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD形式
  /** その日のアクセス数 */
  count: int("count").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * 最新情報テーブル
 * 会社概要ページに表示する最新情報（タイトル＋URL）を管理
 */
export const newsItems = mysqlTable("news_items", {
  id: int("id").autoincrement().primaryKey(),
  /** タイトル */
  title: varchar("title", { length: 255 }).notNull(),
  /** リンク先URL */
  url: text("url").notNull(),
  /** 表示順序（小さいほど先に表示） */
  displayOrder: int("displayOrder").default(0),
  /** 公開フラグ */
  isPublished: boolean("isPublished").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = typeof newsItems.$inferInsert;

/**
 * ビジネス指標テーブル
 * 年別の累計取扱高・査定成約率を管理
 * 本年のみ実績＋着地予想上乗せ分の積み上げ表示に対応
 */
export const businessMetrics = mysqlTable("business_metrics", {
  id: int("id").autoincrement().primaryKey(),
  /** 年度（例: 2024, 2025） */
  year: int("year").notNull(),
  /** 累計取扱高（円）- 過去年は実績、未来年は予想 */
  totalTransactionAmount: int("totalTransactionAmount").default(0),
  /** 査定件数 - 過去年は実績、未来年は予想 */
  assessmentCount: int("assessmentCount").default(0),
  /** 成約件数 - 過去年は実績、未来年は予想 */
  contractCount: int("contractCount").default(0),
  /** 予想フラグ（true = 予想値）- 未来年の場合にtrue */
  isForecast: boolean("isForecast").default(false),
  
  // 本年のみ使用するフィールド（実績＋着地予想上乗せ分）
  /** 本年実績累計取扱高（円） */
  actualAmount: int("actualAmount").default(0),
  /** 本年着地予想上乗せ分（円） */
  forecastAmountAdd: int("forecastAmountAdd").default(0),
  /** 本年実績累計査定数 */
  actualAssess: int("actualAssess").default(0),
  /** 本年着地予想上乗せ分（査定数） */
  forecastAssessAdd: int("forecastAssessAdd").default(0),
  /** 本年実績累計成約数 */
  actualContract: int("actualContract").default(0),
  /** 本年着地予想上乗せ分（成約数） */
  forecastContractAdd: int("forecastContractAdd").default(0),
  
  /** メモ（管理用） */
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BusinessMetric = typeof businessMetrics.$inferSelect;
export type InsertBusinessMetric = typeof businessMetrics.$inferInsert;
