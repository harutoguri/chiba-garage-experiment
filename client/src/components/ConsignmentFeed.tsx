/**
 * ConsignmentFeed v10
 *
 * データ取得 → TikTokVideoGallery v10 をインライン表示。
 * VideoFeed v10と同じ方式。委託在庫専用。
 *
 * v10: hooks違反修正 - vehicleMedia.listBulk APIで一括取得に変更
 */

import { useMemo } from "react";
import { COMPANY_INFO } from "../../../shared/const";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import TikTokVideoGallery from "@/components/TikTokVideoGallery";
import type { VehicleData, MediaItem } from "@/components/TikTokVideoGallery";

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

function getPriceDisplay(car: any) {
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

export default function ConsignmentFeed() {
  const { data: dbVehicles, isLoading } = trpc.vehicles.listConsignment.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const vehicles = useMemo(
    () => (dbVehicles && dbVehicles.length > 0 ? dbVehicles : []),
    [dbVehicles]
  );

  // 全車両のIDリスト（安定した参照）
  const vehicleIds = useMemo(() => vehicles.map((v) => v.id), [vehicles]);

  // 全車両のメディアを一括取得（hooks違反を回避）
  const { data: allMediaMap } = trpc.vehicleMedia.listBulk.useQuery(
    { vehicleIds },
    {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      enabled: vehicleIds.length > 0,
    }
  );

  // VehicleData[]を構築（メディアがある車両のみ）
  const galleryVehicles: VehicleData[] = useMemo(() => {
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

        // メディアがない場合、車両のvideoUrl/imageUrlをフォールバック
        if (mediaItems.length === 0) {
          if (v.videoUrl) {
            mediaItems.push({ id: -1, type: "video", url: v.videoUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
          }
          if (v.imageUrl) {
            mediaItems.push({ id: -2, type: "image", url: v.imageUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
          } else if (v.thumbnailUrl) {
            mediaItems.push({ id: -3, type: "image", url: v.thumbnailUrl, bunnyVideoId: null, thumbnailUrl: null, optimizedUrls: null });
          }
        }

        return {
          id: v.id,
          title: v.title || "",
          price: getPriceDisplay(v),
          description: v.description,
          media: mediaItems,
          isConsignment: true,
        };
      })
      .filter((v) => v.media.length > 0);
  }, [vehicles, allMediaMap]);

  if (isLoading) {
    return (
      <div
        className="w-full flex items-center justify-center bg-black"
        style={{ height: "calc(100dvh - 4rem)" }}
      >
        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  // 委託車両がない場合
  if (vehicles.length === 0 || galleryVehicles.length === 0) {
    return (
      <div
        className="w-full flex flex-col bg-black"
        style={{ height: "calc(100dvh - 4rem)" }}
      >
        <div className="bg-zinc-900 border-b border-zinc-800 p-6">
          <h1 className="text-xl font-bold text-white mb-3">委託在庫一覧</h1>
          <div className="text-sm text-zinc-400 space-y-2">
            <p>本ページの車両はオーナー様保有の委託車両です。</p>
            <p>売買契約はオーナー様と購入者様の直接契約となります。</p>
          </div>
        </div>

        <div className="bg-blue-950/30 border-b border-blue-900/30 p-6">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            委託掲載について
          </h2>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>・掲載費用：無料</li>
            <li>・成約時のみ手数料10%（税込）</li>
            <li>・チバガレージは仲介として成約サポート</li>
          </ul>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-4">現在、委託車両はありません</h3>
          <p className="text-zinc-500 mb-8 text-sm">
            委託掲載をご希望の方は、
            <br />
            LINEでお気軽にご相談ください。
          </p>
          <Button
            className="bg-white text-black hover:bg-zinc-200 rounded-none px-10 py-6 text-lg font-bold tracking-widest"
            onClick={() => window.open(COMPANY_INFO.lineUrl, "_blank")}
          >
            LINEで相談する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TikTokVideoGallery
      isOpen={true}
      onClose={() => {}}
      vehicles={galleryVehicles}
      initialVehicleIndex={0}
      initialMediaIndex={0}
    />
  );
}
