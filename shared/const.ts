
export const COMPANY_INFO = {
  name: "チバガレージ",
  representative: "千葉 遥斗",
  phone: "080-2806-5360",
  fax: "0229-38-1211",
  email: "tiba.raasy3180@icloud.com",
  address: "〒989-4416 宮城県大崎市田尻中目字下田20-22",
  capital: "2000万円",
  businessHours: "24時間365日対応（完全予約制）",
  closedDays: "完全予約制のため定休日なし",
  instagram: "https://www.instagram.com/kumachan3855?igsh=M2pwbmVjbWs4NXYw&utm_source=qr",
  business: [
    "中古自動車の買取/販売",
    "二輪自動車の買取/販売",
    "整備",
    "車検",
    "名義変更等"
  ],
  features: [
    "24時間365日営業",
    "少人数運営によるコストカット",
    "完全予約制",
    "LINE査定対応",
    "全国配送対応"
  ],
  lineUrl: "https://line.me/ti/p/8aUgJW6P18",
  instagramUrl: "https://www.instagram.com/kumachan3855?igsh=M2pwbmVjbWs4NXYw&utm_source=qr",
  catchphrase: {
    buy: "超高額買取",
    sell: "「現状販売」で全国最安値へ。"
  }
};

export const NAV_LINKS = [
  { label: "在庫一覧", href: "/" },
  { label: "委託在庫一覧", href: "/consignment" },
  { label: "買取", href: "/buy" },
  { label: "販売", href: "/sell" },
  { label: "会社概要", href: "/about" },
  { label: "特商法", href: "/legal" },
];

// サンプル動画データ
export const SAMPLE_CARS = [
  {
    id: 1,
    title: "TOYOTA LAND CRUISER PRADO",
    price: "2,480,000",
    videoUrl: "/videos/sample-car.mp4",
    description: "黒革シート、サンルーフ、リフトアップ済み。極上のコンディション。",
    status: "在庫あり"
  },
  {
    id: 2,
    title: "MERCEDES-BENZ G-CLASS",
    price: "12,800,000",
    videoUrl: "/videos/sample-car.mp4",
    description: "AMG G63仕様、マットブラックラッピング。圧倒的な存在感。",
    status: "商談中"
  },
  {
    id: 3,
    title: "NISSAN SKYLINE GT-R R34",
    price: "ASK",
    videoUrl: "/videos/sample-car.mp4",
    description: "V-Spec II、ベイサイドブルー。フルノーマル、修復歴なし。",
    status: "在庫あり"
  },
  {
    id: 4,
    title: "HARLEY-DAVIDSON SPORTSTER",
    price: "1,200,000",
    videoUrl: "/videos/sample-car.mp4",
    description: "XL1200X フォーティーエイト。カスタム多数、車検2年付き。",
    status: "在庫あり"
  }
];
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

export const COOKIE_NAME = 'chiba_garage_session';
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
