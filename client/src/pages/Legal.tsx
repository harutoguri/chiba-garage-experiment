import Layout from "@/components/Layout";

export default function Legal() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pt-24 pb-32">
        <div className="container max-w-4xl mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-8">特定商取引法に基づく表記</h1>
          
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-8">
            <dl className="divide-y divide-gray-200">
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  販売業者
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  チバガレージ
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  運営責任者
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  千葉 遥斗
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  所在地
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  <span className="inline-block">〒989-4416</span>{" "}
                  <span className="inline-block">宮城県大崎市田尻中目字下田20-22</span>
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  電話番号
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  080-2806-5360
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  メールアドレス
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2 break-all">
                  tiba.raasy3180@icloud.com
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  販売価格
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  各車両詳細ページに表示
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  支払方法
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  現金、銀行振込、オートローン
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  商品の引き渡し時期
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  契約手続き及び代金支払い完了後、約4週間以内に納車
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  返品・キャンセルについて
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  中古車の特性上、契約成立後の自己都合によるキャンセル・返品・交換は一切お受けできません。必ず現車確認（動画・画像含む）の上でご契約ください。
                </dd>
              </div>
              
              <div className="py-4 md:py-6 md:grid md:grid-cols-3 md:gap-4">
                <dt className="text-sm font-semibold text-gray-700 mb-2 md:mb-0">
                  古物商許可番号
                </dt>
                <dd className="text-sm text-gray-600 md:col-span-2">
                  <span className="inline-block">宮城県公安委員会</span>{" "}
                  <span className="inline-block">古物商許可</span>{" "}
                  <span className="inline-block">第221190001219号</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Layout>
  );
}
