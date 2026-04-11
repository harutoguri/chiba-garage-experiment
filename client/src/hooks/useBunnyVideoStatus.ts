import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";

interface BunnyVideoStatus {
  isReady: boolean;
  encodeProgress: number;
  status: number;
}

/**
 * Bunny Stream動画の変換ステータスをポーリングするフック
 * 
 * - bunnyVideoIdがない場合はスキップ
 * - status === 4（変換完了）になったらポーリング停止
 * - 5秒間隔でポーリング
 * - 変換完了時にonReadyコールバックを呼ぶ
 */
export function useBunnyVideoStatus(
  bunnyVideoId: string | null | undefined,
  options?: {
    onReady?: () => void;
    enabled?: boolean;
  }
) {
  const [videoStatus, setVideoStatus] = useState<BunnyVideoStatus | null>(null);
  const onReadyCalledRef = useRef(false);

  const { data, isLoading } = trpc.bunnyStream.getVideo.useQuery(
    { videoId: bunnyVideoId! },
    {
      enabled: !!bunnyVideoId && options?.enabled !== false,
      refetchInterval: (query) => {
        const data = query.state.data;
        // 変換完了（status === 4）ならポーリング停止
        if (data?.isReady) return false;
        // 5秒間隔でポーリング
        return 5000;
      },
      staleTime: 3000,
    }
  );

  useEffect(() => {
    if (!data) return;

    setVideoStatus({
      isReady: data.isReady,
      encodeProgress: data.encodeProgress,
      status: data.status,
    });

    // 変換完了時にコールバック（1回のみ）
    if (data.isReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      options?.onReady?.();
    }
  }, [data, options?.onReady]);

  return {
    isReady: videoStatus?.isReady ?? false,
    encodeProgress: videoStatus?.encodeProgress ?? 0,
    status: videoStatus?.status ?? 0,
    isLoading,
    isEncoding: !!bunnyVideoId && !videoStatus?.isReady,
  };
}

/**
 * 変換ステータスの表示テキストを取得
 */
export function getEncodingStatusText(status: number, progress: number): string {
  switch (status) {
    case 0: return "キューに追加中...";
    case 1: return `変換中... ${progress}%`;
    case 2: return "変換失敗";
    case 3: return "変換中...";
    case 4: return "配信準備完了";
    case 5: return "アップロード中...";
    case 6: return "アップロード失敗";
    default: return "処理中...";
  }
}
