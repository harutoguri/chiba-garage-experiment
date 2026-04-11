/**
 * Consignment v11
 *
 * 委託在庫ページ。
 * 構造: 通常スクロールの説明セクション → TikTok形式scroll-snapの車両一覧 → End of Feed
 *
 * v11変更点:
 *   - listConsignmentWithMedia で車両+メディアを1リクエスト化（2段ウォーターフォール解消）
 */

import { COMPANY_INFO } from "../../../shared/const";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Handshake, Phone, CheckCircle, ChevronDown } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import TikTokVideoGallery from "@/components/TikTokVideoGallery";
import { startEarlyPreload } from "@/components/TikTokVideoGallery";
import type { VehicleData, MediaItem } from "@/components/TikTokVideoGallery";
import { getBunnyHlsUrl } from "@/lib/bunnyUrls";

interface VehicleMedia {
  id: number;
  vehicleId: number;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  bunnyVideoId: string | null;
  displayOrder: number | null;
  isMain: boolean | null;
  optimizedUrls?: string | null;
}

interface Vehicle {
  id: number;
  title: string;
  price: number | null;
  priceDisplay: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl?: string | null;
  description: string | null;
  status: "在庫あり" | "商談中" | "売約済み";
  displayOrder: number | null;
  isPublished: boolean | null;
  isConsignment: boolean | null;
}

/** 委託掲載情報テキスト（車両詳細に追記される） */
const CONSIGNMENT_INFO_TEXT = `
━━━━━━━━━━━━━━━━━━
委託掲載について
━━━━━━━━━━━━━━━━━━
・掲載費用：無料
・成約時のみ、売主様より成約手数料10%（税込）を頂戴いたします
・売買契約は売主様と購入者様の直接契約となります
・チバガレージは仲介（媒介）として成約までサポートいたします`.trim();

function getPriceDisplay(car: Vehicle) {
  if (car.priceDisplay) {
    const numStr = car.priceDisplay.replace(/[^0-9]/g, "");
    if (numStr) {
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > 0) return `¥${num.toLocaleString()}-`;
    }
  }
  if (typeof car.price === "number" && car.price > 0) return `¥${car.price.toLocaleString()}-`;
  return "ASK";
}

export default function Consignment() {
  const [galleryMode, setGalleryMode] = useState(false); // false=説明セクション, true=車両ギャラリー

  // ★ v54: 1リクエストで車両+メディア一括取得（2段ウォーターフォール解消）
  const { data: vehiclesWithMedia, isLoading } = trpc.vehicles.listConsignmentWithMedia.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const vehicles = useMemo(() => vehiclesWithMedia?.vehicles || [], [vehiclesWithMedia]);
  const allMediaMap = vehiclesWithMedia?.mediaMap;
  const hasVehicles = vehicles.length > 0;

  // VehicleData[]を構築
  const feedVehicles: VehicleData[] = useMemo(() => {
    return vehicles
      .map((car) => {
        const v = car as any;
        const mediaData = allMediaMap?.[v.id] as VehicleMedia[] | undefined;

        const mediaItems: MediaItem[] = mediaData
          ? [...mediaData]
              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
              .map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                bunnyVideoId: m.bunnyVideoId,
                thumbnailUrl: m.thumbnailUrl,
                optimizedUrls: m.optimizedUrls || null,
              }))
          : [];

        if (mediaItems.length === 0) {
          if (v.videoUrl) mediaItems.push({ id: -1, type: "video", url: v.videoUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
          if (v.imageUrl) mediaItems.push({ id: -2, type: "image", url: v.imageUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
          else if (v.thumbnailUrl) mediaItems.push({ id: -3, type: "image", url: v.thumbnailUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
        }

        const baseDesc = v.description || "";
        const fullDescription = baseDesc
          ? `${baseDesc}\n\n${CONSIGNMENT_INFO_TEXT}`
          : CONSIGNMENT_INFO_TEXT;

        return {
          id: v.id,
          title: v.title || "",
          price: getPriceDisplay(v),
          description: fullDescription,
          media: mediaItems,
          status: v.status || "在庫あり",
          isConsignment: true,
        };
      })
      .filter((v) => v.media.length > 0);
  }, [vehicles, allMediaMap]);

  // ★ v54: 説明セクション表示中に最初の動画のHLSマニフェストを先行取得
  useEffect(() => {
    if (!galleryMode && feedVehicles.length > 0) {
      const firstVideo = feedVehicles[0]?.media.find(m => m.type === "video" && m.bunnyVideoId);
      if (firstVideo?.bunnyVideoId) {
        const hlsUrl = getBunnyHlsUrl(firstVideo.bunnyVideoId);
        startEarlyPreload(hlsUrl);
      }
    }
  }, [feedVehicles, galleryMode]);

  const handleBackToIntro = useCallback(() => {
    setGalleryMode(false);
  }, []);

  const handleEnterGallery = useCallback(() => {
    setGalleryMode(true);
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div
          className="w-full flex items-center justify-center bg-black"
          style={{ height: "calc(100dvh - 4rem)" }}
        >
          <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  // ========== ギャラリーモード — TikTokVideoGalleryで在庫一覧と完全統一 ==========
  // touch-assist, snapSettled, preconnect±2, frame0-show HDR, ピンチズーム等すべて同じ
  if (galleryMode && hasVehicles) {
    const endOfFeed = (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "black" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "white", marginBottom: "16px" }}>委託在庫は以上です</h3>
          <p style={{ color: "#71717a", marginBottom: "32px", fontSize: "14px" }}>
            委託掲載をご希望の方は、<br />LINEでお気軽にご相談ください。
          </p>
          <Button
            className="bg-white text-black hover:bg-zinc-200 rounded-none px-10 py-6 text-lg font-bold tracking-widest mb-6"
            onClick={() => window.open(COMPANY_INFO.lineUrl, "_blank")}
          >
            LINEで相談する
          </Button>
          <button
            onClick={handleBackToIntro}
            style={{ color: "#71717a", fontSize: "13px", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            ↑ 委託掲載の説明に戻る
          </button>
        </div>
      </div>
    );

    return (
      <Layout>
        <TikTokVideoGallery
          isOpen={true}
          onClose={handleBackToIntro}
          vehicles={feedVehicles}
          initialVehicleIndex={0}
          initialMediaIndex={0}
          footerSlot={endOfFeed}
        />
      </Layout>
    );
  }

  // ========== 説明セクション（通常スクロール） ==========
  return (
    <Layout>
      <div
        style={{
          width: "100%",
          minHeight: "calc(100dvh - 4rem)",
          overflowY: "auto",
          overflowX: "hidden",
          background: "white",
          color: "black",
        }}
      >
        {/* 上部余白（ヘッダーロゴとの重なり回避） */}
        <div style={{ height: "80px" }} />

        {/* タイトル */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <p style={{ color: "#2563eb", fontSize: "11px", fontWeight: "600", letterSpacing: "0.15em", marginBottom: "4px" }}>
            CONSIGNMENT VEHICLES
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "-0.02em" }}>委託在庫一覧</h1>
        </div>

        {/* サブタイトル */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <p style={{ color: "#6b7280", fontSize: "13px" }}>こちらは「委託在庫一覧」です。</p>
        </div>

        {/* 説明カード */}
        <div style={{ maxWidth: "400px", margin: "0 auto 24px", padding: "0 20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#1f2937", marginBottom: "16px" }}>
              本ページに掲載されている車両は、チバガレージの在庫ではなく、オーナー様（個人・法人）が保有する車両となります。
            </p>
            <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#1f2937", marginBottom: "16px" }}>
              売買契約は、車両オーナー様と購入者様の間で直接締結されます。
            </p>
            <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#1f2937" }}>
              チバガレージは、車両掲載・お問い合わせ対応・現車確認の調整・名義変更などの成約サポートを行う仲介（媒介）として関与いたします。
            </p>
          </div>
        </div>

        {/* スクロールして在庫を見る（LINEボタンの前に配置、目立つ位置） */}
        {hasVehicles && (
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <button
              onClick={handleEnterGallery}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "black",
                color: "white",
                fontSize: "15px",
                fontWeight: "bold",
                padding: "14px 32px",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                letterSpacing: "0.05em",
              }}
            >
              <ChevronDown size={18} style={{ animation: "bounce 1s infinite" }} />
              在庫を見る（{feedVehicles.length}台）
            </button>
          </div>
        )}

        {/* 委託掲載の流れ */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800" }}>委託掲載の流れ</h2>
        </div>

        <div style={{ maxWidth: "400px", margin: "0 auto 24px", padding: "0 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "16px 8px", textAlign: "center" }}>
              <FileText style={{ width: "28px", height: "28px", color: "#2563eb", margin: "0 auto 8px" }} />
              <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>STEP 1</p>
              <p style={{ fontSize: "11px", color: "#6b7280" }}>LINEで掲載申込</p>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "16px 8px", textAlign: "center" }}>
              <Handshake style={{ width: "28px", height: "28px", color: "#2563eb", margin: "0 auto 8px" }} />
              <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>STEP 2</p>
              <p style={{ fontSize: "11px", color: "#6b7280" }}>掲載・お問合せ対応</p>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "16px 8px", textAlign: "center" }}>
              <CheckCircle style={{ width: "28px", height: "28px", color: "#2563eb", margin: "0 auto 8px" }} />
              <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>STEP 3</p>
              <p style={{ fontSize: "11px", color: "#6b7280" }}>成約サポート</p>
            </div>
          </div>
        </div>

        {/* 委託掲載について */}
        <div style={{ maxWidth: "400px", margin: "0 auto 24px", padding: "0 20px" }}>
          <div style={{ background: "#eff6ff", borderRadius: "12px", padding: "20px" }}>
            <h3 style={{ fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px", fontSize: "15px" }}>
              <Phone style={{ width: "16px", height: "16px", color: "#2563eb" }} />
              委託掲載について
            </h3>
            <ul style={{ fontSize: "13px", color: "#374151", lineHeight: "1.8" }}>
              <li style={{ marginBottom: "4px" }}>・掲載費用：無料</li>
              <li style={{ marginBottom: "4px" }}>・成約時のみ、売主様より成約手数料10%（税込）を頂戴いたします</li>
              <li style={{ marginBottom: "4px" }}>・売買契約は売主様と購入者様の直接契約となります</li>
              <li>・チバガレージは仲介（媒介）として成約までサポートいたします</li>
            </ul>
          </div>
        </div>

        {/* LINEで相談するボタン */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Button
            className="bg-black text-white hover:bg-gray-800 rounded-none px-8 py-3 text-base font-bold tracking-widest"
            onClick={() => window.open(COMPANY_INFO.lineUrl, "_blank")}
          >
            LINEで相談する
          </Button>
        </div>

        {/* 在庫を見るボタン（下部にも配置） */}
        {hasVehicles && (
          <div style={{ textAlign: "center", paddingBottom: "16px" }}>
            <button
              onClick={handleEnterGallery}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#6b7280",
                fontSize: "13px",
                background: "none",
                border: "1px solid #d1d5db",
                borderRadius: "999px",
                padding: "10px 24px",
                cursor: "pointer",
              }}
            >
              <ChevronDown size={14} />
              在庫を見る（{feedVehicles.length}台）
            </button>
          </div>
        )}

        {/* 車両がない場合のEnd of Feed */}
        {!hasVehicles && (
          <div style={{ textAlign: "center", padding: "40px 20px 60px" }}>
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>現在、委託車両はありません。</p>
          </div>
        )}

        {/* 下部余白（下部タブの分） */}
        <div style={{ height: "80px" }} />
      </div>
    </Layout>
  );
}
