/**
 * 全動画をBunny Streamに一括移行するスクリプト
 * 
 * 使い方: npx tsx server/migrateToBunny.ts
 * 
 * 処理:
 * 1. vehicle_mediaテーブルからbunnyVideoId=nullの動画を全取得
 * 2. 各動画のCloudFront URLをBunny StreamのfetchFromUrl APIで移行
 * 3. DBのbunnyVideoIdとbunnyStatusを更新
 */

import 'dotenv/config';
import { fetchVideoToBunny, checkBunnyVideoStatus } from './bunnyStream';

// DB接続（drizzle使用）
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { vehicleMedia } from '../drizzle/schema';
import { eq, isNull, and } from 'drizzle-orm';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  // bunnyVideoIdがnullの動画を全取得
  const pendingVideos = await db
    .select()
    .from(vehicleMedia)
    .where(
      and(
        eq(vehicleMedia.type, 'video'),
        isNull(vehicleMedia.bunnyVideoId)
      )
    );

  console.log(`Found ${pendingVideos.length} videos without bunnyVideoId`);

  if (pendingVideos.length === 0) {
    console.log('All videos already have bunnyVideoId. Nothing to do.');
    await connection.end();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const video of pendingVideos) {
    const title = `vehicle-${video.vehicleId}-media-${video.id}`;
    console.log(`\n--- Processing media id=${video.id} vehicleId=${video.vehicleId} ---`);
    console.log(`  URL: ${video.url.substring(0, 100)}...`);

    try {
      // Bunny StreamにURLからフェッチ
      console.log(`  Fetching to Bunny Stream...`);
      const bunnyVideoId = await fetchVideoToBunny(video.url, title);
      console.log(`  Created bunnyVideoId: ${bunnyVideoId}`);

      // DBを更新
      await db.update(vehicleMedia)
        .set({
          bunnyVideoId: bunnyVideoId,
          bunnyStatus: 'processing',
          bunnyEncodeProgress: 0,
        })
        .where(eq(vehicleMedia.id, video.id));

      console.log(`  DB updated: bunnyVideoId=${bunnyVideoId}, bunnyStatus=processing`);
      successCount++;

      // レート制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`  ERROR: ${error.message}`);
      errorCount++;
      
      // エラーでも続行
      await db.update(vehicleMedia)
        .set({
          bunnyStatus: 'error',
        })
        .where(eq(vehicleMedia.id, video.id));
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${pendingVideos.length}`);

  // エンコード状態の確認（5秒後）
  if (successCount > 0) {
    console.log(`\nWaiting 5 seconds before checking encode status...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const updatedVideos = await db
      .select()
      .from(vehicleMedia)
      .where(
        and(
          eq(vehicleMedia.type, 'video'),
          eq(vehicleMedia.bunnyStatus, 'processing')
        )
      );

    for (const video of updatedVideos) {
      if (!video.bunnyVideoId) continue;
      try {
        const status = await checkBunnyVideoStatus(video.bunnyVideoId);
        console.log(`  media id=${video.id}: status=${status.status}, progress=${status.encodeProgress}%, ready=${status.isReady}`);
        
        if (status.isReady) {
          await db.update(vehicleMedia)
            .set({
              bunnyStatus: 'ready',
              bunnyEncodeProgress: 100,
            })
            .where(eq(vehicleMedia.id, video.id));
        } else {
          await db.update(vehicleMedia)
            .set({
              bunnyEncodeProgress: status.encodeProgress,
            })
            .where(eq(vehicleMedia.id, video.id));
        }
      } catch (error: any) {
        console.log(`  media id=${video.id}: status check failed: ${error.message}`);
      }
    }
  }

  await connection.end();
  console.log('\nDone.');
}

main().catch(console.error);
