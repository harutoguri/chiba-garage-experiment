import { useState, useEffect } from "react";
import { COMPANY_INFO, NAV_LINKS } from "../../../shared/const";
import { Link, useLocation } from "wouter";
import { Phone, Instagram, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// 正式なLINEロゴコンポーネント
const LineIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>
);

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // ★ v88j-diag: ?debugBar=1 で下バー候補に識別色をつける（実機1回で正体特定）
  const _debugBar = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugBar") === "1";

  // ★ v88j: COLD中はbottom nav / FABを完全非表示（z-indexだけでは実機で漏れる）
  // __cold_poster が存在する間 = Brand Gate未解放 = COLD表示中
  const [coldActive, setColdActive] = useState(() => typeof document !== "undefined" && !!document.getElementById("__cold_poster"));
  useEffect(() => {
    if (!coldActive) return;
    // __cold_posterが消えたらcoldActive=false → nav/FAB表示
    const check = () => {
      if (!document.getElementById("__cold_poster")) {
        setColdActive(false);
      }
    };
    // MutationObserverでposter削除を検知
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    // 安全弁: 5秒後には必ず表示
    const t = setTimeout(() => setColdActive(false), 5000);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [coldActive]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-6 pointer-events-none mix-blend-difference text-white">
        <div className="flex justify-between items-start">
          <Link href="/" className="pointer-events-auto group">
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight leading-none select-none group-hover:opacity-70 transition-opacity">
              {COMPANY_INFO.name}
            </h1>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow relative z-0">
        {children}
      </main>

      {/* Floating Action Buttons (FAB) - Compact Style */}
      {/* 並び順: 電話→メール→LINE→Instagram（上から下） */}
      {/* ★ 候補B: FABボタン群 → v88j: COLD中は非表示。debugBar=1 で青枠 */}
      <div className="fixed bottom-20 right-3 z-50 flex flex-col gap-3" style={coldActive ? { display: "none" } : _debugBar ? { outline: "4px solid blue", background: "rgba(0,0,255,0.3)" } : undefined}>
        {/* 電話 */}
        <a
          href={`tel:${COMPANY_INFO.phone.replace(/-/g, "")}`}
          className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          aria-label="電話する"
        >
          <Phone size={20} />
        </a>
        {/* メール */}
        <a
          href={`mailto:${COMPANY_INFO.email}`}
          className="w-10 h-10 bg-gray-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          aria-label="メール"
        >
          <Mail size={20} />
        </a>
        {/* LINE */}
        <a
          href={COMPANY_INFO.lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 bg-[#06C755] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          aria-label="LINE"
        >
          <LineIcon size={20} />
        </a>
        {/* Instagram */}
        <a
          href={COMPANY_INFO.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          aria-label="Instagram"
        >
          <Instagram size={20} />
        </a>
      </div>

      {/* Bottom Navigation - flex:1 で完全均等配置（space-between禁止） */}
      {/* ★ 候補A: Layout bottom nav → v88j: COLD中は非表示。debugBar=1 で赤背景 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t border-gray-200 pb-[env(safe-area-inset-bottom)]" style={coldActive ? { display: "none" } : _debugBar ? { background: "rgba(255,0,0,0.8)" } : { background: "rgba(255,255,255,0.95)" }}>
        <div 
          className="h-12 w-full flex"
          style={{ gap: 0 }}
        >
          {NAV_LINKS.map((link) => {
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href}
                href={link.href}
                className={cn(
                  "h-12 transition-all duration-300",
                  isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
                )}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className={cn(
                  "text-[9px] font-bold tracking-tight text-center leading-tight whitespace-nowrap",
                  isActive ? "font-black" : "font-medium"
                )}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
