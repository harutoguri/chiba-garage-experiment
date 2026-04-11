/**
 * tiktok-thumbnails.mjs  v16 — AVIF HDR出力（HLG色空間保持）+ JPEG fallback
 *
 * v16 の変更点 (v15 → v16):
 *   - JPEG SDR → AVIF HDR に完全移行
 *   - HLG動画: ffmpeg libaom-av1でAVIF出力、bt2020/arib-std-b67色空間保持
 *   - bt709動画: AVIF出力（色空間そのまま）
 *   - JPEG fallback: AVIF非対応ブラウザ用に従来JPEGも同時生成
 *   - sharp resize廃止 → ffmpeg内でscale（色空間保持のため）
 *
 * JPEG(SDR)ではHLG動画の色を物理的に再現不可能だった。
 * AVIF(10bit, bt2020, HLG)なら動画frame 0と完全一致。
 * iOS Safari 16+, Chrome 100+ でAVIF対応済み。
 *
 * 使用方法: node scripts/tiktok-thumbnails.mjs
 */

import sharp from 'sharp';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const THUMBS_DIR = path.join(ROOT, 'local-storage', 'thumbnails');

const DATABASE_URL = process.env.DATABASE_URL
  || 'mysql://33CD7BKpshztP9D.root:G8i7MWROfxFStFF4b671@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/4WnCpiyyV5zEiwX2YFQ52L?ssl={"rejectUnauthorized":true}';
const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY || 'c221bd3a-aee6-4dc4-9ea987b17ee0-54c4-4603';
const BUNNY_LIB_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '584611';
const CDN_BASE = 'https://vz-2e234254-464.b-cdn.net';
const BUNNY_API = 'https://video.bunnycdn.com';

const TARGET_W = 1080;
const TARGET_H = 1920;
const THUMB_VERSION = 'v31';

function parseDbUrl(url) {
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

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://iframe.mediadelivery.net/',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

/**
 * ffprobe でカラースペース検出
 */
function detectColorSpaceFromFile(tsFilePath) {
  try {
    const result = execFileSync('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'stream=color_transfer',
      tsFilePath,
    ], { stdio: 'pipe', timeout: 10000 });
    const output = result.toString();
    if (output.includes('arib-std-b67')) return 'hlg';
    if (output.includes('bt709')) return 'bt709';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * v16: AVIF HDR出力 — HLG色空間完全保持
 *
 * JPEG(SDR)ではHLG動画の色を物理的に再現不可能。
 * AVIF(10bit, bt2020, arib-std-b67)なら動画frame 0と色が完全一致。
 *
 * HLG動画: AVIF + bt2020/HLG色空間フラグ保持
 * bt709動画: AVIF（色空間そのまま）
 * 両方: JPEG fallbackも同時生成（AVIF非対応ブラウザ用）
 */
async function extractFirstFrame(videoId) {
  const segUrl = `${CDN_BASE}/${videoId}/720p/video0.ts`;
  console.log(`    download: 720p/video0.ts ...`);

  let segBuffer;
  try {
    segBuffer = await downloadBuffer(segUrl);
  } catch (e) {
    console.log(`    720p failed (${e.message}), trying 480p...`);
    const fallbackUrl = `${CDN_BASE}/${videoId}/480p/video0.ts`;
    segBuffer = await downloadBuffer(fallbackUrl);
  }

  console.log(`    segment:  ${(segBuffer.length / 1024).toFixed(0)} KB`);

  const tmpTs = path.join(os.tmpdir(), `${THUMB_VERSION}_seg_${videoId}.ts`);
  const tmpAvif = path.join(os.tmpdir(), `${THUMB_VERSION}_frame_${videoId}.avif`);
  const tmpJpg = path.join(os.tmpdir(), `${THUMB_VERSION}_frame_${videoId}.jpg`);
  fs.writeFileSync(tmpTs, segBuffer);

  // カラースペース検出
  const colorSpace = detectColorSpaceFromFile(tmpTs);
  const isHlg = colorSpace === 'hlg';

  // SAR補正 + 9:16クロップ（cover相当）
  const vf = 'scale=trunc(iw*sar/2)*2:ih,crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)';

  // ===== AVIF出力（メイン） =====
  if (isHlg) {
    console.log(`    color:    HLG → AVIF(bt2020/HLG) 10bit HDR保持`);
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', tmpTs,
        '-vf', vf,
        '-frames:v', '1',
        '-c:v', 'libaom-av1',
        '-pix_fmt', 'yuv420p10le',
        '-color_primaries', 'bt2020',
        '-color_trc', 'arib-std-b67',
        '-colorspace', 'bt2020nc',
        '-still-picture', '1',
        '-cpu-used', '4',
        tmpAvif,
      ], { stdio: 'pipe', timeout: 30000 });
    } catch (e) {
      throw new Error(`ffmpeg AVIF(HLG) failed: ${e.stderr?.toString().slice(-300) || e.message}`);
    }
  } else {
    console.log(`    color:    ${colorSpace} → AVIF(bt709)`);
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', tmpTs,
        '-vf', vf,
        '-frames:v', '1',
        '-c:v', 'libaom-av1',
        '-pix_fmt', 'yuv420p10le',
        '-still-picture', '1',
        '-cpu-used', '4',
        tmpAvif,
      ], { stdio: 'pipe', timeout: 30000 });
    } catch (e) {
      throw new Error(`ffmpeg AVIF failed: ${e.stderr?.toString().slice(-300) || e.message}`);
    }
  }

  // ===== JPEG fallback出力 =====
  try {
    execFileSync('ffmpeg', [
      '-y', '-i', tmpTs,
      '-vf', vf,
      '-frames:v', '1',
      '-update', '1',
      '-q:v', '2',
      tmpJpg,
    ], { stdio: 'pipe', timeout: 15000 });
  } catch {
    // JPEG fallback失敗は致命的ではない
    console.log(`    warn:     JPEG fallback failed`);
  }

  const avifBuf = fs.readFileSync(tmpAvif);
  const jpegBuf = fs.existsSync(tmpJpg) ? fs.readFileSync(tmpJpg) : null;

  // ffprobeでAVIFの解像度取得
  let avifWidth = 0, avifHeight = 0;
  try {
    const probeResult = execFileSync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'stream=width,height',
      '-of', 'json', tmpAvif,
    ], { stdio: 'pipe', timeout: 5000 });
    const probe = JSON.parse(probeResult.toString());
    avifWidth = probe.streams?.[0]?.width || 0;
    avifHeight = probe.streams?.[0]?.height || 0;
  } catch {}

  // ソース解像度（SAR補正前）
  let srcWidth = 0, srcHeight = 0;
  try {
    const probeResult = execFileSync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'stream=width,height',
      '-of', 'json', tmpTs,
    ], { stdio: 'pipe', timeout: 5000 });
    const probe = JSON.parse(probeResult.toString());
    srcWidth = probe.streams?.[0]?.width || 0;
    srcHeight = probe.streams?.[0]?.height || 0;
  } catch {}

  try { fs.unlinkSync(tmpTs); } catch {}
  try { fs.unlinkSync(tmpAvif); } catch {}
  try { fs.unlinkSync(tmpJpg); } catch {}

  console.log(`    frame:    ${avifWidth}x${avifHeight} AVIF(${(avifBuf.length/1024).toFixed(0)}KB) ${jpegBuf ? `+ JPEG(${(jpegBuf.length/1024).toFixed(0)}KB)` : ''}`);

  return {
    avifBuffer: avifBuf,
    jpegBuffer: jpegBuf,
    width: avifWidth,
    height: avifHeight,
    srcWidth,
    srcHeight,
    isHlg,
  };
}

async function main() {
  const newOnly = process.argv.includes('--new');
  const forceId = process.argv.find(a => a.startsWith('--id='))?.split('=')[1];

  console.log(`=== TikTok Thumbnail Generator v16 (AVIF HDR / HLG色空間保持) ===`);
  console.log(`mode: ${forceId ? `single (${forceId})` : newOnly ? 'new only (--new)' : 'all'}\n`);

  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const dbConfig = parseDbUrl(DATABASE_URL);
  const conn = await mysql.createConnection(dbConfig);
  console.log('DB connected\n');

  try {
    await conn.execute(
      'ALTER TABLE vehicle_media ADD COLUMN IF NOT EXISTS thumb_ts FLOAT DEFAULT NULL'
    );
  } catch (e) {
    if (!e.message?.includes('Duplicate column')) {
      console.warn(`  thumb_ts column: ${e.message}`);
    }
  }

  let query = 'SELECT id, bunnyVideoId, thumbnailUrl FROM vehicle_media WHERE bunnyVideoId IS NOT NULL AND bunnyVideoId != ""';
  const params = [];
  if (forceId) {
    query += ' AND bunnyVideoId = ?';
    params.push(forceId);
  }
  const [rows] = await conn.execute(query, params);

  const targets = newOnly
    ? rows.filter(r => !r.thumbnailUrl || !r.thumbnailUrl.includes(`${THUMB_VERSION}-`))
    : rows;

  console.log(`target: ${targets.length} / ${rows.length} total${newOnly ? ' (new only)' : ''}\n`);

  if (targets.length === 0) {
    console.log(newOnly ? 'No new videos.' : 'No videos found.');
    await conn.end();
    return;
  }

  let success = 0;
  let failed = 0;
  let hlgCount = 0;

  for (const row of targets) {
    const { id, bunnyVideoId: videoId } = row;
    console.log(`\n[${success + failed + 1}/${targets.length}] ${videoId.slice(0, 8)}..`);
    try {
      const { avifBuffer, jpegBuffer, width, height, srcWidth, srcHeight, isHlg } = await extractFirstFrame(videoId);
      if (isHlg) hlgCount++;

      // AVIF（メイン）
      const avifName = `${THUMB_VERSION}-${videoId}-thumb.avif`;
      const avifPath = path.join(THUMBS_DIR, avifName);
      fs.writeFileSync(avifPath, avifBuffer);
      const avifUrl = `/local-storage/thumbnails/${avifName}`;

      // JPEG fallback
      let jpegUrl = null;
      if (jpegBuffer) {
        const jpegName = `${THUMB_VERSION}-${videoId}-thumb.jpg`;
        const jpegPath = path.join(THUMBS_DIR, jpegName);
        fs.writeFileSync(jpegPath, jpegBuffer);
        jpegUrl = `/local-storage/thumbnails/${jpegName}`;
      }

      // DB: thumbnailUrl = AVIF（クライアントが<picture>でfallback）
      await conn.execute(
        'UPDATE vehicle_media SET thumbnailUrl = ?, thumb_ts = 0 WHERE id = ?',
        [avifUrl, id]
      );

      const srcOrient = srcWidth < srcHeight ? 'portrait' : srcWidth > srcHeight ? 'landscape' : 'square';
      console.log(`    output:   ${width}x${height} | src=${srcWidth}x${srcHeight}(${srcOrient})`);
      console.log(`    ${isHlg ? 'HLG→AVIF(HDR)' : 'bt709→AVIF'} | ${avifUrl}${jpegUrl ? ` + ${jpegUrl}` : ''}`);
      success++;
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      failed++;
    }
  }

  await conn.end();
  console.log(`\n=== Done ===`);
  console.log(`  Success: ${success}  Failed: ${failed}`);
  console.log(`  HLG→AVIF(HDR): ${hlgCount}  bt709→AVIF: ${success - hlgCount}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
