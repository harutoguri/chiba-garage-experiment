import Layout from "@/components/Layout";
import { COMPANY_INFO } from "../../../shared/const";
import { useEffect, useState, useCallback, useRef } from "react";
import { Instagram, TrendingUp, Car, Star, MessageCircle, Newspaper, ExternalLink, Calendar, Image as ImageIcon, Phone, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

// デフォルトのスライドショー用画像リスト（データベースにデータがない場合のフォールバック）
const DEFAULT_SLIDESHOW_MEDIA = [
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/NOZyJuEFlboyIbSu.jpg" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/AuyyMTACDsBTTXJE.png" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/sUeFpfmHPOsALfEJ.jpg" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/VtVnQOXTVxeknvlV.png" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/OnlAXXxwULpcCJvU.jpg" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/dNeYgLumKkihUQMb.png" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/cPOTZhGkSyBYcSyG.png" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/KSPPpakWxMAnBnAF.png" },
  { type: 'image' as const, url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/ioTsCemOdDJGbmeE.png" },
];

// サンプル買取実績（データベースに実績がない場合のフォールバック）
const SAMPLE_PURCHASE_RECORDS = [
  {
    id: 1,
    vehicleName: "トヨタ ヴィッツ",
    purchasePrice: 350000,
    priceDisplay: "35万円",
    comment: "他社より5万円高く買取！",
    imageUrl: null,
  },
  {
    id: 2,
    vehicleName: "ホンダ フィット",
    purchasePrice: 480000,
    priceDisplay: "48万円",
    comment: "走行10万km超でも高額買取",
    imageUrl: null,
  },
  {
    id: 3,
    vehicleName: "日産 ノート",
    purchasePrice: 550000,
    priceDisplay: "55万円",
    comment: "即日現金払い対応",
    imageUrl: null,
  },
  {
    id: 4,
    vehicleName: "スズキ ワゴンR",
    purchasePrice: 280000,
    priceDisplay: "28万円",
    comment: "軽自動車も高価買取！",
    imageUrl: null,
  },
  {
    id: 5,
    vehicleName: "ダイハツ タント",
    purchasePrice: 420000,
    priceDisplay: "42万円",
    comment: "人気の軽自動車を高額査定",
    imageUrl: null,
  },
  {
    id: 6,
    vehicleName: "マツダ デミオ",
    purchasePrice: 380000,
    priceDisplay: "38万円",
    comment: "コンパクトカーも大歓迎",
    imageUrl: null,
  },
];

// 動画スライドコンポーネント
const VideoSlideItem = ({ 
  videoUrl, 
  isActive, 
  onVideoEnd,
  onVideoError 
}: { 
  videoUrl: string; 
  isActive: boolean;
  onVideoEnd: () => void;
  onVideoError: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && !hasError) {
      // アクティブになったら再生開始
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Video autoplay failed:', error);
          // 自動再生失敗時はユーザー操作を待つ
          const handleInteraction = () => {
            video.play().catch(() => {});
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
          };
          document.addEventListener('click', handleInteraction, { once: true });
          document.addEventListener('touchstart', handleInteraction, { once: true });
        });
      }
    } else {
      video.pause();
    }
  }, [isActive, hasError]);

  const handleError = () => {
    setHasError(true);
    onVideoError();
  };

  const handleEnded = () => {
    onVideoEnd();
  };

  if (hasError) {
    return null; // エラー時は何も表示しない（次のスライドへ）
  }

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
        isActive ? "opacity-100 z-10" : "opacity-0 z-0"
      }`}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        autoPlay={isActive}
        className="w-full h-full object-cover"
        onEnded={handleEnded}
        onError={handleError}
      />
    </div>
  );
};

// 画像スライドコンポーネント
const ImageSlideItem = ({ imageUrl, isActive }: { imageUrl: string; isActive: boolean }) => {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
        isActive ? "opacity-100 z-10" : "opacity-0 z-0"
      }`}
    >
      <img
        src={imageUrl}
        alt=""
        className="w-full h-full object-cover"
      />
    </div>
  );
};

// 買取実績カードコンポーネント
const PurchaseRecordCard = ({ record }: { record: { id: number; vehicleName: string; purchasePrice: number; priceDisplay?: string | null; comment?: string | null; imageUrl?: string | null } }) => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-green-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">買取実績</span>
        </div>
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          ))}
        </div>
      </div>
      
      <h3 className="text-lg font-bold mb-2 line-clamp-1">{record.vehicleName}</h3>
      
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black text-green-400">{record.priceDisplay || `${(record.purchasePrice / 10000).toLocaleString()}万円`}</span>
        <span className="text-sm text-gray-400">で買取</span>
      </div>
      
      {record.comment && (
        <div className="bg-green-500/20 rounded-lg px-3 py-2 border border-green-500/30">
          <p className="text-sm text-green-300 font-medium">{record.comment}</p>
        </div>
      )}
    </div>
  );
};

// GBP投稿カードコンポーネント
interface GBPPost {
  name: string;
  summary: string;
  createTime: string;
  searchUrl: string;
  media?: Array<{
    mediaFormat: string;
    googleUrl: string;
  }>;
}

const GBPPostCard = ({ post }: { post: GBPPost }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // 日付をJSTでフォーマット
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo'
      });
    } catch {
      return '';
    }
  };

  // 本文を40〜60文字で切り詰め
  const truncateSummary = (text: string, maxLength: number = 60) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const imageUrl = post.media?.[0]?.googleUrl;

  return (
    <a
      href={post.searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100"
    >
      {/* 画像部分 */}
      <div className="relative h-48 bg-gray-100">
        {imageUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-gray-300 animate-pulse" />
              </div>
            )}
            <img
              src={imageUrl}
              alt=""
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
            <Newspaper className="w-16 h-16 text-blue-300" />
          </div>
        )}
      </div>
      
      {/* コンテンツ部分 */}
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(post.createTime)}</span>
        </div>
        
        <p className="text-gray-800 font-medium leading-relaxed line-clamp-3">
          {truncateSummary(post.summary)}
        </p>
        
        <div className="mt-4 flex items-center gap-2 text-blue-600 text-sm font-medium">
          <span>詳しく見る</span>
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </a>
  );
};

export default function About() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // スライドショーメディアをAPIから取得
  const { data: slideshowMediaData } = trpc.slideshowMedia.list.useQuery();
  
  // 買取実績をAPIから取得
  const { data: purchaseRecords } = trpc.purchaseRecords.list.useQuery();
  
  // 手動入力の最新情報をAPIから取得（フォールバック用）
  const { data: newsItems } = trpc.newsItems.list.useQuery();
  
  // GBPの最新投稿を取得
  const { data: gbpData, isLoading: gbpLoading } = trpc.gbp.localPosts.useQuery({ limit: 5 });
  
  // データベースにメディアがあればそれを使用、なければデフォルトを表示
  const slideshowMedia = slideshowMediaData && slideshowMediaData.length > 0 
    ? slideshowMediaData.map(m => ({ type: m.type as 'image' | 'video', url: m.url }))
    : DEFAULT_SLIDESHOW_MEDIA;
  
  // データベースに実績があればそれを使用、なければサンプルを表示
  const displayRecords = purchaseRecords && purchaseRecords.length > 0 
    ? purchaseRecords 
    : SAMPLE_PURCHASE_RECORDS;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slideshowMedia.length);
  }, [slideshowMedia.length]);

  // 動画終了時のハンドラ
  const handleVideoEnd = useCallback(() => {
    setIsVideoPlaying(false);
    handleNext();
  }, [handleNext]);

  // 動画エラー時のハンドラ（次のスライドへスキップ）
  const handleVideoError = useCallback(() => {
    setIsVideoPlaying(false);
    handleNext();
  }, [handleNext]);

  // 現在のスライドが動画かどうかを判定
  useEffect(() => {
    if (slideshowMedia.length === 0) return;
    
    const currentMedia = slideshowMedia[currentIndex];
    if (currentMedia?.type === 'video') {
      setIsVideoPlaying(true);
      // 動画の場合は自動スライドを停止
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    } else {
      setIsVideoPlaying(false);
    }
  }, [currentIndex, slideshowMedia]);

  // 画像の場合は5秒ごとに自動スライド
  useEffect(() => {
    if (slideshowMedia.length === 0) return;
    
    const currentMedia = slideshowMedia[currentIndex];
    if (currentMedia?.type !== 'video') {
      autoSlideTimerRef.current = setInterval(handleNext, 5000);
    }
    
    return () => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    };
  }, [handleNext, currentIndex, slideshowMedia]);

  // currentIndexがslideshowMediaの範囲外になった場合にリセット
  useEffect(() => {
    if (slideshowMedia.length > 0 && currentIndex >= slideshowMedia.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, slideshowMedia.length]);

  // GBP投稿があるかどうか
  const hasGBPPosts = gbpData?.posts && gbpData.posts.length > 0;
  // 手動入力の最新情報があるかどうか
  const hasManualNews = newsItems && newsItems.length > 0;

  return (
    <Layout>
      <div className="min-h-screen bg-white text-black pb-32 relative">
        {/* Hero Section with Slideshow */}
        <div className="relative h-[60vh] w-full overflow-hidden bg-black">
          {/* Background Slideshow - 画像と動画に対応 */}
          <div className="absolute inset-0 z-0">
            {slideshowMedia.map((media, index) => (
              media.type === 'video' ? (
                <VideoSlideItem
                  key={`${media.url}-${index}`}
                  videoUrl={media.url}
                  isActive={index === currentIndex}
                  onVideoEnd={handleVideoEnd}
                  onVideoError={handleVideoError}
                />
              ) : (
                <ImageSlideItem
                  key={`${media.url}-${index}`}
                  imageUrl={media.url}
                  isActive={index === currentIndex}
                />
              )
            ))}
          </div>
          
          {/* Hero Content */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold uppercase tracking-widest mb-6">
              About Us
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-black mb-8 leading-tight tracking-tight text-white drop-shadow-lg">
              会社概要
            </h1>
            <p className="text-lg md:text-xl text-gray-100 font-sans font-medium leading-relaxed max-w-2xl mx-auto drop-shadow-md">
              地域に根ざし、全国へ届ける。<br/>
              チバガレージの信頼と実績。
            </p>
          </div>
          
          {/* Overlay for better text visibility */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
          
          {/* Slide indicators */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex gap-2">
            {slideshowMedia.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-white w-6"
                    : "bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`スライド ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
          {/* Company Info Card */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-6 md:p-10 shadow-xl border border-gray-100">
            <div className="flex items-center gap-4 mb-8 md:mb-10">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-lg">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/pUMVMHPhHgqzAeli.jpg" alt="チバガレージ" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold">{COMPANY_INFO.name}</h2>
                <p className="text-gray-500 text-sm md:text-base">CHIBA GARAGE</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">代表者</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">{COMPANY_INFO.representative}</div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">所在地</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">
                  <p className="break-words">〒989-4416</p>
                  <p className="break-words">宮城県大崎市田尻中目字下田20-22</p>
                  <a
                    href="https://www.google.com/maps/place/%E3%83%81%E3%83%90%E3%82%AC%E3%83%AC%E3%83%BC%E3%82%B8/@38.5999395,141.0189689,17z/data=!4m6!3m5!1s0x5f89139b3581c7d3:0xceedc7a817f521c4!8m2!3d38.5999395!4d141.0189689!16s%2Fg%2F11s7d2y524"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <span>Googleマップで見る</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">電話番号</div>
                <div className="md:col-span-2">
                  <a href={`tel:${COMPANY_INFO.phone}`} className="text-base md:text-lg font-medium text-blue-600 hover:text-blue-700">
                    {COMPANY_INFO.phone}
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">FAX</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">{COMPANY_INFO.fax}</div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">メール</div>
                <div className="md:col-span-2">
                  <a href={`mailto:${COMPANY_INFO.email}`} className="text-base md:text-lg font-medium text-blue-600 hover:text-blue-700">
                    {COMPANY_INFO.email}
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">LINE</div>
                <div className="md:col-span-2">
                  <a
                    href={COMPANY_INFO.lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-base md:text-lg font-medium text-[#06C755] hover:text-[#05b34c]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                    </svg>
                    <span>お友だち追加はこちら</span>
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">Instagram</div>
                <div className="md:col-span-2">
                  <a
                    href={COMPANY_INFO.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-base md:text-lg font-medium text-pink-600 hover:text-pink-700"
                  >
                    <Instagram className="w-5 h-5" />
                    <span>@kumachan3855</span>
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">営業時間</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">{COMPANY_INFO.businessHours}</div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 py-4 md:py-6 border-b border-gray-200">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">定休日</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">{COMPANY_INFO.closedDays}</div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4 md:pt-6">
                <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider">許認可</div>
                <div className="md:col-span-2 text-base md:text-lg font-medium">
                  <p>古物商許可</p>
                  <p>宮城県公安委員会</p>
                  <p>第221010003293号</p>
                </div>
              </div>
            </div>
          </div>

          {/* 最新情報セクション（GBP連携） */}
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <Newspaper className="w-8 h-8 text-blue-600" />
              <h2 className="text-2xl md:text-3xl font-display font-bold">最新情報</h2>
            </div>
            
            {gbpLoading ? (
              // ローディング中
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 animate-pulse">
                    <div className="h-48 bg-gray-200" />
                    <div className="p-5">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hasGBPPosts ? (
              // GBP投稿がある場合
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gbpData.posts.map((post: GBPPost, index: number) => (
                  <GBPPostCard key={post.name || index} post={post} />
                ))}
              </div>
            ) : hasManualNews ? (
              // GBP投稿がなく、手動入力の最新情報がある場合
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
                <ul className="divide-y divide-gray-200">
                  {newsItems.map((item) => (
                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between group hover:bg-gray-50 -mx-4 px-4 py-2 rounded-lg transition-colors"
                      >
                        <span className="text-base md:text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </span>
                        <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              // 最新情報がない場合
              <div className="bg-gray-50 rounded-3xl p-8 text-center">
                <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">現在、最新情報はありません</p>
              </div>
            )}
          </div>

          {/* 買取実績セクション */}
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <h2 className="text-2xl md:text-3xl font-display font-bold">買取実績</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayRecords.slice(0, 6).map((record) => (
                <PurchaseRecordCard key={record.id} record={record} />
              ))}
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">
                ※ 上記は買取実績の一例です。車種・年式・状態により査定額は異なります。
              </p>
            </div>
          </div>

          {/* お問い合わせ誘導ボックス（CTA） */}
          <div className="mt-16">
            <div className="bg-gradient-to-r from-black to-gray-900 rounded-3xl p-8 md:p-12 text-center text-white shadow-2xl">
              <h3 className="text-2xl md:text-3xl font-display font-black mb-4">
                あなたの愛車も高価買取！
              </h3>
              <p className="text-gray-300 mb-8 text-lg">
                まずはお気軽にご相談ください。<br/>
                LINEで簡単査定、出張査定も無料です。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={COMPANY_INFO.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#06C755] text-white rounded-xl hover:bg-[#05b34c] transition-colors font-bold text-lg"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  LINEで無料査定
                </a>
                <a
                  href={`tel:${COMPANY_INFO.phone.replace(/-/g, "")}`}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-xl hover:bg-gray-100 transition-colors font-bold text-lg"
                >
                  <Phone className="w-6 h-6" />
                  電話で相談
                </a>
              </div>
            </div>
          </div>

          {/* お客様のお声セクション（Googleマップ口コミ抜粋） */}
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <MessageCircle className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500 font-medium">Googleマップクチコミより一部抜粋</p>
                <h2 className="text-2xl md:text-3xl font-display font-bold">お客様のお声</h2>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 md:p-8 border border-purple-100">
              {/* Googleマップ口コミ5件表示 */}
              <div className="space-y-4">
                {/* 口コミ1 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">宮城県 O様</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">30プリウスを購入、激安なのに状態めちゃめちゃいいです(過走行)オイル交換もしてもらい満足です オーナーの対応も完璧これからも、車関係でお邪魔します( 'ω')</p>
                </div>
                
                {/* 口コミ2 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">宮城県 P様</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">先日は急に伺った際に、対応して頂きありがとうございました！ 個人店でありながら、綺麗に整頓されているガレージが印象的です。 車も珍しい車に出会えて良かったです！</p>
                </div>
                
                {/* 口コミ3 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">宮城県 Y様</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">この前オーナーの方にローンで車を探して貰い、下取りをしてもらいました！ 値がつかないと思っていたので助かりました(*^^*) 対応もスムーズでとても心強かったです✨️ ありがとうございました( ˙ᵕ˙ 🙏)</p>
                </div>
                
                {/* 口コミ4 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">宮城県 K様</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">先日、使用していたアクアを何社か回ったのち買取でお願いすることになりました。金額が1番高買ったのでステップワゴンの買取もついでにお願いすることになりました！ありがとうございました😭またよろしくお願いします(^^)</p>
                </div>
                
                {/* 口コミ5 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">宮城県 H様</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">車についてわかりやすく教えてくさり、親身になり、対応してくさいました。 突然の訪問でも、嫌な顔せず嬉しかったです。ありがとうございました。</p>
                </div>
              </div>
              
              {/* 注釈 */}
              <p className="text-xs text-gray-400 mt-4 text-center">※掲載内容はGoogleマップに投稿されたクチコミの一部を抜粋しています</p>
              
              {/* Googleマップで口コミを見るボタン */}
              <div className="mt-6 text-center">
                <a
                  href="https://www.google.com/maps/place/%E3%83%81%E3%83%90%E3%82%AC%E3%83%AC%E3%83%BC%E3%82%B8/@38.5999395,141.0189689,17z/data=!4m8!3m7!1s0x5f89139b3581c7d3:0xceedc7a817f521c4!8m2!3d38.5999395!4d141.0189689!9m1!1b1!16s%2Fg%2F11s7d2y524"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all font-medium"
                >
                  <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                  <span>実際の最新クチコミはGoogleマップでご確認ください</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
          
          {/* 会社所在地セクション */}
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <Car className="w-8 h-8 text-blue-600" />
              <h2 className="text-2xl md:text-3xl font-display font-bold">会社所在地</h2>
            </div>
            
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm">
              <div className="w-full overflow-hidden rounded-2xl">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3115.5!2d141.0189689!3d38.5999395!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5f89139b3581c7d3%3A0xceedc7a817f521c4!2z44OB44OQ44Ks44Os44O844K4!5e0!3m2!1sja!2sjp!4v1700000000000!5m2!1sja!2sjp"
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="チバガレージ 所在地"
                  className="w-full"
                ></iframe>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-600">〒989-4416</p>
                <p className="text-gray-600">宮城県大崎市田尻中目字下田20-22</p>
              </div>
              <div className="mt-4 text-center text-sm text-gray-500">
                <p>※ご来場の方は事前にお電話ください。</p>
                <p>※少人数のため、不在の場合がございます。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
