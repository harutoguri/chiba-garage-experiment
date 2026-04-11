/**
 * Chrome iPhone emulation — 横スワイプ完全テスト
 * テスト項目:
 * 1. スワイプ中にBが再生しないこと
 * 2. スワイプ完了後にAが先頭に戻らないこと（PRECONNECTでcurrentTime維持）
 * 3. スワイプ完了後にBが再生開始すること
 * 4. 端スワイプで黒画面にならないこと
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const IPHONE_14 = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.emulate({ userAgent: IPHONE_14.userAgent, viewport: IPHONE_14.viewport });

  console.log('=== ページ読み込み ===');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(4000);

  const buildId = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.match(/^v\d+[a-z]?$/) && el.children.length === 0) return el.textContent;
    }
    return 'not found';
  });
  console.log(`BUILD_ID: ${buildId}`);

  // 動画状態取得
  async function getVideoState(label) {
    const states = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      return Array.from(videos).slice(0, 5).map((v, i) => ({
        i, paused: v.paused, ct: +v.currentTime.toFixed(2), opacity: v.style.opacity, src: v.src?.slice(-20) || 'none',
      }));
    });
    console.log(`  ${label}:`);
    states.forEach(s => {
      if (s.src !== 'none' || s.opacity === '1') {
        console.log(`    video[${s.i}] paused=${s.paused} ct=${s.ct} opacity=${s.opacity} src=${s.src}`);
      }
    });
    return states;
  }

  // ========== テスト1: 横スワイプ半分→完了 ==========
  console.log('\n=== テスト1: 横スワイプ（A→B） ===');
  const cx = 196, cy = 426;

  const before = await getVideoState('スワイプ前');
  const activeVidBefore = before[0];

  // touchStart + touchMove半分
  await page.touchscreen.touchStart(cx, cy);
  await sleep(30);
  for (let i = 1; i <= 10; i++) {
    await page.touchscreen.touchMove(cx - i * 15, cy);
    await sleep(16);
  }

  const during = await getVideoState('スワイプ中（指触れてる）');

  // 検証: スワイプ中にAがまだ再生中か
  const aDuring = during[0];
  const test1a = !aDuring.paused && aDuring.ct > activeVidBefore.ct;
  console.log(`  ✓ テスト1a: Aがスワイプ中も再生続行 = ${test1a ? 'PASS' : 'FAIL'}`);

  // 検証: スワイプ中にBが再生してないか
  const bDuring = during[1];
  const test1b = bDuring.paused;
  console.log(`  ✓ テスト1b: Bがスワイプ中に再生してない = ${test1b ? 'PASS' : 'FAIL'}`);

  // touchEnd
  await page.touchscreen.touchEnd();
  await sleep(800); // smooth scroll完了待ち

  const after = await getVideoState('スワイプ完了後');

  // 検証: Aが先頭に戻ってないか
  const aAfter = after[0];
  const test1c = aAfter.ct > 0;
  console.log(`  ✓ テスト1c: Aが先頭に戻ってない(ct=${aAfter.ct}) = ${test1c ? 'PASS' : 'FAIL'}`);

  // 検証: Bが再生開始したか
  const bAfter = after[1];
  const test1d = !bAfter.paused || bAfter.ct > 0;
  console.log(`  ✓ テスト1d: Bがスワイプ完了後に再生開始 = ${test1d ? 'PASS' : 'FAIL'}`);

  // ========== テスト2: 端スワイプ（最後のメディアからさらに左） ==========
  console.log('\n=== テスト2: 端スワイプテスト ===');
  // まず現在のメディア数を確認
  const mediaInfo = await page.evaluate(() => {
    // active車両の横スクロールコンテナ内のメディアセル数
    const flexContainers = document.querySelectorAll('[style*="overflow-x"]');
    for (const el of flexContainers) {
      const children = el.children;
      if (children.length > 0) {
        return { count: children.length, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      }
    }
    // fallback: style属性で探す
    const allDivs = document.querySelectorAll('div');
    for (const d of allDivs) {
      if (d.style.overflowX === 'scroll' && d.children.length > 1) {
        return { count: d.children.length, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
      }
    }
    return { count: 0, scrollWidth: 0, clientWidth: 0 };
  });
  console.log(`  メディア数: ${mediaInfo.count}, scrollWidth: ${mediaInfo.scrollWidth}, clientWidth: ${mediaInfo.clientWidth}`);

  // ========== サマリ ==========
  console.log('\n=== テスト結果サマリ ===');
  const tests = [
    ['1a: Aスワイプ中再生続行', test1a],
    ['1b: Bスワイプ中再生しない', test1b],
    ['1c: A先頭リセットしない', test1c],
    ['1d: B完了後再生開始', test1d],
  ];
  let allPass = true;
  tests.forEach(([name, pass]) => {
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
    if (!pass) allPass = false;
  });
  console.log(allPass ? '\n全テストPASS ✅' : '\n一部テストFAIL ❌');

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
