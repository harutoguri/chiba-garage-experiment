/**
 * サムネイル再生成スクリプト v10.27
 * 
 * Bunny CDNからthumbnail.jpg（0秒フレーム）をダウンロードし、
 * 一切の加工なしでS3にアップロード、DB更新する。
 * 
 * 禁止事項: リサイズ・クロップ・レターボックス・ぼかし・合成
 */

import mysql from 'mysql2/promise';

const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY!;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;
const BUNNY_API_BASE = 'https://video.bunnycdn.com';
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL!;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY!;

interface VideoRow {
  id: number;
  bunnyVideoId: string;
  thumbnailUrl: string | null;
}

/**
 * Bunny Set Thumbnail APIで0秒フレームに設定
 */
async function setBunnyThumbnailToFirstFrame(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_STREAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thumbnailTime: 0 }),
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Bunny CDNからthumbnail.jpgをダウンロード（無加工）
 */
async function downloadThumbnail(videoId: string): Promise<Buffer | null> {
  const thumbnailUrl = `https://vz-2e234254-464.b-cdn.net/${videoId}/thumbnail.jpg`;
  const response = await fetch(thumbnailUrl, {
    headers: {
      'Referer': 'https://iframe.mediadelivery.net/',
    },
  });
  if (!response.ok) {
    console.error(`  [ERROR] Download failed: ${response.status}`);
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * S3にアップロード（storagePut相当）
 */
async function uploadToS3(fileKey: string, data: Buffer, contentType: string): Promise<string> {
  const baseUrl = FORGE_API_URL.replace(/\/+$/, '');
  const url = new URL('v1/storage/upload', baseUrl + '/');
  url.searchParams.set('path', fileKey);
  
  const blob = new Blob([data], { type: contentType });
  const form = new FormData();
  form.append('file', blob, fileKey.split('/').pop() || 'file');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FORGE_API_KEY}` },
    body: form,
  });
  
  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`S3 upload failed: ${response.status} ${msg}`);
  }
  
  const result = await response.json();
  return result.url;
}

async function main() {
  console.log('=== サムネイル再生成 v10.27 (無加工0秒フレーム) ===\n');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // 全動画を取得
  const [rows] = await connection.execute(
    "SELECT id, bunnyVideoId, thumbnailUrl FROM vehicle_media WHERE type = 'video' AND bunnyVideoId IS NOT NULL ORDER BY id"
  );
  const videos = rows as VideoRow[];
  console.log(`対象動画: ${videos.length}本\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const video of videos) {
    console.log(`[${video.id}] bunnyVideoId=${video.bunnyVideoId}`);
    
    try {
      // 1. Bunny Set Thumbnail APIで0秒フレームに設定
      console.log('  1. Setting thumbnail to 0s frame...');
      await setBunnyThumbnailToFirstFrame(video.bunnyVideoId);
      
      // 2. 待機（Bunnyがサムネイルを生成するのに時間がかかる）
      console.log('  2. Waiting 3s for Bunny to generate...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 3. Bunny CDNからthumbnail.jpgをダウンロード（無加工）
      console.log('  3. Downloading thumbnail from Bunny CDN...');
      const buffer = await downloadThumbnail(video.bunnyVideoId);
      if (!buffer) {
        console.log('  [SKIP] Download failed');
        failCount++;
        continue;
      }
      console.log(`  Downloaded: ${buffer.length} bytes`);
      
      // 4. S3にそのままアップロード（加工なし）
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `thumbnails/${video.bunnyVideoId}-simple-${randomSuffix}.jpg`;
      console.log(`  4. Uploading to S3: ${fileKey}`);
      const s3Url = await uploadToS3(fileKey, buffer, 'image/jpeg');
      console.log(`  S3 URL: ${s3Url}`);
      
      // 5. DB更新
      console.log('  5. Updating DB...');
      await connection.execute(
        "UPDATE vehicle_media SET thumbnailUrl = ? WHERE id = ?",
        [s3Url, video.id]
      );
      
      console.log(`  [OK] Done\n`);
      successCount++;
    } catch (error: any) {
      console.error(`  [ERROR] ${error.message}\n`);
      failCount++;
    }
  }
  
  console.log(`\n=== 完了 ===`);
  console.log(`成功: ${successCount}, 失敗: ${failCount}`);
  
  await connection.end();
}

main().catch(console.error);
