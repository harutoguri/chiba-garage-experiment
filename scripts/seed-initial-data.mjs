import { drizzle } from "drizzle-orm/mysql2";
import { vehicles, purchaseRecords, slideshowMedia } from "../drizzle/schema.js";

// データベース接続
const db = drizzle(process.env.DATABASE_URL);

// サンプル在庫データ
const sampleVehicles = [
  {
    title: "TOYOTA LAND CRUISER PRADO",
    price: 2480000,
    priceDisplay: "2,480,000",
    videoUrl: "/videos/sample-car.mp4",
    thumbnailUrl: null,
    description: "黒革シート、サンルーフ、リフトアップ済み。極上のコンディション。",
    status: "在庫あり",
    displayOrder: 1,
    isPublished: true,
  },
  {
    title: "MERCEDES-BENZ G-CLASS",
    price: 12800000,
    priceDisplay: "12,800,000",
    videoUrl: "/videos/sample-car.mp4",
    thumbnailUrl: null,
    description: "AMG G63仕様、マットブラックラッピング。圧倒的な存在感。",
    status: "商談中",
    displayOrder: 2,
    isPublished: true,
  },
  {
    title: "NISSAN SKYLINE GT-R R34",
    price: null,
    priceDisplay: "ASK",
    videoUrl: "/videos/sample-car.mp4",
    thumbnailUrl: null,
    description: "V-Spec II、ベイサイドブルー。フルノーマル、修復歴なし。",
    status: "在庫あり",
    displayOrder: 3,
    isPublished: true,
  },
  {
    title: "HARLEY-DAVIDSON SPORTSTER",
    price: 1200000,
    priceDisplay: "1,200,000",
    videoUrl: "/videos/sample-car.mp4",
    thumbnailUrl: null,
    description: "XL1200X フォーティーエイト。カスタム多数、車検2年付き。",
    status: "在庫あり",
    displayOrder: 4,
    isPublished: true,
  },
];

// サンプル買取実績データ
const samplePurchaseRecords = [
  {
    vehicleName: "トヨタ ヴィッツ",
    purchasePrice: 350000,
    priceDisplay: "35万円",
    comment: "他社より5万円高く買取！",
    imageUrl: null,
    isPublished: true,
  },
  {
    vehicleName: "ホンダ フィット",
    purchasePrice: 480000,
    priceDisplay: "48万円",
    comment: "走行10万km超でも高額買取",
    imageUrl: null,
    isPublished: true,
  },
  {
    vehicleName: "日産 ノート",
    purchasePrice: 550000,
    priceDisplay: "55万円",
    comment: "即日現金払い対応",
    imageUrl: null,
    isPublished: true,
  },
  {
    vehicleName: "スズキ ワゴンR",
    purchasePrice: 280000,
    priceDisplay: "28万円",
    comment: "軽自動車も高価買取！",
    imageUrl: null,
    isPublished: true,
  },
  {
    vehicleName: "ダイハツ タント",
    purchasePrice: 420000,
    priceDisplay: "42万円",
    comment: "人気の軽自動車を高額査定",
    imageUrl: null,
    isPublished: true,
  },
  {
    vehicleName: "マツダ デミオ",
    purchasePrice: 380000,
    priceDisplay: "38万円",
    comment: "コンパクトカーも大歓迎",
    imageUrl: null,
    isPublished: true,
  },
];

// スライドショー画像データ
const sampleSlideshowMedia = [
  { type: "image", url: "/assets/about/slide_01.jpg", title: "店舗外観1", displayOrder: 1, isPublished: true },
  { type: "image", url: "/assets/about/slide_02.png", title: "店舗外観2", displayOrder: 2, isPublished: true },
  { type: "image", url: "/assets/about/slide_03.jpg", title: "店舗外観3", displayOrder: 3, isPublished: true },
  { type: "image", url: "/assets/about/slide_04.png", title: "店舗外観4", displayOrder: 4, isPublished: true },
  { type: "image", url: "/assets/about/slide_05.jpg", title: "店舗外観5", displayOrder: 5, isPublished: true },
  { type: "image", url: "/assets/about/slide_06.png", title: "店舗外観6", displayOrder: 6, isPublished: true },
  { type: "image", url: "/assets/about/slide_07.png", title: "店舗外観7", displayOrder: 7, isPublished: true },
  { type: "image", url: "/assets/about/slide_08.png", title: "店舗外観8", displayOrder: 8, isPublished: true },
  { type: "image", url: "/assets/about/slide_09.png", title: "店舗外観9", displayOrder: 9, isPublished: true },
];

async function seedData() {
  try {
    console.log("初期データを登録中...");

    // 在庫データを登録
    console.log("在庫データを登録中...");
    for (const vehicle of sampleVehicles) {
      await db.insert(vehicles).values(vehicle);
    }
    console.log(`${sampleVehicles.length}件の在庫を登録しました`);

    // 買取実績データを登録
    console.log("買取実績データを登録中...");
    for (const record of samplePurchaseRecords) {
      await db.insert(purchaseRecords).values(record);
    }
    console.log(`${samplePurchaseRecords.length}件の買取実績を登録しました`);

    // スライドショーメディアデータを登録
    console.log("スライドショーメディアデータを登録中...");
    for (const media of sampleSlideshowMedia) {
      await db.insert(slideshowMedia).values(media);
    }
    console.log(`${sampleSlideshowMedia.length}件のスライドショーメディアを登録しました`);

    console.log("初期データの登録が完了しました！");
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

seedData();
