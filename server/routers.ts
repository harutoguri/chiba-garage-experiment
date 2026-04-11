import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getPublishedVehicles,
  getPublishedVehiclesWithMedia,
  getFirstPublishedVehicleWithMedia,
  getFirstPublishedVideoHls,
  extractFirstVideoFromList,
  getPublishedConsignmentVehicles,
  getPublishedConsignmentVehiclesWithMedia,
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  reorderVehicles,
  getPublishedPurchaseRecords,
  getAllPurchaseRecords,
  getPurchaseRecordById,
  createPurchaseRecord,
  updatePurchaseRecord,
  deletePurchaseRecord,
  getPublishedSlideshowMedia,
  getAllSlideshowMedia,
  getSlideshowMediaById,
  createSlideshowMedia,
  updateSlideshowMedia,
  deleteSlideshowMedia,
  getVehicleMedia,
  getAllBunnyVideoIds,
  getAllBunnyVideosForThumbnail,
  clearAllBunnyThumbnailUrls,
  getVehicleMediaById,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
  deleteAllVehicleMedia,
  getAllVehicleMediaByIds,
  setMainVehicleMedia,
  reorderVehicleMedia,
  reorderPurchaseRecords,
  reorderSlideshowMedia,
  recordPageView,
  getAnalyticsStats,
  getPublishedNewsItems,
  getAllNewsItems,
  getNewsItemById,
  createNewsItem,
  updateNewsItem,
  deleteNewsItem,
  reorderNewsItems,
  getAllBusinessMetrics,
  getBusinessMetricById,
  createBusinessMetric,
  updateBusinessMetric,
  deleteBusinessMetric,
} from "./db";
import { storagePut, getPresignedUploadUrl, getStorageApiKey } from "./storage";
import { nanoid } from "nanoid";
import {
  createBunnyVideo,
  uploadToBunnyStream,
  getBunnyVideo,
  listBunnyVideos,
  deleteBunnyVideo,
  fetchVideoToBunny,
  checkBunnyVideoStatus,
  setBunnyThumbnailToFirstFrame,
  generateAndUploadThumbnail,
} from "./bunnyStream";
import { getLocalPosts, isGBPConfigured } from "./_core/gbp";
import { optimizeImage } from "./imageOptimizer";
import { triggerProdHtmlRebuild } from "./_core/vite";

// 管理者専用プロシージャ
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '管理者権限が必要です' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ファイルアップロードAPI（管理者のみ）
  upload: router({
    // 署名付きアップロードURLを取得（クライアントから直接アップロード用）
    getUploadUrl: adminProcedure
      .input(z.object({
        fileName: z.string(),
        contentType: z.string(),
        folder: z.enum(["vehicles", "purchase-records", "slideshow"]),
      }))
      .mutation(async ({ input }) => {
        const { fileName, contentType, folder } = input;

        // ユニークなファイル名を生成
        const ext = fileName.split('.').pop() || '';
        const uniqueFileName = `${folder}/${nanoid()}.${ext}`;

        const apiKey = getStorageApiKey();

        // Forge API未設定 → ローカルアップロードURLを返す
        if (!apiKey) {
          return {
            uploadUrl: `/api/local-upload?folder=${folder}&ext=.${ext}`,
            apiKey: "",
            key: uniqueFileName,
            isLocal: true,
          };
        }

        // 署名付きURLを取得
        const { uploadUrl } = await getPresignedUploadUrl(uniqueFileName, contentType);

        return { uploadUrl, apiKey, key: uniqueFileName, isLocal: false };
      }),

    // Base64エンコードされたファイルをアップロード（小さいファイル用）
    file: adminProcedure
      .input(z.object({
        fileName: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
        folder: z.enum(["vehicles", "purchase-records", "slideshow"]),
      }))
      .mutation(async ({ input }) => {
        const { fileName, contentType, base64Data, folder } = input;
        
        // Base64をBufferに変換
        const buffer = Buffer.from(base64Data, 'base64');
        
        // ユニークなファイル名を生成
        const ext = fileName.split('.').pop() || '';
        const uniqueFileName = `${folder}/${nanoid()}.${ext}`;
        
        // S3にアップロード
        const { url } = await storagePut(uniqueFileName, buffer, contentType);
        
        return { url, key: uniqueFileName };
      }),
  }),

  // ★ v38: サーバーサイドキャッシュ — TiDB Cloud RTT 2.8秒を排除
  // データ更新頻度は低い（管理画面で車両追加/編集時のみ）ので60秒キャッシュで十分
  vehicles: (() => {
    const cache: Record<string, { data: any; ts: number }> = {};
    const CACHE_TTL = 300_000; // ★ v93m: 5分キャッシュ（TiDB RTT 2.8s回避）

    function cached<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
      return async () => {
        const now = Date.now();
        if (cache[key] && now - cache[key].ts < CACHE_TTL) {
          return cache[key].data as T;
        }
        const t0 = Date.now();
        const data = await fn();
        const dur = Date.now() - t0;
        console.log(`[Cache] ${key} DB query: ${dur}ms`);
        cache[key] = { data, ts: now };
        return data;
      };
    }

    // ★ v69: キャッシュ連携 — listWithMedia完了時にfirstVideoキャッシュを自動充填
    // firstVideo の INNER JOIN クエリ(~5s) を回避し、listWithMedia の結果から導出
    function populateFirstVideoFromList(listData: any) {
      if (cache['firstVideo'] && Date.now() - cache['firstVideo'].ts < CACHE_TTL) return;
      try {
        const result = extractFirstVideoFromList(listData);
        if (result) {
          cache['firstVideo'] = { data: result, ts: Date.now() };
          console.log(`[Cache] firstVideo auto-populated from listWithMedia: ${result.bunnyVideoId.slice(0, 8)}`);
        }
      } catch (e) {
        console.error('[Cache] firstVideo auto-populate failed:', e);
      }
    }

    // ★ 車両変更時にキャッシュを全クリア + 本番HTML再生成
    function invalidateAllVehicleCache() {
      for (const key of Object.keys(cache)) {
        delete cache[key];
      }
      console.log('[Cache] all vehicle caches invalidated');
      // 本番HTML（車両データ埋め込み）を再生成
      triggerProdHtmlRebuild();
    }

    // listWithMedia をラップしてキャッシュ連携を実行
    const cachedListWithMedia = cached('listWithMedia', getPublishedVehiclesWithMedia);
    const listWithMediaWithPopulate = async () => {
      const data = await cachedListWithMedia();
      populateFirstVideoFromList(data);
      return data;
    };

    return router({
    // 公開車両 + 全メディアを1リクエストで返す
    listWithMedia: publicProcedure.query(listWithMediaWithPopulate),

    // ギャラリー先行表示用: 最初の1台 + メディアを高速返却
    firstWithMedia: publicProcedure.query(cached('firstWithMedia', getFirstPublishedVehicleWithMedia)),

    // 初回動画早期プリロード用: 最初の公開動画の bunnyVideoId のみ返す
    firstVideo: publicProcedure.query(cached('firstVideo', async () => {
      const data = await getPublishedVehiclesWithMedia();
      return extractFirstVideoFromList(data);
    })),

    // 公開中の在庫一覧（通常在庫のみ、誰でもアクセス可能）
    list: publicProcedure.query(async () => {
      return await getPublishedVehicles();
    }),

    // 公開中の委託在庫一覧（委託車両のみ、誰でもアクセス可能）
    listConsignment: publicProcedure.query(async () => {
      return await getPublishedConsignmentVehicles();
    }),

    // 委託車両 + メディアを1リクエストで返す（2段ウォーターフォール解消）
    listConsignmentWithMedia: publicProcedure.query(cached('listConsignmentWithMedia', getPublishedConsignmentVehiclesWithMedia)),

    // 全在庫一覧（管理者のみ）
    listAll: adminProcedure.query(cached('listAll', getAllVehicles)),

    // 在庫詳細
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const vehicle = await getVehicleById(input.id);
        if (!vehicle) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '在庫が見つかりません' });
        }
        return vehicle;
      }),

    // 在庫追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        price: z.number().nullable().optional(),
        priceDisplay: z.string().nullable().optional(),
        videoUrl: z.string().nullable().optional(),
        thumbnailUrl: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["在庫あり", "商談中", "売約済み"]).optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
        isConsignment: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createVehicle(input);
        invalidateAllVehicleCache();
        return { success: true };
      }),

    // 在庫更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        price: z.number().nullable().optional(),
        priceDisplay: z.string().nullable().optional(),
        videoUrl: z.string().nullable().optional(),
        thumbnailUrl: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["在庫あり", "商談中", "売約済み"]).optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
        isConsignment: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateVehicle(id, data);
        invalidateAllVehicleCache();
        return { success: true };
      }),

    // 在庫削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // 関連メディアも削除
        await deleteAllVehicleMedia(input.id);
        await deleteVehicle(input.id);
        invalidateAllVehicleCache();
        return { success: true };
      }),

    // 在庫の表示順序を変更（管理者のみ）
    reorder: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await reorderVehicles(input.items);
        invalidateAllVehicleCache();
        return { success: true };
      }),
  });
  })(),

  // 車両メディアAPI
  vehicleMedia: router({
    // 車両のメディア一覧（誰でもアクセス可能）
    list: publicProcedure
      .input(z.object({ vehicleId: z.number() }))
      .query(async ({ input }) => {
        return await getVehicleMedia(input.vehicleId);
      }),

    // 複数車両のメディアを一括取得（誰でもアクセス可能）
    listBulk: publicProcedure
      .input(z.object({ vehicleIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await getAllVehicleMediaByIds(input.vehicleIds);
      }),

    // メディア詳細
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const media = await getVehicleMediaById(input.id);
        if (!media) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'メディアが見つかりません' });
        }
        return media;
      }),

    // メディア追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        vehicleId: z.number(),
        type: z.enum(["image", "video"]),
        url: z.string().min(1),
        thumbnailUrl: z.string().nullable().optional(),
        bunnyVideoId: z.string().nullable().optional(),
        bunnyStatus: z.enum(["pending", "processing", "ready", "error"]).nullable().optional(),
        previewUrl: z.string().nullable().optional(),
        optimizedUrls: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        isMain: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createVehicleMedia(input);
        return { success: true };
      }),

    // メディア更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        type: z.enum(["image", "video"]).optional(),
        url: z.string().min(1).optional(),
        thumbnailUrl: z.string().nullable().optional(),
        bunnyVideoId: z.string().nullable().optional(),
        bunnyStatus: z.enum(["pending", "processing", "ready", "error"]).nullable().optional(),
        previewUrl: z.string().nullable().optional(),
        optimizedUrls: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        isMain: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateVehicleMedia(id, data);
        return { success: true };
      }),

    // メディア削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteVehicleMedia(input.id);
        return { success: true };
      }),

    // メインメディア設定（管理者のみ）
    setMain: adminProcedure
      .input(z.object({
        vehicleId: z.number(),
        mediaId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await setMainVehicleMedia(input.vehicleId, input.mediaId);
        return { success: true };
      }),

    // 表示順序の一括更新（管理者のみ）
    reorder: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await reorderVehicleMedia(input.items);
        return { success: true };
      }),


  }),

  // 買取実績API
  purchaseRecords: router({
    // 公開中の買取実績一覧（誰でもアクセス可能）
    list: publicProcedure.query(async () => {
      return await getPublishedPurchaseRecords();
    }),

    // 全買取実績一覧（管理者のみ）
    listAll: adminProcedure.query(async () => {
      return await getAllPurchaseRecords();
    }),

    // 買取実績詳細
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const record = await getPurchaseRecordById(input.id);
        if (!record) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '買取実績が見つかりません' });
        }
        return record;
      }),

    // 買取実績追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        vehicleName: z.string().min(1),
        purchasePrice: z.number(),
        priceDisplay: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        purchaseDate: z.date().nullable().optional(),
        comment: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createPurchaseRecord(input);
        return { success: true };
      }),

    // 買取実績更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        vehicleName: z.string().min(1).optional(),
        purchasePrice: z.number().optional(),
        priceDisplay: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        purchaseDate: z.date().nullable().optional(),
        comment: z.string().nullable().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePurchaseRecord(id, data);
        return { success: true };
      }),

    // 買取実績削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePurchaseRecord(input.id);
        return { success: true };
      }),

    // 表示順序の一括更新（管理者のみ）
    reorder: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await reorderPurchaseRecords(input.items);
        return { success: true };
      }),
  }),

  // スライドショーメディアAPI
  slideshowMedia: router({
    // 公開中のスライドショーメディア一覧（誰でもアクセス可能）
    list: publicProcedure.query(async () => {
      return await getPublishedSlideshowMedia();
    }),

    // 全スライドショーメディア一覧（管理者のみ）
    listAll: adminProcedure.query(async () => {
      return await getAllSlideshowMedia();
    }),

    // スライドショーメディア詳細
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const media = await getSlideshowMediaById(input.id);
        if (!media) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'メディアが見つかりません' });
        }
        return media;
      }),

    // スライドショーメディア追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        type: z.enum(["image", "video"]),
        url: z.string().min(1),
        thumbnailUrl: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createSlideshowMedia(input);
        return { success: true };
      }),

    // スライドショーメディア更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        type: z.enum(["image", "video"]).optional(),
        url: z.string().min(1).optional(),
        thumbnailUrl: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSlideshowMedia(id, data);
        return { success: true };
      }),

    // スライドショーメディア削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSlideshowMedia(input.id);
        return { success: true };
      }),

    // 表示順序の一括更新（管理者のみ）
    reorder: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await reorderSlideshowMedia(input.items);
        return { success: true };
      }),
  }),

  // アナリティクスAPI
  analytics: router({
    // ページビューを記録
    recordView: publicProcedure
      .input(z.object({ path: z.string() }))
      .mutation(async ({ input }) => {
        await recordPageView(input.path);
        return { success: true };
      }),
    
    // 統計を取得（管理者のみ）
    getStats: adminProcedure
      .query(async () => {
        return await getAnalyticsStats();
      }),
  }),

  // Bunny Stream API
  bunnyStream: router({
    // 動画を作成（アップロード前の準備）
    createVideo: adminProcedure
      .input(z.object({ title: z.string() }))
      .mutation(async ({ input }) => {
        const video = await createBunnyVideo(input.title);
        return {
          videoId: video.guid,
          libraryId: video.videoLibraryId,
        };
      }),

    // 動画のステータスを確認
    checkStatus: adminProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ input }) => {
        return await checkBunnyVideoStatus(input.videoId);
      }),

    // 動画情報を取得
    getVideo: publicProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ input }) => {
        const video = await getBunnyVideo(input.videoId);
        return {
          videoId: video.guid,
          title: video.title,
          status: video.status,
          encodeProgress: video.encodeProgress,
          isReady: video.status === 4,
          duration: video.length,
          width: video.width,
          height: video.height,
          availableResolutions: video.availableResolutions,
        };
      }),

    // 動画一覧を取得
    listVideos: adminProcedure
      .input(z.object({
        page: z.number().optional().default(1),
        itemsPerPage: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        return await listBunnyVideos(input.page, input.itemsPerPage);
      }),

    // URLから動画をフェッチ（既存のS3動画を移行）
    fetchFromUrl: adminProcedure
      .input(z.object({
        videoUrl: z.string().url(),
        title: z.string(),
      }))
      .mutation(async ({ input }) => {
        const videoId = await fetchVideoToBunny(input.videoUrl, input.title);
        // サムネイルを0秒フレームに設定 → S3にアップロード
        // エンコード完了後に再設定が必要な場合あり（generateThumbnailで対応）
        const thumbnailUrl = await generateAndUploadThumbnail(videoId).catch(() => null);
        return { videoId, thumbnailUrl };
      }),

    // 動画をアップロード（S3 URLからBunny Streamへ）
    uploadVideo: adminProcedure
      .input(z.object({
        sourceUrl: z.string().url(),
        title: z.string(),
      }))
      .mutation(async ({ input }) => {
        const videoId = await fetchVideoToBunny(input.sourceUrl, input.title);
        // サムネイルを0秒フレームに設定 → S3にアップロード
        const thumbnailUrl = await generateAndUploadThumbnail(videoId).catch(() => null);
        return { videoId, thumbnailUrl };
      }),

    // 動画を削除
    deleteVideo: adminProcedure
      .input(z.object({ videoId: z.string() }))
      .mutation(async ({ input }) => {
        await deleteBunnyVideo(input.videoId);
        return { success: true };
      }),

    // HLS URLを生成（クライアント側で使用）
    getHlsUrl: publicProcedure
      .input(z.object({ videoId: z.string() }))
      .query(({ input }) => {
        const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
        return {
          hlsUrl: `https://vz-2e234254-464.b-cdn.net/${input.videoId}/playlist.m3u8`,
          embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${input.videoId}`,
          thumbnailUrl: `https://vz-2e234254-464.b-cdn.net/${input.videoId}/thumbnail.jpg`,
        };
      }),

    // 自前サムネイル生成（Bunny CDNから0秒フレームを取得→S3にアップロード）
    generateThumbnail: adminProcedure
      .input(z.object({ videoId: z.string() }))
      .mutation(async ({ input }) => {
        const thumbnailUrl = await generateAndUploadThumbnail(input.videoId);
        if (!thumbnailUrl) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'サムネイルの生成に失敗しました' });
        }
        return { thumbnailUrl };
      }),

    // 全動画のサムネイルをS3に一括生成・保存
    // 1. Bunny API で0秒フレームに設定
    // 2. thumbnail.jpg をダウンロードして S3 にアップロード
    // 3. DB の thumbnailUrl を更新（以降 CDN 直URL ではなく S3 URL を使用）
    // ※ 全動画を Promise.all で並列処理（シリアルだと18本×8s=144s でタイムアウト）
    fixAllThumbnails: adminProcedure
      .mutation(async () => {
        const videos = await getAllBunnyVideosForThumbnail();
        const results = await Promise.all(
          videos.map(async ({ id, bunnyVideoId }) => {
            const s3Url = await generateAndUploadThumbnail(bunnyVideoId).catch(() => null);
            if (s3Url) {
              await updateVehicleMedia(id, { thumbnailUrl: s3Url }).catch(() => {});
              return true;
            }
            return false;
          })
        );
        const success = results.filter(Boolean).length;
        const failed = results.length - success;
        return { total: videos.length, success, failed };
      }),

    // 全動画のサムネイルをBunny API で先頭フレーム（0秒）に設定
    // S3アップロード・DB更新なし。Bunny CDN の thumbnail.jpg を更新するだけ。
    setAllToFrame0: adminProcedure
      .mutation(async () => {
        const videoIds = await getAllBunnyVideoIds();
        const results = await Promise.all(
          videoIds.map(videoId => setBunnyThumbnailToFirstFrame(videoId).catch(() => false))
        );
        const success = results.filter(Boolean).length;
        const failed = results.length - success;
        return { total: videoIds.length, success, failed };
      }),

    // DB上のサムネイルURLを全てリセット（S3→Bunny CDN直URL に戻す）
    resetAllThumbnailUrls: adminProcedure
      .mutation(async () => {
        await clearAllBunnyThumbnailUrls();
        return { ok: true };
      }),
  }),

  // 最新情報API
  newsItems: router({
    // 公開中の最新情報一覧（誰でもアクセス可能）
    list: publicProcedure.query(async () => {
      return await getPublishedNewsItems();
    }),

    // 全最新情報一覧（管理者のみ）
    listAll: adminProcedure.query(async () => {
      return await getAllNewsItems();
    }),

    // 最新情報詳細
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const item = await getNewsItemById(input.id);
        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '最新情報が見つかりません' });
        }
        return item;
      }),

    // 最新情報追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        url: z.string().url(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createNewsItem(input);
        return { success: true };
      }),

    // 最新情報更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        url: z.string().url().optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateNewsItem(id, data);
        return { success: true };
      }),

    // 最新情報削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNewsItem(input.id);
        return { success: true };
      }),

    // 最新情報の表示順序を変更（管理者のみ）
    reorder: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await reorderNewsItems(input.items);
        return { success: true };
      }),
  }),

  // ビジネス指標API
  businessMetrics: router({
    // 全てのビジネス指標を取得（公開）
    list: publicProcedure.query(async () => {
      return await getAllBusinessMetrics();
    }),

    // ビジネス指標追加（管理者のみ）
    create: adminProcedure
      .input(z.object({
        year: z.number().min(2000).max(2100),
        totalTransactionAmount: z.number().optional(),
        assessmentCount: z.number().optional(),
        contractCount: z.number().optional(),
        isForecast: z.boolean().optional(),
        // 本年のみ使用するフィールド（実績＋着地予想上乗せ分）
        actualAmount: z.number().optional(),
        forecastAmountAdd: z.number().optional(),
        actualAssess: z.number().optional(),
        forecastAssessAdd: z.number().optional(),
        actualContract: z.number().optional(),
        forecastContractAdd: z.number().optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createBusinessMetric(input);
        return { success: true };
      }),

    // ビジネス指標更新（管理者のみ）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        year: z.number().min(2000).max(2100).optional(),
        totalTransactionAmount: z.number().optional(),
        assessmentCount: z.number().optional(),
        contractCount: z.number().optional(),
        isForecast: z.boolean().optional(),
        // 本年のみ使用するフィールド（実績＋着地予想上乗せ分）
        actualAmount: z.number().optional(),
        forecastAmountAdd: z.number().optional(),
        actualAssess: z.number().optional(),
        forecastAssessAdd: z.number().optional(),
        actualContract: z.number().optional(),
        forecastContractAdd: z.number().optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBusinessMetric(id, data);
        return { success: true };
      }),

    // ビジネス指標削除（管理者のみ）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBusinessMetric(input.id);
        return { success: true };
      }),
  }),

  // Google Business Profile API連携
  gbp: router({
    // Googleマイビジネスの最新投稿を取得（誰でもアクセス可能、キャッシュ済み）
    localPosts: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(10).optional().default(5),
      }).optional())
      .query(async ({ input }) => {
        // GBPが設定されていない場合は空配列を返す
        if (!isGBPConfigured()) {
          return { posts: [], configured: false };
        }
        
        try {
          const posts = await getLocalPosts(input?.limit ?? 5);
          return { posts, configured: true };
        } catch (error) {
          console.error("Error fetching GBP posts:", error);
          return { posts: [], configured: true, error: true };
        }
      }),

    // GBPが設定されているかチェック
    isConfigured: publicProcedure.query(() => {
      return { configured: isGBPConfigured() };
    }),
  }),

  // 画像最適化API
  imageOptimize: router({
    // 画像を最適化（WebP変換・複数サイズ生成）
    optimize: adminProcedure
      .input(z.object({
        mediaId: z.number(),
        imageUrl: z.string().url(),
        vehicleId: z.number(),
        filename: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 画像をダウンロード
          const response = await fetch(input.imageUrl);
          if (!response.ok) throw new Error(`画像の取得に失敗: ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          
          // 最適化実行
          const result = await optimizeImage(buffer, input.filename, input.vehicleId);
          
          // DBのメディアレコードを更新
          await updateVehicleMedia(input.mediaId, {
            optimizedUrls: JSON.stringify(result),
          });
          
          return { success: true, optimizedUrls: result };
        } catch (error) {
          console.error('Image optimization failed:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `画像最適化に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
