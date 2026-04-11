/**
 * 全動画のサムネイルを0秒フレームに再生成してDBを更新するスクリプト
 *
 * 使用方法: node scripts/regen-thumbnails-frame0.mjs
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── 設定 ──────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL
  || 'mysql://33CD7BKpshztP9D.root:G8i7MWROfxFStFF4b671@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/4WnCpiyyV5zEiwX2YFQ52L?ssl={"rejectUnauthorized":true}';
const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY || 'c221bd3a-aee6-4dc4-9ea987b17ee0-54c4-4603';
const BUNNY_LIB_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '584611';
const CDN_BASE = 'https://vz-2e234254-464.b-cdn.net';
const BUNNY_API = 'https://video.bunnycdn.com';
const LOCAL_STORAGE_DIR = path.join(ROOT, 'local-storage', 'thumbnails');

// ── DB接続 ────────────────────────────────────────
function parseDbUrl(url) {
  // mysql://user:pass@host:port/db?ssl=...
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('Invalid DATABASE_URL: ' + url);
  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
    ssl: { rejectUnauthorized: true },
  };
}

// ── Bunny API ─────────────────────────────────────

async function setBunnyThumbnailToFirstFrame(videoId) {
  const res = await fetch(`${BUNNY_API}/library/${BUNNY_LIB_ID}/videos/${videoId}`, {
    method: 'POST',
    headers: {
      'AccessKey': BUNNY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ thumbnailTime: 0 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`  [setFrame0] FAILED HTTP ${res.status} for ${videoId}: ${body}`);
    return false;
  }
  return true;
}

async function getBunnyVideoInfo(videoId) {
  const res = await fetch(`${BUNNY_API}/library/${BUNNY_LIB_ID}/videos/${videoId}`, {
    headers: { 'AccessKey': BUNNY_API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`getBunnyVideo failed: ${res.status}`);
  return res.json();
}

// ── サムネイルダウンロード → local-storage保存 ────

async function downloadThumbnail(videoId, thumbFileName) {
  const url = `${CDN_BASE}/${videoId}/${thumbFileName}`;
  const res = await fetch(url, { headers: { 'Referer': 'https://iframe.mediadelivery.net/' } });
  if (!res.ok) {
    // fallback: thumbnail.jpg
    if (thumbFileName !== 'thumbnail.jpg') {
      const fallback = `${CDN_BASE}/${videoId}/thumbnail.jpg`;
      const res2 = await fetch(fallback, { headers: { 'Referer': 'https://iframe.mediadelivery.net/' } });
      if (res2.ok) return Buffer.from(await res2.arrayBuffer());
    }
    throw new Error(`CDN download failed: ${res.status} url=${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── メイン ────────────────────────────────────────

async function main() {
  console.log('=== Thumbnail Frame-0 Regeneration Script ===\n');

  // local-storageディレクトリ作成
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });

  // DB接続
  const dbConfig = parseDbUrl(DATABASE_URL);
  const conn = await mysql.createConnection(dbConfig);
  console.log('✓ DB connected\n');

  // Step 1: 全Bunny動画IDを取得
  const [rows] = await conn.execute(
    'SELECT id, bunnyVideoId FROM vehicle_media WHERE bunnyVideoId IS NOT NULL AND bunnyVideoId != ""'
  );
  console.log(`Found ${rows.length} videos with bunnyVideoId\n`);

  if (rows.length === 0) {
    console.log('No videos found. Exiting.');
    await conn.end();
    return;
  }

  // Step 2: 全動画に setThumbnailToFirstFrame を並列実行
  console.log('Step 1: Setting all thumbnails to frame 0 (parallel)...');
  await Promise.all(rows.map(async (row) => {
    const ok = await setBunnyThumbnailToFirstFrame(row.bunnyVideoId).catch(() => false);
    console.log(`  ${ok ? '✓' : '✗'} setFrame0: ${row.bunnyVideoId}`);
  }));

  // Step 3: Bunnyがサムネイルを再生成するのを待つ（6秒）
  console.log('\nStep 2: Waiting 6s for Bunny to process thumbnails...');
  await new Promise(r => setTimeout(r, 6000));

  // Step 4: 各動画のthumbnailFileNameを取得 → ダウンロード → 保存 → DB更新
  console.log('\nStep 3: Downloading thumbnails and updating DB...');
  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const { id, bunnyVideoId: videoId } = row;
    try {
      // Bunny APIからthumbnailFileNameを取得
      const info = await getBunnyVideoInfo(videoId);
      const thumbFile = info.thumbnailFileName || 'thumbnail.jpg';
      console.log(`  [${videoId}] thumbnailFileName: ${thumbFile}`);

      // ダウンロード
      const buffer = await downloadThumbnail(videoId, thumbFile);

      // local-storageに保存
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileName = `${videoId}-frame0-${suffix}.jpg`;
      const filePath = path.join(LOCAL_STORAGE_DIR, fileName);
      fs.writeFileSync(filePath, buffer);

      const localUrl = `/local-storage/thumbnails/${fileName}`;

      // DB更新
      await conn.execute(
        'UPDATE vehicle_media SET thumbnailUrl = ? WHERE id = ?',
        [localUrl, id]
      );

      console.log(`  ✓ Saved: ${localUrl} (${buffer.length} bytes)`);
      success++;
    } catch (err) {
      console.error(`  ✗ FAILED for ${videoId}:`, err.message);
      failed++;
    }
  }

  await conn.end();

  console.log(`\n=== Done ===`);
  console.log(`Total: ${rows.length}, Success: ${success}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
