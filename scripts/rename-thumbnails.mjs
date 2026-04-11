/**
 * サムネイルを新しいファイル名にリネームしてDBを更新
 * → ブラウザキャッシュをバイパス（URLが変わるので強制再ダウンロード）
 */
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
  const conn = await mysql.createConnection(DB_CONFIG);
  const [rows] = await conn.execute(
    "SELECT id, thumbnailUrl FROM vehicle_media WHERE thumbnailUrl LIKE '/local-storage/thumbnails/%'"
  );

  console.log(`Renaming ${rows.length} thumbnails...`);

  for (const row of rows) {
    const { id, thumbnailUrl } = row;
    const oldFile = path.basename(thumbnailUrl);
    const oldPath = path.join(THUMBS_DIR, oldFile);

    if (!fs.existsSync(oldPath)) {
      console.log(`  SKIP (not found): ${oldFile}`);
      continue;
    }

    // 新しいファイル名: v2- プレフィックスを追加してキャッシュバスト
    const newFile = 'v2-' + oldFile;
    const newPath = path.join(THUMBS_DIR, newFile);
    const newUrl = `/local-storage/thumbnails/${newFile}`;

    fs.copyFileSync(oldPath, newPath);
    fs.unlinkSync(oldPath);

    await conn.execute('UPDATE vehicle_media SET thumbnailUrl = ? WHERE id = ?', [newUrl, id]);
    console.log(`  ✓ ${oldFile} → ${newFile}`);
  }

  await conn.end();
  console.log('\nDone. DB updated with new URLs.');
}

main().catch(err => { console.error(err); process.exit(1); });
