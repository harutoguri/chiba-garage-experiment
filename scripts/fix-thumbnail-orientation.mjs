/**
 * サムネイル向き修正スクリプト
 *
 * Bunnyの setBunnyThumbnailToFirstFrame 後に横向き(640×360)や正方形(640×640)で
 * 生成されたサムネイルを、縦向き(360×640)に回転してから再保存する。
 *
 * 【なぜ回転が必要か】
 * iPhoneで縦向き撮影した動画は「横向きで保存+回転メタデータ」として格納される場合がある。
 * HLSプレイヤーは回転メタデータを解釈して縦向き表示するが、
 * Bunnyが生成するサムネイル画像は回転を適用せず横向きになってしまう。
 * → サムネイル画像自体を90°回転して縦向きにする必要がある。
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const THUMBS_DIR = path.join(ROOT, 'local-storage', 'thumbnails');

const DB_CONFIG = {
  user: '33CD7BKpshztP9D.root',
  password: 'G8i7MWROfxFStFF4b671',
  host: 'gateway03.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  database: '4WnCpiyyV5zEiwX2YFQ52L',
  ssl: { rejectUnauthorized: true },
};

async function main() {
  console.log('=== Thumbnail Orientation Fix ===\n');

  // DB接続して現在のthumbnailUrlを取得
  const conn = await mysql.createConnection(DB_CONFIG);
  const [rows] = await conn.execute(
    "SELECT id, bunnyVideoId, thumbnailUrl FROM vehicle_media WHERE thumbnailUrl LIKE '/local-storage/thumbnails/%'"
  );
  console.log(`Found ${rows.length} thumbnails to check\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const { id, bunnyVideoId, thumbnailUrl } = row;
    // /local-storage/thumbnails/xxx.jpg → ローカルファイルパス
    const fileName = path.basename(thumbnailUrl);
    const filePath = path.join(THUMBS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ File not found: ${fileName}`);
      failed++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const meta = await sharp(buffer).metadata();
      const { width, height } = meta;

      console.log(`  [${bunnyVideoId?.slice(0, 8)}] ${width}x${height} → `, false);

      if (width > height * 1.1) {
        // 横向き(landscape): 90°回転して縦向きにする
        // iPhoneの縦動画は「横向き保存+回転タグ」のため、CCW(=270°CW=-90°)回転が通常正しい
        // ただしメーカーによって異なる場合あり。まず-90°(CCW)を試す。
        const rotated = await sharp(buffer)
          .rotate(-90)       // 90°反時計回り (CCW) = portrait
          .jpeg({ quality: 90 })
          .toBuffer();

        // 上書き保存
        fs.writeFileSync(filePath, rotated);

        const newMeta = await sharp(rotated).metadata();
        process.stdout.write(`${newMeta.width}x${newMeta.height} ✓ rotated CCW\n`);
        fixed++;
      } else if (Math.abs(width - height) < height * 0.1) {
        // 正方形(square): 縦方向にクロップして portrait にする
        // 640×640 → 360×640: 左右を均等にトリミング
        const targetW = Math.round(height * 9 / 16); // 9:16 portrait
        const left = Math.round((width - targetW) / 2);
        const cropped = await sharp(buffer)
          .extract({ left, top: 0, width: targetW, height })
          .jpeg({ quality: 90 })
          .toBuffer();

        fs.writeFileSync(filePath, cropped);
        process.stdout.write(`${targetW}x${height} ✓ cropped to portrait\n`);
        fixed++;
      } else {
        // 縦向き(portrait): そのままOK
        process.stdout.write(`portrait OK (no change)\n`);
        skipped++;
      }
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
      failed++;
    }
  }

  await conn.end();

  console.log(`\n=== Done ===`);
  console.log(`Total: ${rows.length}, Fixed: ${fixed}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
