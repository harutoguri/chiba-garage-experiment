/**
 * convert-heic.mjs  v2
 *
 * 既存の HEIC 画像を JPEG に一括変換するバッチスクリプト
 *
 * v2: sharp の libheif が未対応のため、macOS の `sips` コマンドで変換
 *
 * 処理:
 *   1. DB から vehicle_media の HEIC URL を全件取得
 *   2. CloudFront から HEIC をダウンロード → 一時ファイルに保存
 *   3. sips -s format jpeg で JPEG に変換
 *   4. local-storage/vehicles/ に保存
 *   5. DB の url を /local-storage/... に更新
 *
 * 実行: node scripts/convert-heic.mjs
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'local-storage', 'vehicles');
const TMP_DIR = path.join(os.tmpdir(), 'heic-convert');

const DATABASE_URL = process.env.DATABASE_URL
  || 'mysql://33CD7BKpshztP9D.root:G8i7MWROfxFStFF4b671@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/4WnCpiyyV5zEiwX2YFQ52L?ssl={"rejectUnauthorized":true}';

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

async function downloadToFile(url, filePath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return buf;
}

function convertHeicToJpeg(inputPath, outputPath) {
  // macOS sips: ネイティブHEIC対応
  execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '90',  // quality 90%
    inputPath,
    '--out', outputPath,
  ], { stdio: 'pipe' });
}

async function main() {
  console.log('=== HEIC → JPEG 一括変換スクリプト (v2: sips) ===\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const conn = await mysql.createConnection(parseDbUrl(DATABASE_URL));
  console.log('✓ DB connected\n');

  // HEIC ファイルを全件取得
  const [rows] = await conn.execute(
    `SELECT id, vehicleId, url FROM vehicle_media
     WHERE url LIKE '%.HEIC' OR url LIKE '%.heic'
     ORDER BY vehicleId, displayOrder`
  );
  console.log(`Found ${rows.length} HEIC files\n`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const { id, vehicleId, url } = row;
    const originalName = url.split('/').pop() || `media_${id}`;
    const baseName = originalName.replace(/\.[^.]+$/, '');
    console.log(`[${success + failed + 1}/${rows.length}] vehicleId=${vehicleId} id=${id} ${originalName}`);

    const tmpHeic = path.join(TMP_DIR, `${id}.heic`);
    const tmpJpeg = path.join(TMP_DIR, `${id}.jpg`);

    try {
      // CloudFront からダウンロード
      const heicBuf = await downloadToFile(url, tmpHeic);
      console.log(`  Downloaded: ${(heicBuf.length / 1024).toFixed(0)} KB`);

      // sips で JPEG 変換
      convertHeicToJpeg(tmpHeic, tmpJpeg);

      const jpegBuf = fs.readFileSync(tmpJpeg);
      console.log(`  Converted: ${(jpegBuf.length / 1024).toFixed(0)} KB JPEG`);

      // ファイル名: <baseName>-<hash8>.jpg
      const hash = crypto.createHash('md5').update(heicBuf).digest('hex').slice(0, 8);
      const fileName = `${baseName}-${hash}.jpg`;
      const filePath = path.join(OUT_DIR, fileName);
      fs.copyFileSync(tmpJpeg, filePath);

      // local-storage URL
      const localUrl = `/local-storage/vehicles/${fileName}`;

      // DB 更新
      await conn.execute(
        'UPDATE vehicle_media SET url = ? WHERE id = ?',
        [localUrl, id]
      );
      console.log(`  ✓ Saved → ${localUrl}`);
      success++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      failed++;
    } finally {
      // 一時ファイル削除
      try { fs.unlinkSync(tmpHeic); } catch {}
      try { fs.unlinkSync(tmpJpeg); } catch {}
    }
  }

  await conn.end();

  // TMP_DIR cleanup
  try { fs.rmdirSync(TMP_DIR); } catch {}

  console.log(`\n=== Done === Success: ${success}  Failed: ${failed}`);
  if (success > 0) {
    console.log('\n→ DB の vehicle_media.url を /local-storage/vehicles/*.jpg に更新しました。');
    console.log('→ ブラウザをリロードして確認してください。');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
