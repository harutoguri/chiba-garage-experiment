import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getEncodingStatusText } from "@/hooks/useBunnyVideoStatus";

interface VideoEncodingPlaceholderProps {
  status: number;
  encodeProgress: number;
  isReady: boolean;
  className?: string;
}

/**
 * 動画変換中のプレースホルダーコンポーネント
 * 
 * - 変換中: スピナー + プログレスバー
 * - 変換完了: チェックマーク（すぐに動画に切り替わる）
 * - 変換失敗: エラーアイコン + メッセージ
 */
export default function VideoEncodingPlaceholder({
  status,
  encodeProgress,
  isReady,
  className = "",
}: VideoEncodingPlaceholderProps) {
  const isFailed = status === 2 || status === 6;
  const statusText = getEncodingStatusText(status, encodeProgress);

  if (isReady) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
        <CheckCircle2 className="w-8 h-8 text-green-400" />
        <span className="text-sm text-green-400">配信準備完了</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-400" />
        <span className="text-sm text-red-400">{statusText}</span>
        <span className="text-xs text-white/50">再アップロードしてください</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
      <span className="text-sm text-white/70">{statusText}</span>
      {/* プログレスバー */}
      {encodeProgress > 0 && (
        <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(encodeProgress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * 背景動画用の変換中プレースホルダー（フルスクリーン）
 */
export function BackgroundEncodingPlaceholder({
  status,
  encodeProgress,
  isReady,
  posterUrl,
}: VideoEncodingPlaceholderProps & { posterUrl?: string | null }) {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      {/* ポスター画像があれば背景に表示 */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
      )}
      {/* 暗いオーバーレイ */}
      <div className="absolute inset-0 bg-black/60" />
      {/* ステータス表示 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <VideoEncodingPlaceholder
          status={status}
          encodeProgress={encodeProgress}
          isReady={isReady}
        />
      </div>
    </div>
  );
}
