import Layout from "@/components/Layout";
import { COMPANY_INFO } from "../../../shared/const";
import { Button } from "@/components/ui/button";
import { Check, DollarSign, Zap, Truck, CreditCard, UserCheck } from "lucide-react";
import BusinessMetricsChart from "@/components/BusinessMetricsChart";

export default function Buy() {
  return (
    <Layout>
      <div className="min-h-screen bg-white text-black pt-24 pb-32 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Hero Section */}
          <div className="mb-20 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">
              Purchase Service
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-black mb-8 leading-tight tracking-tight [text-wrap:balance]">
              {COMPANY_INFO.catchphrase.buy}
            </h1>
            <p className="text-lg md:text-xl text-gray-500 font-sans font-medium leading-relaxed max-w-2xl mx-auto [text-wrap:balance]">
              100万円以下の車両の買取査定では弊社の本領が発揮されます。<br className="hidden md:block"/>
              100万円以下の車両ではフルスイングでの買取をさせていただいております。
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="p-8 bg-gray-50 rounded-2xl hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-6">
                <DollarSign size={24} />
              </div>
              <h3 className="text-xl font-display font-bold mb-3">圧倒的高価買取</h3>
              <p className="text-gray-500 font-sans text-sm leading-relaxed [text-wrap:balance]">
                徹底的なコストカットにより、浮いた分をお客様への買取価格に還元。他社の査定票をお持ちください。
              </p>
            </div>
            <div className="p-8 bg-gray-50 rounded-2xl hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-display font-bold mb-3">即日現金化</h3>
              <p className="text-gray-500 font-sans text-sm leading-relaxed [text-wrap:balance]">
                書類が揃っていれば、その場で現金一括お支払い。面倒な振込待ち時間はありません。
              </p>
            </div>
            <div className="p-8 bg-gray-50 rounded-2xl hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-6">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-display font-bold mb-3">どんな車でも</h3>
              <p className="text-gray-500 font-sans text-sm leading-relaxed [text-wrap:balance]">
                中古車、二輪車、不動車、事故車。どんな状態でも価値を見出します。まずはLINEで写真を送るだけ。
              </p>
            </div>
          </div>

          {/* お引取りについて Section */}
          <div className="bg-gray-50 rounded-3xl p-10 mb-10">
            <h3 className="text-2xl font-display font-bold mb-8 text-center">お引取りについて</h3>
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0">
                  <Truck size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">無料出張引取り</h4>
                  <p className="text-gray-500 font-sans text-sm leading-relaxed">
                    お引取りの際は、弊社の現地エージェントが、場所によりますがご指定の場所・ご自宅まで無料でお引き取りに伺います（車検付きのお車に限ります）。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">査定・お引取り対応</h4>
                  <p className="text-gray-500 font-sans text-sm leading-relaxed">
                    査定・お引取りは、現地エージェントが対応いたします。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">お支払いについて</h4>
                  <p className="text-gray-500 font-sans text-sm leading-relaxed">
                    お支払いを現金ご希望の方は、お早めにエージェントへお伝えください。最短で即日即決・即お支払いも可能です。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 出張査定 Section */}
          <div className="bg-gray-50 rounded-3xl p-10 mb-10 text-center">
            <h3 className="text-2xl font-display font-bold mb-4">出張査定も対応</h3>
            <p className="text-gray-500 font-sans leading-relaxed max-w-2xl mx-auto [text-wrap:balance]">
              お忙しい方、車が動かない方もご安心ください。<br/>
              <span className="font-bold text-black">宮城県内どこでも出張査定にお伺いします。</span><br/>
              その場で査定、その場で現金お支払いも可能です。<br/>
              <span className="text-xs opacity-60 mt-3 block">※出張費用は無料です。お気軽にご相談ください。</span>
            </p>
          </div>

          {/* エージェント注釈 */}
          <div className="bg-gray-100 rounded-2xl p-6 mb-20">
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-bold">※エージェントとは</span><br/>
              チバガレージの基準を満たした提携パートナーです。現地での査定・撮影・回収・ご納車サポートを担当し、最終の金額決定・契約管理は代表が行います。もちろん代表が全て対応させていただくケースもございます。
            </p>
          </div>

          {/* ビジネス指標グラフセクション */}
          <BusinessMetricsChart />

          {/* CTA Section */}
          <div className="bg-black text-white rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 [text-wrap:balance]">
                まずはLINEで簡易査定
              </h2>
              <p className="text-gray-400 mb-10 font-sans">
                車検証と車両の写真を送るだけで、概算の買取金額をお伝えします。
              </p>
              <Button 
                className="bg-white text-black hover:bg-gray-200 text-base px-10 py-6 rounded-full font-bold w-full md:w-auto shadow-lg transition-transform hover:scale-105"
                onClick={() => window.open(COMPANY_INFO.lineUrl, '_blank')}
              >
                LINEで査定を申し込む
              </Button>
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
