import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { VideoWarmup } from "./components/VideoWarmup";
import Home from "./pages/Home";
import { trpc } from "@/lib/trpc";
import { useEffect, lazy, Suspense } from "react";

// ★ v68: Home以外は React.lazy で code split
// dev: Viteが各モジュールをオンデマンドでトランスフォーム → 初回チャンクから除外
// prod: Rollupが自動的にchunk分割 → 初回バンドルサイズ削減
// AdminDashboard(582KB) + Buy + Sell + About + Consignment + Legal + VideoDebug + NotFound
// → Home表示に不要な巨大モジュールを遅延ロード
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Buy = lazy(() => import("./pages/Buy"));
const Sell = lazy(() => import("./pages/Sell"));
const About = lazy(() => import("./pages/About"));
const Consignment = lazy(() => import("./pages/Consignment"));
const Legal = lazy(() => import("./pages/Legal"));
const VideoDebug = lazy(() => import("./pages/VideoDebug"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// analytics は本番ビルドのみ有効（DEVでは完全スキップ）
const ANALYTICS_ENABLED = import.meta.env.PROD;

// ★ v86-diag: 診断ヘルパー
const _pd = (msg: string) => { try { (window as any).__pd?.(msg); } catch {} };

// ★ v86-diag2: Suspense fallback 検知コンポーネント
function SuspenseFallbackDetector() {
  _pd('⚠ SUSPENSE FALLBACK ACTIVE — children suspended!');
  return null;
}

function Router() {
  const [location] = useLocation();
  _pd(`Router render loc="${location}"`);
  const recordViewMutation = trpc.analytics.recordView.useMutation();

  // ページビューを記録（本番のみ・管理画面とデバッグページは除外）
  // 3秒遅延: 初回 HLS attach と DB 競合させない
  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    if (location.startsWith('/admin') || location.startsWith('/debug')) return;
    const timer = setTimeout(() => {
      recordViewMutation.mutate({ path: location });
    }, 3000);
    return () => clearTimeout(timer);
  }, [location]);

  _pd(`Router Switch: Home=${typeof Home} path="${location}"`);
  return (
    <Suspense fallback={<SuspenseFallbackDetector />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/consignment"} component={Consignment} />
        <Route path={"/buy"} component={Buy} />
        <Route path={"/sell"} component={Sell} />
        <Route path={"/about"} component={About} />
        <Route path={"/admin"} component={AdminDashboard} />
        <Route path={"/legal"} component={Legal} />
        <Route path={"/debug/video"} component={VideoDebug} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  _pd('App render');
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          {/* 動画デコーダーの事前初期化（ページ読み込み直後に実行） */}
          <VideoWarmup />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
