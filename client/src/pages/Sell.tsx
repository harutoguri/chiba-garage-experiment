import Layout from "@/components/Layout";
import { COMPANY_INFO } from "../../../shared/const";
import { Button } from "@/components/ui/button";
import { Check, X as XIcon, Truck } from "lucide-react";
import { Link } from "wouter";

export default function Sell() {
  return (
    <Layout>
      <div className="min-h-screen bg-white text-black pt-24 pb-32 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Hero Section */}
          <div className="mb-20 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">
              Sales Service
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-black mb-8 leading-tight tracking-tight [text-wrap:balance]">
              {COMPANY_INFO.catchphrase.sell}
            </h1>
            <p className="text-lg md:text-xl text-gray-500 font-sans font-medium leading-relaxed [text-wrap:balance]">
              全国最安値を目指す「現状販売」と、<br className="hidden md:block"/>
              安心の「保証付販売」。選べる2つのスタイル。
            </p>
          </div>

          {/* Comparison Table */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {/* Plan A: Current State - Now Dark Themed */}
            <div className="bg-black text-white p-10 rounded-3xl relative overflow-hidden shadow-2xl transition-transform hover:-translate-y-1 duration-300">
              <div className="absolute top-6 right-6 bg-white text-black text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-full">
                Best Price
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">現状販売コース</h3>
              <p className="text-gray-400 mb-10 font-sans text-sm h-auto md:h-10 leading-relaxed [text-wrap:balance]">
                整備やクリーニングを省き、車両本来の価格のみで提供。とにかく安く乗りたい方へ。
              </p>
              
              <div className="space-y-5 mb-10 font-sans">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">車両価格</span>
                  <span className="font-bold text-lg text-white">全国最安値級</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">納車前整備</span>
                  <span className="text-gray-600"><XIcon size={20} /></span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">クリーニング</span>
                  <span className="text-gray-600"><XIcon size={20} /></span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">保証</span>
                  <span className="text-gray-600"><XIcon size={20} /></span>
                </div>
              </div>
              
              <Button 
                className="w-full bg-white text-black hover:bg-gray-200 rounded-full py-6 font-bold transition-all"
                asChild
              >
                <Link href="/">在庫一覧を見る</Link>
              </Button>
            </div>

            {/* Plan B: Warranty - Dark Themed (Consistent) */}
            <div className="bg-black text-white p-10 rounded-3xl relative shadow-2xl transition-transform hover:-translate-y-1 duration-300">
              <div className="absolute top-6 right-6 bg-[#06C755] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-full">
                Recommended
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">保証付販売コース</h3>
              <p className="text-gray-400 mb-10 font-sans text-sm h-auto md:h-10 leading-relaxed [text-wrap:balance]">
                徹底的な整備とクリーニングを実施。安心してお乗りいただける標準的なプラン。
              </p>
              
              <div className="space-y-5 mb-10 font-sans">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">車両価格</span>
                  <span className="font-bold text-lg text-white">適正価格</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">納車前整備</span>
                  <span className="text-[#06C755]"><Check size={20} /></span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">クリーニング</span>
                  <span className="text-[#06C755]"><Check size={20} /></span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400 text-sm font-bold">保証</span>
                  <span className="text-[#06C755]"><Check size={20} /></span>
                </div>
              </div>
              
              <Button 
                className="w-full bg-[#06C755] text-white hover:bg-[#05b54c] rounded-full py-6 font-bold shadow-lg transition-transform hover:scale-105"
                onClick={() => window.open(COMPANY_INFO.lineUrl, '_blank')}
              >
                詳細を問い合わせる
              </Button>
            </div>
          </div>

          {/* ご納車について Section */}
          <div className="bg-gray-50 rounded-3xl p-10 mb-8">
            <h3 className="text-xl font-display font-bold mb-6 text-center">ご納車について</h3>
            <div className="flex items-start gap-4 max-w-2xl mx-auto">
              <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0">
                <Truck size={20} />
              </div>
              <p className="text-gray-500 font-sans text-sm leading-relaxed">
                ご納車の際は、弊社の現地エージェントが、場所によりますがご指定の場所・ご自宅までお迎えに上がります。
              </p>
            </div>
          </div>

          {/* Auto Loan Info */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-6 md:p-10 text-center text-white mb-8">
            <h3 className="text-xl font-display font-bold mb-4">オートローンでの購入も可能</h3>
            <p className="font-sans leading-relaxed max-w-2xl mx-auto text-sm text-blue-100">
              現金一括だけでなく、<span className="font-bold text-white">オートローン（分割払い）</span>での購入も承っております。月々のお支払いで、お客様のペースに合わせた購入が可能です。
            </p>
            <p className="text-xs text-blue-200 mt-3">※審査がございます。詳細はLINEまたはお電話にてお問い合わせください。</p>
            <Button 
              className="mt-6 bg-white text-blue-700 hover:bg-blue-50 rounded-full px-8 py-3 font-bold shadow-lg transition-transform hover:scale-105"
              onClick={() => window.open(COMPANY_INFO.lineUrl, '_blank')}
            >
              ローンについて相談する
            </Button>
          </div>

          {/* Delivery Info */}
          <div className="bg-gray-50 rounded-3xl p-10 mb-8 text-center">
            <h3 className="text-xl font-display font-bold mb-4">全国配送対応</h3>
            <p className="text-gray-500 font-sans leading-relaxed max-w-2xl mx-auto text-sm [text-wrap:balance]">
              ご来店いただかなくても、LINEでの商談・契約が可能です。<br/>
              入金確認後、ご自宅まで陸送手配いたします。<br/>
              <span className="text-xs opacity-60 mt-3 block">※陸送費用は別途お見積もりとなります。</span>
            </p>
          </div>

          {/* エージェント注釈 */}
          <div className="bg-gray-100 rounded-2xl p-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-bold">※エージェントとは</span><br/>
              チバガレージの基準を満たした提携パートナーです。現地での査定・撮影・回収・ご納車サポートを担当し、最終の金額決定・契約管理は代表が行います。もちろん代表が全て対応させていただくケースもございます。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
