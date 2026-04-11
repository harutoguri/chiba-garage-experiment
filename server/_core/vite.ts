import express, { type Express } from "express";
import fs from "fs";
import zlib from "zlib";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { execSync } from "child_process";
// CJS では _dirname が undefined になるため __dirname フォールバック
const _dirname =
  typeof import.meta?.dirname === "string"
    ? import.meta.dirname
    : typeof __dirname === "string"
      ? __dirname
      : path.dirname("");

// ★ 3u: first asset metadata取得（ffprobe、DB不要）
function getFirstAssetMeta(videoId: string): { size: number; duration: number; width: number; height: number; codec: string } | null {
  try {
    // production: dist/ → ../.sdr-cache, dev: server/_core/ → ../../.sdr-cache
    const candidates = [
      path.resolve(_dirname, "../../.sdr-cache", `${videoId}.mp4`),
      path.resolve(_dirname, "../.sdr-cache", `${videoId}.mp4`),
    ];
    const sdrPath = candidates.find(p => fs.existsSync(p));
    if (!sdrPath) { console.log(`  [meta] .sdr-cache not found for ${videoId}`); return null; }
    const size = fs.statSync(sdrPath).size;
    const raw = execSync(
      `/usr/local/bin/ffprobe -v quiet -print_format json -show_format -show_streams "${sdrPath}"`,
      { timeout: 5000 }
    ).toString();
    const d = JSON.parse(raw);
    const s = (d.streams as any[])?.find((st: any) => st.codec_type === "video");
    const f = d.format;
    if (!s || !f) return null;
    return {
      size,
      duration: parseFloat(f.duration) || 0,
      width: s.width || 0,
      height: s.height || 0,
      codec: s.codec_name || "unknown",
    };
  } catch (e: any) {
    console.log(`  [meta] ffprobe failed for ${videoId}: ${e.message}`);
    return null;
  }
}

// ★ 本番HTML再生成関数（routers.tsからの呼び出し用）
let _globalRebuildProdHtml: (() => Promise<void>) | null = null;
export function triggerProdHtmlRebuild() {
  if (_globalRebuildProdHtml) _globalRebuildProdHtml();
}

function shouldInjectVehicleBootstrap(urlLike: string): boolean {
  try {
    const pathname = new URL(urlLike, "http://localhost").pathname;
    return pathname === "/";
  } catch {
    return false;
  }
}

export async function setupVite(app: Express, server: Server) {
  // dev mode でのみ vite と vite.config を読み込む（production CJS ではプラグインが壊れる）
  // esbuild が静的解析でバンドルしないよう変数経由で import
  const vitePkg = "vite";
  const { createServer: createViteServer } = await import(vitePkg);
  const cfgPath = path.resolve(_dirname, "../..", "vite.config.ts");
  const viteConfig = (await import(cfgPath)).default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // ★ 車両データ + 最初の動画preloadをHTML埋め込み（bootstrap video廃止）
  let _vehiclesEmbed: string | null = null;
  let _preloadEmbed: string | null = null;
  try {
    const { getPublishedVehiclesWithMedia, extractFirstVideoFromList } = await import("../db");
    const vehiclesData = await getPublishedVehiclesWithMedia();
    if (vehiclesData) {
      _vehiclesEmbed = `<script>window.__earlyListWithMediaData=${JSON.stringify(vehiclesData)};</script>`;
      console.log(`  [embed] Vehicles embedded: ${vehiclesData.vehicles?.length ?? 0} vehicles`);
    }
    const firstResult = extractFirstVideoFromList(vehiclesData);
    let firstVid: string | null = firstResult?.bunnyVideoId ?? null;
    if (firstVid) {
      const vid = firstVid;
      const sdrUrl = `/api/sdr/${vid}?v=5`;
      const thumbUrl = `/api/sdr-thumb/${vid}?v=3`;
      const meta = getFirstAssetMeta(vid);
      const EARLY_BLOB_SIZE_LIMIT = 8 * 1024 * 1024; // 8MB
      const earlyBlobEligible = !meta || meta.size <= EARLY_BLOB_SIZE_LIMIT;
      const headVideoEligible = !!meta && !earlyBlobEligible;
      const headVideoReason = !meta
        ? "no-meta"
        : earlyBlobEligible
          ? "light-asset"
          : "heavy-asset";
      const metaJson = meta
        ? `,size:${meta.size},duration:${meta.duration},width:${meta.width},height:${meta.height},codec:"${meta.codec}",earlyBlobEligible:${earlyBlobEligible},headVideoEligible:${headVideoEligible},headVideoThresholdBytes:${EARLY_BLOB_SIZE_LIMIT},headVideoReason:"${headVideoReason}"`
        : `,earlyBlobEligible:true,headVideoEligible:false,headVideoThresholdBytes:${EARLY_BLOB_SIZE_LIMIT},headVideoReason:"${headVideoReason}"`;
      if (meta) console.log(`  [meta] Dev: firstVideo=${vid.slice(0, 8)} size=${(meta.size / 1024 / 1024).toFixed(1)}MB dur=${meta.duration.toFixed(1)}s ${meta.width}x${meta.height} ${meta.codec} earlyBlob=${earlyBlobEligible} headVideo=${headVideoEligible}`);
      if (earlyBlobEligible) {
        _preloadEmbed = `<link rel="preload" as="fetch" href="${sdrUrl}" crossorigin>\n` +
          `<script>window.__FIRST_VIDEO_DATA__={bunnyVideoId:"${vid}",sdrUrl:"${sdrUrl}",thumbUrl:"${thumbUrl}"${metaJson}};` +
          `window.__earlyMp4VideoId="${vid}";` +
          `window.__earlyMp4FetchStart=performance.now();` +
          `window.__earlyMp4Promise=fetch("${sdrUrl}",{priority:"high"}).then(function(r){return r.blob()}).then(function(b){window.__earlyMp4BlobUrl=URL.createObjectURL(b)}).catch(function(){});</script>`;
        console.log(`  [embed] Dev: early blob fetch firstVideo=${vid.slice(0, 8)} (<=8MB)`);
      } else {
        _preloadEmbed = `<script>window.__FIRST_VIDEO_DATA__={bunnyVideoId:"${vid}",sdrUrl:"${sdrUrl}",thumbUrl:"${thumbUrl}"${metaJson}};</script>`;
        console.log(`  [embed] Dev: early blob SKIPPED firstVideo=${vid.slice(0, 8)} (${(meta!.size / 1024 / 1024).toFixed(1)}MB > 8MB)`);
      }
    }
  } catch (e: any) {
    console.log(`  [embed] DB query failed: ${e.message}`);
  }

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        _dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page = await vite.transformIndexHtml(url, template);

      if (shouldInjectVehicleBootstrap(url)) {
        // ★ 注入順序重要: vehiclesEmbed → preloadEmbed の順で<head>直後に注入
        // vehiclesEmbed(__earlyListWithMediaData)がhead script実行前に存在する必要がある
        if (_vehiclesEmbed) {
          page = page.replace('<head>', '<head>\n' + _vehiclesEmbed);
        }
        if (_preloadEmbed) {
          page = page.replace('<head>', '<head>\n' + _preloadEmbed);
        }
      }

      res.status(200).set({
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(_dirname, "../..", "dist", "public")
      : path.resolve(_dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // ★ 車両データ埋め込みHTML生成（bootstrap video廃止）
  let _prodHtml: string | null = null;
  let _prodHtmlReady: Promise<void>;

  async function rebuildProdHtml() {
    try {
      const { getPublishedVehiclesWithMedia, extractFirstVideoFromList } = await import("../db");
      const rawHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
      let html = rawHtml;
      // ★ 注入順序重要: vehiclesEmbed → preloadEmbed の順で<head>直後に注入
      // vehiclesEmbed(__earlyListWithMediaData)がhead script実行前に存在する必要がある
      const vehiclesData = await getPublishedVehiclesWithMedia();
      if (vehiclesData) {
        html = html.replace('<head>', `<head>\n<script>window.__earlyListWithMediaData=${JSON.stringify(vehiclesData)};</script>`);
        console.log(`  [embed] Production: ${vehiclesData.vehicles?.length ?? 0} vehicles embedded`);
      }
      const firstResult = extractFirstVideoFromList(vehiclesData);
      let firstVid: string | null = firstResult?.bunnyVideoId ?? null;
      if (firstVid) {
        const vid = firstVid;
        const sdrUrl = `/api/sdr/${vid}?v=5`;
        const thumbUrl = `/api/sdr-thumb/${vid}?v=3`;
        const meta = getFirstAssetMeta(vid);
        const EARLY_BLOB_SIZE_LIMIT = 8 * 1024 * 1024; // 8MB
        const earlyBlobEligible = !meta || meta.size <= EARLY_BLOB_SIZE_LIMIT;
        const headVideoEligible = !!meta && !earlyBlobEligible;
        const headVideoReason = !meta
          ? "no-meta"
          : earlyBlobEligible
            ? "light-asset"
            : "heavy-asset";
        const metaJson = meta
          ? `,size:${meta.size},duration:${meta.duration},width:${meta.width},height:${meta.height},codec:"${meta.codec}",earlyBlobEligible:${earlyBlobEligible},headVideoEligible:${headVideoEligible},headVideoThresholdBytes:${EARLY_BLOB_SIZE_LIMIT},headVideoReason:"${headVideoReason}"`
          : `,earlyBlobEligible:true,headVideoEligible:false,headVideoThresholdBytes:${EARLY_BLOB_SIZE_LIMIT},headVideoReason:"${headVideoReason}"`;
        if (meta) console.log(`  [meta] Production: firstVideo=${vid.slice(0, 8)} size=${(meta.size / 1024 / 1024).toFixed(1)}MB dur=${meta.duration.toFixed(1)}s ${meta.width}x${meta.height} ${meta.codec} earlyBlob=${earlyBlobEligible} headVideo=${headVideoEligible}`);
        let inject: string;
        if (earlyBlobEligible) {
          inject = `<link rel="preload" as="fetch" href="${sdrUrl}" crossorigin>\n` +
            `<script>window.__FIRST_VIDEO_DATA__={bunnyVideoId:"${vid}",sdrUrl:"${sdrUrl}",thumbUrl:"${thumbUrl}"${metaJson}};` +
            `window.__earlyMp4VideoId="${vid}";` +
            `window.__earlyMp4FetchStart=performance.now();` +
            `window.__earlyMp4Promise=fetch("${sdrUrl}",{priority:"high"}).then(function(r){return r.blob()}).then(function(b){window.__earlyMp4BlobUrl=URL.createObjectURL(b)}).catch(function(){});</script>`;
          console.log(`  [embed] Production: early blob fetch firstVideo=${vid.slice(0, 8)} (<=8MB)`);
        } else {
          inject = `<script>window.__FIRST_VIDEO_DATA__={bunnyVideoId:"${vid}",sdrUrl:"${sdrUrl}",thumbUrl:"${thumbUrl}"${metaJson}};</script>`;
          console.log(`  [embed] Production: early blob SKIPPED firstVideo=${vid.slice(0, 8)} (${(meta!.size / 1024 / 1024).toFixed(1)}MB > 8MB)`);
        }
        html = html.replace('<head>', '<head>\n' + inject);
        console.log(`  [embed] Production: firstVideo=${vid.slice(0, 8)}`);
      }
      _prodHtml = html;
      _prodHtmlClean = rawHtml;
    } catch (e: any) {
      console.log(`  [embed] Production HTML rebuild failed: ${e.message}`);
    }
  }

  _prodHtmlReady = rebuildProdHtml();
  // グローバル関数を公開（routers.tsから呼べるように）
  _globalRebuildProdHtml = rebuildProdHtml;

  // ★ v55b: assets/ 配下の JS/CSS を gzip 圧縮して配信（1.27MB → ~365KB）
  // express.static は gzip 非対応なので assets だけ手動ハンドラで圧縮配信
  const assetsPath = path.resolve(distPath, "assets");
  const gzipCache = new Map<string, Buffer>();
  app.get("/assets/:file", (req, res) => {
    const filePath = path.join(assetsPath, req.params.file);
    if (!fs.existsSync(filePath)) return res.status(404).end();

    const ext = path.extname(filePath);
    const mimeMap: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".map": "application/json",
    };
    const contentType = mimeMap[ext];
    if (!contentType) {
      // 非テキストファイル（フォント等） → そのまま配信
      return res.sendFile(filePath);
    }

    const acceptGzip = (req.headers["accept-encoding"] || "").includes("gzip");
    if (!acceptGzip) return res.type(contentType).sendFile(filePath);

    // gzip キャッシュ（同一ファイルは1回だけ圧縮）
    let compressed = gzipCache.get(filePath);
    if (!compressed) {
      const raw = fs.readFileSync(filePath);
      compressed = zlib.gzipSync(raw, { level: 6 });
      gzipCache.set(filePath, compressed);
    }
    res.set({
      "Content-Type": contentType,
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.send(compressed);
  });

  // bootstrap廃止: 全ページ同じHTML（車両データ埋め込みのみ）
  let _prodHtmlClean: string | null = null;

  const sendIndexHtml = async (req: any, res: any) => {
    await _prodHtmlReady;
    const useBootstrap = shouldInjectVehicleBootstrap(req.originalUrl || req.url || "/");
    const html = useBootstrap
      ? (_prodHtml || fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8"))
      : (_prodHtmlClean || fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8"));
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    });
    res.send(html);
  };
  app.get("/", sendIndexHtml);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", sendIndexHtml);
}
