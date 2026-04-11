#!/usr/bin/env node
/**
 * ローカル開発用ダミーデータ挿入スクリプト
 * 
 * 使い方:
 *   DATABASE_URL=mysql://... node scripts/seed-dev-data.mjs
 * 
 * DATABASE_URLが設定されていない場合はスキップします。
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('[Seed] DATABASE_URL not set. Skipping seed.');
  console.log('[Seed] サイトはDB無しでも表示可能です（空のリストが表示されます）。');
  process.exit(0);
}

async function seed() {
  console.log('[Seed] Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    // 1. 開発用管理者ユーザー
    console.log('[Seed] Creating dev admin user...');
    await connection.execute(`
      INSERT IGNORE INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
      VALUES ('dev-admin-user', '開発用管理者', 'dev@localhost', 'dev', 'admin', NOW(), NOW(), NOW())
    `);

    // 2. ダミー車両データ
    console.log('[Seed] Creating sample vehicles...');
    const vehicles = [
      {
        title: 'TOYOTA LAND CRUISER PRADO',
        price: 2480000,
        priceDisplay: '2,480,000',
        description: '黒革シート、サンルーフ、リフトアップ済み。極上のコンディション。',
        status: '在庫あり',
        displayOrder: 1,
        isPublished: true,
        isConsignment: false,
      },
      {
        title: 'MERCEDES-BENZ G-CLASS',
        price: 12800000,
        priceDisplay: '12,800,000',
        description: 'AMG G63仕様、マットブラックラッピング。圧倒的な存在感。',
        status: '商談中',
        displayOrder: 2,
        isPublished: true,
        isConsignment: false,
      },
      {
        title: 'NISSAN SKYLINE GT-R R34',
        price: null,
        priceDisplay: 'ASK',
        description: 'V-Spec II、ベイサイドブルー。フルノーマル、修復歴なし。',
        status: '在庫あり',
        displayOrder: 3,
        isPublished: true,
        isConsignment: false,
      },
      {
        title: 'HONDA NSX NA1',
        price: 8500000,
        priceDisplay: '8,500,000',
        description: 'フルノーマル、走行距離3万km台。希少なベルリナブラック。',
        status: '在庫あり',
        displayOrder: 4,
        isPublished: true,
        isConsignment: true,
      },
    ];

    for (const v of vehicles) {
      await connection.execute(`
        INSERT IGNORE INTO vehicles (title, price, priceDisplay, description, status, displayOrder, isPublished, isConsignment, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [v.title, v.price, v.priceDisplay, v.description, v.status, v.displayOrder, v.isPublished, v.isConsignment]);
    }

    // 3. ダミー買取実績
    console.log('[Seed] Creating sample purchase records...');
    const records = [
      { carName: 'トヨタ アルファード 2.5S', purchasePrice: 3200000, displayOrder: 1 },
      { carName: '日産 GT-R R35', purchasePrice: 12000000, displayOrder: 2 },
      { carName: 'スズキ ジムニー JB64', purchasePrice: 1800000, displayOrder: 3 },
    ];

    for (const r of records) {
      await connection.execute(`
        INSERT IGNORE INTO purchase_records (carName, purchasePrice, displayOrder, isPublished, createdAt, updatedAt)
        VALUES (?, ?, ?, true, NOW(), NOW())
      `, [r.carName, r.purchasePrice, r.displayOrder]);
    }

    // 4. ダミーニュース
    console.log('[Seed] Creating sample news items...');
    await connection.execute(`
      INSERT IGNORE INTO news_items (title, url, displayOrder, isPublished, createdAt, updatedAt)
      VALUES ('サイトリニューアルしました', '/', 1, true, NOW(), NOW())
    `);

    // 5. ダミービジネス指標
    console.log('[Seed] Creating sample business metrics...');
    await connection.execute(`
      INSERT IGNORE INTO business_metrics (year, totalTransactionAmount, assessmentCount, contractCount, isForecast, createdAt, updatedAt)
      VALUES (2024, 50000000, 120, 45, false, NOW(), NOW())
    `);
    await connection.execute(`
      INSERT IGNORE INTO business_metrics (year, totalTransactionAmount, assessmentCount, contractCount, isForecast, actualAmount, forecastAmountAdd, actualAssess, forecastAssessAdd, actualContract, forecastContractAdd, createdAt, updatedAt)
      VALUES (2025, 80000000, 200, 80, false, 40000000, 40000000, 100, 100, 40, 40, NOW(), NOW())
    `);

    console.log('[Seed] Done! ダミーデータの挿入が完了しました。');
    console.log('[Seed] 管理者ユーザー: dev-admin-user (DEV_MODE=true で自動ログイン)');
    
  } catch (error) {
    console.error('[Seed] Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
