import Layout from "@/components/Layout";
import VideoFeed from "@/components/VideoFeed";
import { useEffect } from "react";

// ★ v86-diag: 診断ヘルパー
const _pd = (msg: string) => { try { (window as any).__pd?.(msg); } catch {} };
_pd('Home MODULE loaded');

export default function Home() {
  _pd('Home render');
  // SEO: タイトルを30-60文字に設定
  useEffect(() => {
    document.title = "チバガレージ | 宮城県大崎市の中古車買取・販売【高価買取・LINE査定対応】";
  }, []);

  return (
    <Layout>
      {/* SEO: H2見出しを追加（視覚的には非表示だがSEO対策として有効） */}
      <h2 className="sr-only">宮城県大崎市の中古車在庫一覧 - チバガレージ</h2>
      <VideoFeed />
    </Layout>
  );
}
