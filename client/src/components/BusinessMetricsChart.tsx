import { trpc } from "@/lib/trpc";
import { TrendingUp, Users, FileCheck, BarChart3 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

// 開発モードかどうか
const isDev = import.meta.env.DEV;

// デバッグログ（開発時のみ）
const debugLog = (message: string, data?: unknown) => {
  if (isDev) {
    console.log(`[BusinessMetricsChart] ${message}`, data ?? "");
  }
};

// グラフエリアの固定高さ（px）
const CHART_AREA_HEIGHT = 200; // 棒が伸びる領域の高さ

// 現在の年を取得
const CURRENT_YEAR = new Date().getFullYear();

/**
 * ビジネス指標グラフコンポーネント
 * 買取ページに年度別の累計取扱高・査定数・成約数を縦棒グラフで表示
 * 本年のみ「実績＋着地予想」の積み上げ棒グラフ表示
 */
export default function BusinessMetricsChart() {
  const { data: metrics, isLoading, error } = trpc.businessMetrics.list.useQuery();
  const [activeTab, setActiveTab] = useState<"revenue" | "assessment" | "contract">("revenue");
  // アニメーション状態 - 初期値をtrueにして即座に表示
  const [animationReady, setAnimationReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // データ読み込み後にアニメーションを開始
  useEffect(() => {
    if (metrics && metrics.length > 0) {
      debugLog("chart data", metrics);
      // 少し遅延させてアニメーションを開始
      const timer = setTimeout(() => {
        setAnimationReady(true);
        debugLog("animationReady=true");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [metrics]);

  // ローディング中
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-lg mb-10 bg-white border-2 border-gray-300 shadow-xl" style={{ minHeight: "400px" }}>
        <div className="flex items-center justify-center h-full p-10">
          <div className="text-gray-500">データ読み込み中...</div>
        </div>
      </div>
    );
  }

  // エラー時
  if (error) {
    debugLog("error", error);
    return null;
  }

  // データがない場合はセクション自体を非表示
  if (!metrics || metrics.length === 0) {
    debugLog("no data");
    return null;
  }

  // 年度順にソート（昇順）
  const sortedMetrics = [...metrics].sort((a, b) => Number(a.year) - Number(b.year));

  // 本年かどうかを判定
  const isCurrentYear = (year: number) => year === CURRENT_YEAR;

  // タブに応じた値を取得（本年は実績＋予想上乗せ分の合計）
  const getDisplayValue = (metric: typeof sortedMetrics[0]) => {
    const year = Number(metric.year);
    const isThisYear = isCurrentYear(year);

    switch (activeTab) {
      case "revenue":
        if (isThisYear) {
          const actual = Number(metric.actualAmount) || 0;
          const forecast = Number(metric.forecastAmountAdd) || 0;
          return { actual, forecast, total: actual + forecast };
        }
        return { actual: Number(metric.totalTransactionAmount) || 0, forecast: 0, total: Number(metric.totalTransactionAmount) || 0 };
      case "assessment":
        if (isThisYear) {
          const actual = Number(metric.actualAssess) || 0;
          const forecast = Number(metric.forecastAssessAdd) || 0;
          return { actual, forecast, total: actual + forecast };
        }
        return { actual: Number(metric.assessmentCount) || 0, forecast: 0, total: Number(metric.assessmentCount) || 0 };
      case "contract":
        if (isThisYear) {
          const actual = Number(metric.actualContract) || 0;
          const forecast = Number(metric.forecastContractAdd) || 0;
          return { actual, forecast, total: actual + forecast };
        }
        return { actual: Number(metric.contractCount) || 0, forecast: 0, total: Number(metric.contractCount) || 0 };
    }
  };

  // 最大値を取得（グラフのスケーリング用）- 本年は合計値を使用
  const getMaxValue = () => {
    const values = sortedMetrics.map(m => getDisplayValue(m).total);
    return Math.max(...values, 1);
  };

  const maxValue = getMaxValue();
  debugLog("max value", maxValue);

  // 最新年度のデータを取得（数値カード用）- 本年のデータを優先
  const currentYearMetric = sortedMetrics.find(m => isCurrentYear(Number(m.year)));
  const latestMetric = currentYearMetric || sortedMetrics[sortedMetrics.length - 1];
  
  // KPIカード用の値（本年は実績＋予想の合計）
  const getKPIValues = () => {
    if (!latestMetric) return { assessmentCount: 0, contractCount: 0, contractRate: "0.0" };
    
    const isThisYear = isCurrentYear(Number(latestMetric.year));
    
    let assessmentCount: number;
    let contractCount: number;
    
    if (isThisYear) {
      assessmentCount = (Number(latestMetric.actualAssess) || 0) + (Number(latestMetric.forecastAssessAdd) || 0);
      contractCount = (Number(latestMetric.actualContract) || 0) + (Number(latestMetric.forecastContractAdd) || 0);
    } else {
      assessmentCount = Number(latestMetric.assessmentCount) || 0;
      contractCount = Number(latestMetric.contractCount) || 0;
    }
    
    const contractRate = assessmentCount > 0 
      ? ((contractCount / assessmentCount) * 100).toFixed(1) 
      : "0.0";
    
    return { assessmentCount, contractCount, contractRate };
  };
  
  const kpiValues = getKPIValues();

  // 予想値が含まれているかチェック（本年の予想上乗せ分があるか、または未来年のisForecastがtrueか）
  const hasForecast = sortedMetrics.some(m => {
    const isThisYear = isCurrentYear(Number(m.year));
    if (isThisYear) {
      // 本年は予想上乗せ分があるかチェック
      return (Number(m.forecastAmountAdd) || 0) > 0 ||
             (Number(m.forecastAssessAdd) || 0) > 0 ||
             (Number(m.forecastContractAdd) || 0) > 0;
    }
    return m.isForecast;
  });

  // 金額をフォーマット（万円単位）
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}億円`;
    }
    if (amount >= 10000) {
      return `${Math.round(amount / 10000)}万円`;
    }
    return `${amount.toLocaleString()}円`;
  };

  // 高さをpxで計算（最大値を100%として正規化、CHART_AREA_HEIGHTに対する割合）
  const calculateHeightPx = (value: number, max: number): number => {
    const numValue = Number(value) || 0;
    const numMax = Number(max) || 1;
    
    if (numMax <= 0) return 10; // 最小高さ
    
    // 最大値を100%として正規化し、pxに変換
    const percent = numValue / numMax;
    const heightPx = Math.round(percent * CHART_AREA_HEIGHT);
    
    // 最小10px、最大CHART_AREA_HEIGHT
    const result = Math.max(Math.min(heightPx, CHART_AREA_HEIGHT), 10);
    
    debugLog(`height calc: value=${numValue}, max=${numMax}, percent=${(percent * 100).toFixed(1)}%, height=${result}px`);
    
    return result;
  };

  // 値のフォーマット
  const formatValue = (value: number) => {
    if (activeTab === "revenue") {
      return formatAmount(value);
    }
    return value.toString();
  };

  // 本年の表示テキストを生成
  const getCurrentYearLabel = (actual: number, forecast: number, total: number) => {
    if (forecast === 0) return formatValue(total);
    
    if (activeTab === "revenue") {
      return (
        <div className="text-center">
          <div className="text-xs md:text-sm font-bold text-gray-800" style={{ fontFamily: "monospace" }}>
            {formatAmount(total)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            (実績{formatAmount(actual)} + 予想{formatAmount(forecast)})
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-center">
        <div className="text-xs md:text-sm font-bold text-gray-800" style={{ fontFamily: "monospace" }}>
          {total}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          (実績{actual} + 予想{forecast})
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-lg mb-10 bg-white shadow-2xl"
      style={{ 
        border: "2px solid #1f2937",
        boxShadow: "0 0 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* グリッド背景 */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #000 1px, transparent 1px),
            linear-gradient(to bottom, #000 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {/* コーナーアクセント */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gray-800" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gray-800" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gray-800" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gray-800" />

      <div className="relative z-10 p-6 md:p-10">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-gray-800" />
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-wide">
              買取の年度累計取扱高
            </h3>
          </div>
          <p className="text-sm text-gray-500">
            ※買取事業の年度累計（予想含む）
          </p>
          <p className="text-sm text-gray-500">
            ※2024年7月 事業スタート
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("revenue")}
            className={`px-4 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === "revenue"
                ? "bg-gray-900 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={{ 
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          >
            累計取扱高
          </button>
          <button
            onClick={() => setActiveTab("assessment")}
            className={`px-4 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === "assessment"
                ? "bg-gray-900 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={{ 
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          >
            査定数
          </button>
          <button
            onClick={() => setActiveTab("contract")}
            className={`px-4 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === "contract"
                ? "bg-gray-900 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={{ 
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          >
            成約数
          </button>
        </div>

        {/* 縦棒グラフ - 親要素に固定高さを設定 */}
        <div className="mb-6">
          {/* 棒グラフエリア - 固定高さ、flex-end配置で下から伸びる */}
          <div 
            className="flex items-end justify-center gap-6 md:gap-10 px-4"
            style={{ 
              height: `${CHART_AREA_HEIGHT + 100}px`, // 棒の高さ + ラベル分（本年は2行になるので増やす）
              minHeight: `${CHART_AREA_HEIGHT + 100}px`,
            }}
          >
            {sortedMetrics.map((metric, index) => {
              const year = Number(metric.year);
              const isThisYear = isCurrentYear(year);
              const { actual, forecast, total } = getDisplayValue(metric);
              const totalHeightPx = calculateHeightPx(total, maxValue);
              const actualHeightPx = total > 0 ? Math.round((actual / total) * totalHeightPx) : 0;
              const forecastHeightPx = total > 0 ? totalHeightPx - actualHeightPx : 0;
              const isForecast = metric.isForecast && !isThisYear; // 未来年の予想フラグ
              
              debugLog(`bar ${year}: actual=${actual}, forecast=${forecast}, total=${total}, totalHeight=${totalHeightPx}px, actualHeight=${actualHeightPx}px, forecastHeight=${forecastHeightPx}px`);
              
              return (
                <div 
                  key={metric.id} 
                  className="flex flex-col items-center"
                  style={{ 
                    width: "80px",
                    minWidth: "60px",
                    maxWidth: "100px",
                  }}
                >
                  {/* 金額/数値ラベル */}
                  <div className="mb-2 text-center">
                    {isThisYear && forecast > 0 ? (
                      getCurrentYearLabel(actual, forecast, total)
                    ) : (
                      <div 
                        className="text-xs md:text-sm font-bold text-gray-800 whitespace-nowrap"
                        style={{ fontFamily: "monospace" }}
                      >
                        {formatValue(total)}
                      </div>
                    )}
                  </div>
                  
                  {/* 棒グラフコンテナ - 固定高さ、下揃え */}
                  <div 
                    className="w-full flex items-end justify-center"
                    style={{ 
                      height: `${CHART_AREA_HEIGHT}px`,
                      minHeight: `${CHART_AREA_HEIGHT}px`,
                    }}
                  >
                    {/* 棒グラフ本体 - 本年は積み上げ、それ以外は単一 */}
                    {isThisYear && forecast > 0 ? (
                      // 本年の積み上げ棒グラフ
                      <div
                        className="relative overflow-visible transition-all duration-700 ease-out flex flex-col"
                        style={{ 
                          width: "48px",
                          minWidth: "32px",
                          height: animationReady ? `${totalHeightPx}px` : "10px",
                          transitionDelay: `${index * 150}ms`,
                        }}
                      >
                        {/* 予想部分（上） - 点線/破線表現 */}
                        <div
                          className="w-full relative"
                          style={{
                            height: animationReady ? `${forecastHeightPx}px` : "0px",
                            background: "repeating-linear-gradient(45deg, #9ca3af 0px, #9ca3af 4px, #d1d5db 4px, #d1d5db 8px)",
                            border: "2px dashed #6b7280",
                            borderBottom: "none",
                            borderRadius: "2px 2px 0 0",
                            transition: "height 0.7s ease-out",
                            transitionDelay: `${index * 150 + 200}ms`,
                          }}
                        />
                        {/* 実績部分（下） - 濃色・実線 */}
                        <div
                          className="w-full relative"
                          style={{
                            height: animationReady ? `${actualHeightPx}px` : "10px",
                            background: "linear-gradient(180deg, #374151 0%, #111827 100%)",
                            boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.2)",
                            borderRadius: "0 0 0 0",
                            transition: "height 0.7s ease-out",
                            transitionDelay: `${index * 150}ms`,
                          }}
                        >
                          {/* 棒の上部ハイライト */}
                          <div 
                            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          />
                        </div>
                      </div>
                    ) : (
                      // 過去年・未来年の単一棒グラフ
                      <div
                        className="relative overflow-visible transition-all duration-700 ease-out"
                        style={{ 
                          width: "48px",
                          minWidth: "32px",
                          height: animationReady ? `${totalHeightPx}px` : "10px",
                          transitionDelay: `${index * 150}ms`,
                          background: isForecast 
                            ? "repeating-linear-gradient(45deg, #9ca3af 0px, #9ca3af 4px, #d1d5db 4px, #d1d5db 8px)"
                            : "linear-gradient(180deg, #374151 0%, #111827 100%)",
                          border: isForecast ? "2px dashed #6b7280" : "none",
                          boxShadow: isForecast ? "none" : "0 -4px 12px rgba(0, 0, 0, 0.2)",
                          borderRadius: "2px 2px 0 0",
                        }}
                      >
                        {/* 棒の上部ハイライト */}
                        {!isForecast && (
                          <div 
                            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 年度ラベル - 全ての年度で同じ高さを確保 */}
                  <div className="mt-3 text-center h-6 flex items-center justify-center">
                    <div 
                      className="text-sm font-bold text-gray-900"
                      style={{ fontFamily: "monospace" }}
                    >
                      {year}年
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 凡例 */}
        {hasForecast && (
          <div className="flex items-center justify-center gap-6 mb-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4"
                style={{ background: "linear-gradient(180deg, #374151 0%, #111827 100%)" }}
              />
              <span>実績</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4"
                style={{ 
                  background: "repeating-linear-gradient(45deg, #9ca3af 0px, #9ca3af 4px, #d1d5db 4px, #d1d5db 8px)",
                  border: "1px dashed #6b7280",
                }}
              />
              <span>予想</span>
            </div>
          </div>
        )}

        {/* 数値カード（KPI） - 高さ統一 */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8">
          {/* 査定数カード */}
          <div 
            className="bg-gray-50 border-2 border-gray-300 p-2 md:p-4 text-center relative flex flex-col justify-between"
            style={{ 
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
              minHeight: "120px",
            }}
          >
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 flex items-center justify-center mx-auto mb-2">
              <Users size={16} className="text-gray-700 md:w-5 md:h-5" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div 
                className="font-bold text-gray-900 leading-none"
                style={{ 
                  fontSize: "clamp(1rem, 4vw, 1.5rem)",
                  fontFamily: "monospace",
                }}
              >
                {kpiValues.assessmentCount}
              </div>
              <div className="text-xs text-gray-500 mt-1 font-medium">査定数</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {latestMetric?.year}年
            </div>
          </div>

          {/* 成約数カード */}
          <div 
            className="bg-gray-50 border-2 border-gray-300 p-2 md:p-4 text-center relative flex flex-col justify-between"
            style={{ 
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
              minHeight: "120px",
            }}
          >
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 flex items-center justify-center mx-auto mb-2">
              <FileCheck size={16} className="text-gray-700 md:w-5 md:h-5" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div 
                className="font-bold text-gray-900 leading-none"
                style={{ 
                  fontSize: "clamp(1rem, 4vw, 1.5rem)",
                  fontFamily: "monospace",
                }}
              >
                {kpiValues.contractCount}
              </div>
              <div className="text-xs text-gray-500 mt-1 font-medium">成約数</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {latestMetric?.year}年
            </div>
          </div>

          {/* 成約率カード */}
          <div 
            className="bg-gray-50 border-2 border-gray-300 p-2 md:p-4 text-center relative flex flex-col justify-between"
            style={{ 
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
              minHeight: "120px",
            }}
          >
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={16} className="text-gray-700 md:w-5 md:h-5" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div 
                className="font-bold text-gray-900 leading-none whitespace-nowrap"
                style={{ 
                  fontSize: "clamp(1rem, 4vw, 1.5rem)",
                  fontFamily: "monospace",
                }}
              >
                {kpiValues.contractRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1 font-medium">成約率</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {latestMetric?.year}年
            </div>
          </div>
        </div>

        {/* ステータス表示 */}
        <div className="mt-6 pt-4 flex items-center justify-center gap-2 border-t border-gray-200">
          <div className="w-2 h-2 bg-green-500 animate-pulse" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
          <span className="text-xs text-gray-500 font-medium tracking-wider">
            データ更新中
          </span>
        </div>
      </div>
    </div>
  );
}
