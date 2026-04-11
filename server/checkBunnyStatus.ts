/**
 * Bunny Streamのエンコード状態を確認・更新するスクリプト
 * 
 * 使い方: npx tsx server/checkBunnyStatus.ts
 * 
 * 処理:
 * 1. bunnyStatus='processing'の動画を全取得
 * 2. Bunny APIでエンコード状態を確認
 * 3. 完了した動画のbunnyStatusを'ready'に更新
 */

import 'dotenv/config';
import { checkBunnyVideoStatus } from './bunnyStream';

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { vehicleMedia } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  // bunnyStatus='processing'の動画を全取得
  const processingVideos = await db
    .select()
    .from(vehicleMedia)
    .where(
      and(
        eq(vehicleMedia.type, 'video'),
        eq(vehicleMedia.bunnyStatus, 'processing')
      )
    );

  console.log(`Found ${processingVideos.length} videos in 'processing' state`);

  if (processingVideos.length === 0) {
    // errorの動画も表示
    const errorVideos = await db
      .select()
      .from(vehicleMedia)
      .where(
        and(
          eq(vehicleMedia.type, 'video'),
          eq(vehicleMedia.bunnyStatus, 'error')
        )
      );

    if (errorVideos.length > 0) {
      console.log(`\n${errorVideos.length} videos in 'error' state:`);
      for (const video of errorVideos) {
        console.log(`  media id=${video.id}, vehicleId=${video.vehicleId}, bunnyVideoId=${video.bunnyVideoId || 'null'}`);
      }
      console.log('\nTo retry these, run: npx tsx server/migrateToBunny.ts');
    }

    // readyの動画も表示
    const readyVideos = await db
      .select()
      .from(vehicleMedia)
      .where(
        and(
          eq(vehicleMedia.type, 'video'),
          eq(vehicleMedia.bunnyStatus, 'ready')
        )
      );

    if (readyVideos.length > 0) {
      console.log(`\n${readyVideos.length} videos in 'ready' state (migration complete)`);
    }

    await connection.end();
    return;
  }

  let readyCount = 0;
  let stillProcessing = 0;
  let errorCount = 0;

  for (const video of processingVideos) {
    if (!video.bunnyVideoId) {
      console.log(`  media id=${video.id}: no bunnyVideoId, skipping`);
      continue;
    }

    try {
      const status = await checkBunnyVideoStatus(video.bunnyVideoId);
      const statusLabel = ['created', 'uploaded', 'processing', 'transcoding', 'finished', 'error'][status.status] || `unknown(${status.status})`;
      
      console.log(`  media id=${video.id}: ${statusLabel}, progress=${status.encodeProgress}%, ready=${status.isReady}`);

      if (status.isReady) {
        await db.update(vehicleMedia)
          .set({
            bunnyStatus: 'ready',
            bunnyEncodeProgress: 100,
          })
          .where(eq(vehicleMedia.id, video.id));
        readyCount++;
      } else if (status.status === 5) {
        // error
        await db.update(vehicleMedia)
          .set({
            bunnyStatus: 'error',
            bunnyEncodeProgress: status.encodeProgress,
          })
          .where(eq(vehicleMedia.id, video.id));
        errorCount++;
      } else {
        await db.update(vehicleMedia)
          .set({
            bunnyEncodeProgress: status.encodeProgress,
          })
          .where(eq(vehicleMedia.id, video.id));
        stillProcessing++;
      }
    } catch (error: any) {
      console.log(`  media id=${video.id}: status check failed: ${error.message}`);
      errorCount++;
    }

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n=== Status Check Complete ===`);
  console.log(`Ready: ${readyCount}`);
  console.log(`Still processing: ${stillProcessing}`);
  console.log(`Errors: ${errorCount}`);

  if (stillProcessing > 0) {
    console.log(`\nRun this script again in a few minutes to check progress.`);
  }

  await connection.end();
  console.log('\nDone.');
}

main().catch(console.error);
