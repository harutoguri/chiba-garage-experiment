// DB状態バックアップ＆リストアスクリプト
// Usage:
//   node backup-db.mjs backup   → .db-backups/YYYY-MM-DD_HHmmss.json に保存
//   node backup-db.mjs restore .db-backups/2026-04-05_123456.json  → 復元
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const db = drizzle(process.env.DATABASE_URL);
const backupDir = path.join(process.cwd(), ".db-backups");

async function backup() {
  fs.mkdirSync(backupDir, { recursive: true });

  const tables = ["vehicles", "vehicle_media", "purchase_records", "news_items", "slideshow_media", "page_views", "business_metrics"];
  const data = {};

  for (const table of tables) {
    try {
      const rows = await db.execute(sql.raw(`SELECT * FROM ${table}`));
      data[table] = rows[0] || rows;
      console.log(`  ${table}: ${Array.isArray(data[table]) ? data[table].length : '?'} rows`);
    } catch (e) {
      console.log(`  ${table}: skipped (${e.message?.slice(0, 50)})`);
      data[table] = [];
    }
  }

  const ts = new Date().toISOString().replace(/[T:]/g, '_').replace(/\..+/, '');
  const filePath = path.join(backupDir, `${ts}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\nBackup saved: ${filePath}`);
  process.exit(0);
}

async function restore(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // 復元対象テーブル（pageViews, businessMetricsは除外 — 大量データ＆復元不要）
  const restoreTables = ["vehicles", "vehicle_media", "purchase_records", "news_items", "slideshow_media"];

  for (const table of restoreTables) {
    if (!data[table] || data[table].length === 0) continue;

    try {
      // テーブルクリア
      await db.execute(sql.raw(`DELETE FROM ${table}`));

      // 行を挿入
      for (const row of data[table]) {
        const cols = Object.keys(row);
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null) return "NULL";
          if (typeof v === "number") return v;
          if (typeof v === "boolean") return v ? 1 : 0;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        await db.execute(sql.raw(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')})`));
      }
      console.log(`  ${table}: restored ${data[table].length} rows`);
    } catch (e) {
      console.error(`  ${table}: FAILED — ${e.message}`);
    }
  }

  console.log("\nRestore complete.");
  process.exit(0);
}

const cmd = process.argv[2];
if (cmd === "backup") {
  backup();
} else if (cmd === "restore") {
  restore(process.argv[3]);
} else {
  console.log("Usage: node backup-db.mjs backup | restore <file>");
  process.exit(1);
}
