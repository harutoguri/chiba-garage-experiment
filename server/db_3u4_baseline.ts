import { eq, desc, asc, and, inArray, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, vehicles, purchaseRecords, InsertVehicle, InsertPurchaseRecord, vehicleMedia, InsertVehicleMedia, pageViews, newsItems, InsertNewsItem } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========================================
// 在庫車両 (Vehicles) クエリヘルパー
// ========================================

/** 公開中の在庫一覧を取得（通常在庫のみ、表示順でソート） */
export async function getPublishedVehicles() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.isPublished, true), eq(vehicles.isConsignment, false)))
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt));
}

/** 公開中の委託在庫一覧を取得（委託車両のみ、表示順でソート） */
export async function getPublishedConsignmentVehicles() {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.isPublished, true), eq(vehicles.isConsignment, true)))
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt));
}

/**
 * 委託車両 + 全メディアを1リクエストで返す（getPublishedVehiclesWithMedia の委託版）
 * Consignment.tsx の 2段ウォーターフォール（listConsignment → listBulk）を解消
 */
export async function getPublishedConsignmentVehiclesWithMedia() {
  const db = await getDb();
  if (!db) {
    return {
      vehicles: [] as Awaited<ReturnType<typeof getPublishedConsignmentVehicles>>,
      mediaMap: {} as Record<number, Awaited<ReturnType<typeof getVehicleMedia>>>,
    };
  }

  const vehicleList = await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.isPublished, true), eq(vehicles.isConsignment, true)))
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt));

  if (vehicleList.length === 0) {
    return { vehicles: vehicleList, mediaMap: {} as Record<number, Awaited<ReturnType<typeof getVehicleMedia>>> };
  }

  const vehicleIds = vehicleList.map(v => v.id);
  const allMedia = await db.select()
    .from(vehicleMedia)
    .where(inArray(vehicleMedia.vehicleId, vehicleIds))
    .orderBy(asc(vehicleMedia.displayOrder), desc(vehicleMedia.createdAt));

  const mediaMap: Record<number, typeof allMedia> = {};
  for (const m of allMedia) {
    if (!mediaMap[m.vehicleId]) mediaMap[m.vehicleId] = [];
    mediaMap[m.vehicleId].push(m);
  }

  return { vehicles: vehicleList, mediaMap };
}

/** 全ての在庫一覧を取得（管理者用） */
export async function getAllVehicles() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(vehicles)
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt));
}

/** 在庫を1件取得 */
export async function getVehicleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 在庫を追加 */
export async function createVehicle(vehicle: InsertVehicle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(vehicles).values(vehicle);
  return result;
}

/** 在庫を更新 */
export async function updateVehicle(id: number, data: Partial<InsertVehicle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(vehicles).set(data).where(eq(vehicles.id, id));
}

/** 在庫を削除 */
export async function deleteVehicle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(vehicles).where(eq(vehicles.id, id));
}

// ========================================
// 買取実績 (PurchaseRecords) クエリヘルパー
// ========================================

/** 公開中の買取実績一覧を取得（表示順序でソート） */
export async function getPublishedPurchaseRecords() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(purchaseRecords)
    .where(eq(purchaseRecords.isPublished, true))
    .orderBy(asc(purchaseRecords.displayOrder), desc(purchaseRecords.createdAt));
}

/** 全ての買取実績一覧を取得（管理者用、表示順序でソート） */
export async function getAllPurchaseRecords() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(purchaseRecords)
    .orderBy(asc(purchaseRecords.displayOrder), desc(purchaseRecords.createdAt));
}

/** 買取実績を1件取得 */
export async function getPurchaseRecordById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(purchaseRecords).where(eq(purchaseRecords.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 買取実績を追加 */
export async function createPurchaseRecord(record: InsertPurchaseRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseRecords).values(record);
  return result;
}

/** 買取実績を更新 */
export async function updatePurchaseRecord(id: number, data: Partial<InsertPurchaseRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(purchaseRecords).set(data).where(eq(purchaseRecords.id, id));
}

/** 買取実績を削除 */
export async function deletePurchaseRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(purchaseRecords).where(eq(purchaseRecords.id, id));
}


// ========================================
// スライドショーメディア (SlideshowMedia) クエリヘルパー
// ========================================

import { slideshowMedia, InsertSlideshowMedia } from "../drizzle/schema";

/** 公開中のスライドショーメディア一覧を取得（表示順でソート） */
export async function getPublishedSlideshowMedia() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(slideshowMedia)
    .where(eq(slideshowMedia.isPublished, true))
    .orderBy(asc(slideshowMedia.displayOrder), desc(slideshowMedia.createdAt));
}

/** 全てのスライドショーメディア一覧を取得（管理者用） */
export async function getAllSlideshowMedia() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(slideshowMedia)
    .orderBy(asc(slideshowMedia.displayOrder), desc(slideshowMedia.createdAt));
}

/** スライドショーメディアを1件取得 */
export async function getSlideshowMediaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(slideshowMedia).where(eq(slideshowMedia.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** スライドショーメディアを追加 */
export async function createSlideshowMedia(media: InsertSlideshowMedia) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(slideshowMedia).values(media);
  return result;
}

/** スライドショーメディアを更新 */
export async function updateSlideshowMedia(id: number, data: Partial<InsertSlideshowMedia>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(slideshowMedia).set(data).where(eq(slideshowMedia.id, id));
}

/** スライドショーメディアを削除 */
export async function deleteSlideshowMedia(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(slideshowMedia).where(eq(slideshowMedia.id, id));
}

// ========================================
// 車両メディア (VehicleMedia) クエリヘルパー
// ========================================

/** 車両のメディア一覧を取得（表示順でソート） */
export async function getVehicleMedia(vehicleId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 先頭画像を自動的にメイン扱いにするため、displayOrderのみでソート
  return await db.select()
    .from(vehicleMedia)
    .where(eq(vehicleMedia.vehicleId, vehicleId))
    .orderBy(asc(vehicleMedia.displayOrder), desc(vehicleMedia.createdAt));
}

/** 複数車両のメディアを一括取得（vehicleIdでグループ化して返す） */
export async function getAllVehicleMediaByIds(vehicleIds: number[]) {
  const db = await getDb();
  if (!db || vehicleIds.length === 0) return {} as Record<number, Awaited<ReturnType<typeof getVehicleMedia>>>;
  
  const allMedia = await db.select()
    .from(vehicleMedia)
    .where(inArray(vehicleMedia.vehicleId, vehicleIds))
    .orderBy(asc(vehicleMedia.displayOrder), desc(vehicleMedia.createdAt));
  
  const grouped: Record<number, typeof allMedia> = {};
  for (const m of allMedia) {
    if (!grouped[m.vehicleId]) grouped[m.vehicleId] = [];
    grouped[m.vehicleId].push(m);
  }
  return grouped;
}

/**
 * 公開車両 + 全メディアを1回のHTTPラウンドトリップで返す
 *
 * 問題: vehicles.list → vehicleMedia.listBulk の2段階ウォーターフォールが
 *       初回ロードを遅らせていた（合計 ~2s + 追加 ~500ms）
 * 解決: サーバー側で2クエリを直列実行し、クライアントは1リクエストで完結する
 */
export async function getPublishedVehiclesWithMedia() {
  const db = await getDb();
  if (!db) {
    return {
      vehicles: [] as Awaited<ReturnType<typeof getPublishedVehicles>>,
      mediaMap: {} as Record<number, Awaited<ReturnType<typeof getVehicleMedia>>>,
    };
  }

  // 1) 公開車両一覧
  const vehicleList = await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.isPublished, true), eq(vehicles.isConsignment, false)))
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt));

  if (vehicleList.length === 0) {
    return { vehicles: vehicleList, mediaMap: {} as Record<number, Awaited<ReturnType<typeof getVehicleMedia>>> };
  }

  // 2) 全車両のメディアを一括取得（同一関数内で直列実行 → クライアントからは1往復）
  const vehicleIds = vehicleList.map(v => v.id);
  const allMedia = await db.select()
    .from(vehicleMedia)
    .where(inArray(vehicleMedia.vehicleId, vehicleIds))
    .orderBy(asc(vehicleMedia.displayOrder), desc(vehicleMedia.createdAt));

  const mediaMap: Record<number, typeof allMedia> = {};
  for (const m of allMedia) {
    if (!mediaMap[m.vehicleId]) mediaMap[m.vehicleId] = [];
    mediaMap[m.vehicleId].push(m);
  }

  return { vehicles: vehicleList, mediaMap };
}

/**
 * ギャラリー先行表示用: 最初の公開車両 + そのメディアを返す（listWithMedia の 1/N の重さ）
 * → listWithMedia より格段に速い → ギャラリーを 0.3s 以内に表示できる
 */
export async function getFirstPublishedVehicleWithMedia() {
  const db = await getDb();
  if (!db) return null;

  // listWithMedia と同じフィルタ・ソートで最初の1台のみ取得
  const vehicleList = await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.isPublished, true), eq(vehicles.isConsignment, false)))
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt))
    .limit(1);

  if (!vehicleList[0]) return null;
  const vehicle = vehicleList[0];

  const mediaList = await db.select()
    .from(vehicleMedia)
    .where(eq(vehicleMedia.vehicleId, vehicle.id))
    .orderBy(asc(vehicleMedia.displayOrder), desc(vehicleMedia.createdAt));

  return {
    vehicles: vehicleList,
    mediaMap: { [vehicle.id]: mediaList } as Record<number, typeof mediaList>,
  };
}

/**
 * 初回ロード早期プリロード用: 公開済み車両の最初の動画 bunnyVideoId を返す
 * listWithMedia より格段に軽い1行クエリ → フロントでHLS接続を先行開始できる
 */
export async function getFirstPublishedVideoHls(): Promise<{ bunnyVideoId: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({ bunnyVideoId: vehicleMedia.bunnyVideoId })
    .from(vehicleMedia)
    .innerJoin(vehicles, eq(vehicleMedia.vehicleId, vehicles.id))
    .where(
      and(
        eq(vehicles.isPublished, true),
        eq(vehicles.isConsignment, false),
        eq(vehicleMedia.type, 'video'),
        isNotNull(vehicleMedia.bunnyVideoId),
        eq(vehicleMedia.bunnyStatus, 'ready'),
      )
    )
    .orderBy(asc(vehicles.displayOrder), desc(vehicles.createdAt), asc(vehicleMedia.displayOrder))
    .limit(1);

  return result[0]?.bunnyVideoId ? { bunnyVideoId: result[0].bunnyVideoId! } : null;
}

/** 全 bunnyVideoId 一覧（サムネイル一括修正用） */
export async function getAllBunnyVideoIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ bunnyVideoId: vehicleMedia.bunnyVideoId })
    .from(vehicleMedia)
    .where(isNotNull(vehicleMedia.bunnyVideoId));
  return result.map(r => r.bunnyVideoId!).filter(Boolean);
}

/** 全 bunnyVideoId + DB id 一覧（S3サムネイル一括生成用） */
export async function getAllBunnyVideosForThumbnail(): Promise<{ id: number; bunnyVideoId: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ id: vehicleMedia.id, bunnyVideoId: vehicleMedia.bunnyVideoId })
    .from(vehicleMedia)
    .where(isNotNull(vehicleMedia.bunnyVideoId));
  return result.filter(r => r.bunnyVideoId != null) as { id: number; bunnyVideoId: string }[];
}

/** Bunny動画の thumbnailUrl を全て null にリセット（Bunny CDN直URLに戻す） */
export async function clearAllBunnyThumbnailUrls(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(vehicleMedia)
    .set({ thumbnailUrl: null })
    .where(isNotNull(vehicleMedia.bunnyVideoId));
}

/** 車両メディアを1件取得 */
export async function getVehicleMediaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vehicleMedia).where(eq(vehicleMedia.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 車両メディアを追加 */
export async function createVehicleMedia(media: InsertVehicleMedia) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(vehicleMedia).values(media);
  return result;
}

/** 車両メディアを更新 */
export async function updateVehicleMedia(id: number, data: Partial<InsertVehicleMedia>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(vehicleMedia).set(data).where(eq(vehicleMedia.id, id));
}

/** 車両メディアを削除 */
export async function deleteVehicleMedia(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(vehicleMedia).where(eq(vehicleMedia.id, id));
}

/** 車両の全メディアを削除 */
export async function deleteAllVehicleMedia(vehicleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(vehicleMedia).where(eq(vehicleMedia.vehicleId, vehicleId));
}

/** メインメディアを設定（他のメディアのisMainをfalseに） */
export async function setMainVehicleMedia(vehicleId: number, mediaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // まず全てのisMainをfalseに
  await db.update(vehicleMedia)
    .set({ isMain: false })
    .where(eq(vehicleMedia.vehicleId, vehicleId));
  
  // 指定のメディアをメインに
  await db.update(vehicleMedia)
    .set({ isMain: true })
    .where(and(eq(vehicleMedia.id, mediaId), eq(vehicleMedia.vehicleId, vehicleId)));
}

/** 車両メディアの表示順序を一括更新（1クエリ） */
export async function reorderVehicleMedia(items: { id: number; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;

  const cases = items.map(i => sql`WHEN ${i.id} THEN ${i.displayOrder}`);
  const ids = items.map(i => i.id);
  await db.update(vehicleMedia)
    .set({ displayOrder: sql`CASE id ${sql.join(cases, sql` `)} END` })
    .where(inArray(vehicleMedia.id, ids));
}

/** 車両の表示順序を一括更新 */
export async function reorderVehicles(items: { id: number; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    await db.update(vehicles)
      .set({ displayOrder: item.displayOrder })
      .where(eq(vehicles.id, item.id));
  }
}

/** 買取実績の表示順序を一括更新 */
export async function reorderPurchaseRecords(items: { id: number; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    await db.update(purchaseRecords)
      .set({ displayOrder: item.displayOrder })
      .where(eq(purchaseRecords.id, item.id));
  }
}

/** スライドショーメディアの表示順序を一括更新 */
export async function reorderSlideshowMedia(items: { id: number; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    await db.update(slideshowMedia)
      .set({ displayOrder: item.displayOrder })
      .where(eq(slideshowMedia.id, item.id));
  }
}

// ========== アナリティクス関連 ==========

/** ページビューを記録 */
export async function recordPageView(path: string) {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 今日のレコードがあれば更新、なければ作成
  const existing = await db.select().from(pageViews)
    .where(and(eq(pageViews.path, path), eq(pageViews.date, today)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(pageViews)
      .set({ count: existing[0].count + 1 })
      .where(eq(pageViews.id, existing[0].id));
  } else {
    await db.insert(pageViews).values({ path, date: today, count: 1 });
  }
}

/** アナリティクス統計を取得 */
export async function getAnalyticsStats() {
  const db = await getDb();
  if (!db) return { today: 0, yesterday: 0, last7Days: 0, last30Days: 0, dailyStats: [] };
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);
  const last7DaysStartStr = last7DaysStart.toISOString().split('T')[0];
  
  const last30DaysStart = new Date(today);
  last30DaysStart.setDate(last30DaysStart.getDate() - 30);
  const last30DaysStartStr = last30DaysStart.toISOString().split('T')[0];
  
  // 全データを取得
  const allViews = await db.select().from(pageViews).orderBy(desc(pageViews.date));
  
  // 集計
  let todayCount = 0;
  let yesterdayCount = 0;
  let last7DaysCount = 0;
  let last30DaysCount = 0;
  const dailyMap = new Map<string, number>();
  
  for (const view of allViews) {
    if (view.date === todayStr) {
      todayCount += view.count;
    }
    if (view.date === yesterdayStr) {
      yesterdayCount += view.count;
    }
    if (view.date >= last7DaysStartStr) {
      last7DaysCount += view.count;
    }
    if (view.date >= last30DaysStartStr) {
      last30DaysCount += view.count;
    }
    
    // 日別集計（過去14日分）
    const last14DaysStart = new Date(today);
    last14DaysStart.setDate(last14DaysStart.getDate() - 14);
    const last14DaysStartStr = last14DaysStart.toISOString().split('T')[0];
    
    if (view.date >= last14DaysStartStr) {
      dailyMap.set(view.date, (dailyMap.get(view.date) || 0) + view.count);
    }
  }
  
  // 日別データを配列に変換（新しい順）
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
  
  // ページ別集計（過去30日）
  const pageMap = new Map<string, number>();
  for (const view of allViews) {
    if (view.date >= last30DaysStartStr) {
      pageMap.set(view.path, (pageMap.get(view.path) || 0) + view.count);
    }
  }
  
  // ページ別データを配列に変換（多い順）
  const pageStats = Array.from(pageMap.entries())
    .map(([path, count]) => ({
      path,
      label: getPageLabel(path),
      count
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    today: todayCount,
    yesterday: yesterdayCount,
    last7Days: last7DaysCount,
    last30Days: last30DaysCount,
    dailyStats,
    pageStats,
  };
}

// ページパスからラベルを取得
function getPageLabel(path: string): string {
  const labels: Record<string, string> = {
    '/': '在庫一覧',
    '/consignment': '委託在庫一覧',
    '/buy': '買取',
    '/sell': '販売',
    '/about': '会社概要',
    '/legal': '特商法',
  };
  return labels[path] || path;
}

// ========================================
// 最新情報 (NewsItems) クエリヘルパー
// ========================================

/** 公開中の最新情報一覧を取得（表示順でソート） */
export async function getPublishedNewsItems() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(newsItems)
    .where(eq(newsItems.isPublished, true))
    .orderBy(asc(newsItems.displayOrder), desc(newsItems.createdAt));
}

/** 全ての最新情報一覧を取得（管理者用） */
export async function getAllNewsItems() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(newsItems)
    .orderBy(asc(newsItems.displayOrder), desc(newsItems.createdAt));
}

/** 最新情報を1件取得 */
export async function getNewsItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(newsItems).where(eq(newsItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 最新情報を追加 */
export async function createNewsItem(item: InsertNewsItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(newsItems).values(item);
  return result;
}

/** 最新情報を更新 */
export async function updateNewsItem(id: number, data: Partial<InsertNewsItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(newsItems).set(data).where(eq(newsItems.id, id));
}

/** 最新情報を削除 */
export async function deleteNewsItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(newsItems).where(eq(newsItems.id, id));
}

/** 最新情報の表示順序を一括更新 */
export async function reorderNewsItems(items: { id: number; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    await db.update(newsItems)
      .set({ displayOrder: item.displayOrder })
      .where(eq(newsItems.id, item.id));
  }
}


// ========================================
// ビジネス指標 (BusinessMetrics) クエリヘルパー
// ========================================

import { businessMetrics, InsertBusinessMetric } from "../drizzle/schema";

/** 全てのビジネス指標を取得（年度順でソート） */
export async function getAllBusinessMetrics() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(businessMetrics)
    .orderBy(desc(businessMetrics.year));
}

/** 特定年度のビジネス指標を取得 */
export async function getBusinessMetricByYear(year: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(businessMetrics).where(eq(businessMetrics.year, year)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** ビジネス指標を1件取得 */
export async function getBusinessMetricById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(businessMetrics).where(eq(businessMetrics.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** ビジネス指標を追加 */
export async function createBusinessMetric(metric: InsertBusinessMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(businessMetrics).values(metric);
  return result;
}

/** ビジネス指標を更新 */
export async function updateBusinessMetric(id: number, data: Partial<InsertBusinessMetric>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(businessMetrics).set(data).where(eq(businessMetrics.id, id));
}

/** ビジネス指標を削除 */
export async function deleteBusinessMetric(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(businessMetrics).where(eq(businessMetrics.id, id));
}

/** ビジネス指標を年度でupsert（存在すれば更新、なければ作成） */
export async function upsertBusinessMetric(metric: InsertBusinessMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getBusinessMetricByYear(metric.year);
  if (existing) {
    await updateBusinessMetric(existing.id, metric);
    return existing.id;
  } else {
    const result = await createBusinessMetric(metric);
    return result;
  }
}
