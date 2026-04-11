import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import os from "os";
import fs from "fs";
import path from "path";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { videoProxyHandler, videoProxyOptionsHandler } from "../videoProxy";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ★ v93e: CORS for LAN access — 全/apiハンドラの前に配置
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ローカルストレージ（S3未設定時のフォールバック）: /local-storage/ を静的配信
  // storage.ts が S3 の代わりにローカルファイルシステムに保存した thumbnails などを配信する
  app.use("/local-storage", express.static(path.join(process.cwd(), "local-storage"), {
    setHeaders: (res, filePath) => {
      // ★ TASK-AVIF-HDR-001: AVIF MIMEを明示的に設定
      if (filePath.endsWith('.avif')) {
        res.setHeader('Content-Type', 'image/avif');
      }
    }
  }));

  // ★ ローカルアップロード（Forge API未設定時のフォールバック）
  const localStorageDir = path.join(process.cwd(), "local-storage");
  try { fs.mkdirSync(localStorageDir, { recursive: true }); } catch {}
  const upload = multer({
    dest: path.join(localStorageDir, "_tmp"),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
  });
  app.post("/api/local-upload", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file" });
      }
      const folder = (req.query.folder as string) || "vehicles";
      const ext = (req.query.ext as string) || path.extname(req.file.originalname) || ".bin";
      const uniqueName = `${folder}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      const destPath = path.join(localStorageDir, uniqueName);
      fs.renameSync(req.file.path, destPath);
      const url = `/local-storage/${uniqueName}`;
      console.log(`[local-upload] saved ${req.file.originalname} → ${destPath} (${(req.file.size / 1024).toFixed(0)}KB)`);
      res.json({ url });
    } catch (e: any) {
      console.error("[local-upload] error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ★ BUILD 2n: 動画アップロードパイプライン（tonemap + 直接配信）
  // Bunny Stream再エンコード回避: 変換済みMP4をSDRキャッシュに直置きして配信
  const bt709TmpDir = path.join(process.cwd(), ".bt709-tmp");
  try { fs.mkdirSync(bt709TmpDir, { recursive: true }); } catch {}
  const uploadVideo = multer({
    dest: bt709TmpDir,
    limits: { fileSize: 500 * 1024 * 1024 }
  });
  app.post("/api/upload-video", uploadVideo.single("file"), async (req, res) => {
    const { execFile: ef } = await import("child_process");
    const { promisify: pm } = await import("util");
    const execAsync = pm(ef);
    const crypto = await import("crypto");

    try {
      if (!req.file) return res.status(400).json({ error: "No file" });

      const inputPath = req.file.path;
      const title = (req.query.title as string) || req.file.originalname || "untitled";
      console.log(`[upload] Received: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB)`);

      // 一意のvideoId生成（UUIDv4）— bunnyVideoIdと同じ形式
      const videoId = crypto.randomUUID();

      // 1. ffprobeで色空間 + SAR チェック
      let needsConversion = false;
      let needsReencode = false;
      let sarStr = "1:1";
      try {
        const { stdout } = await execAsync("ffprobe", [
          "-v", "quiet", "-show_streams", "-select_streams", "v:0",
          "-print_format", "json", inputPath
        ]);
        const streams = JSON.parse(stdout);
        const vs = streams?.streams?.[0];
        const rawOut = JSON.stringify(vs || {});
        needsConversion = rawOut.includes("bt2020") || rawOut.includes("arib-std-b67");
        sarStr = vs?.sample_aspect_ratio || "1:1";
        needsReencode = needsConversion || (sarStr !== "1:1" && sarStr !== "N/A");
        console.log(`[upload] Color: ${needsConversion ? "HLG→tonemap" : "SDR"}, SAR: ${sarStr}, reencode: ${needsReencode}`);
      } catch (e: any) {
        console.log(`[upload] ffprobe failed: ${e.message}, assuming reencode needed`);
        needsReencode = true;
      }

      const sdrCacheDir = path.join(process.cwd(), ".sdr-cache");
      const thumbCacheDir = path.join(process.cwd(), ".sdr-thumb-cache");
      const originalsDir = path.join(process.cwd(), ".upload-originals");
      try { fs.mkdirSync(originalsDir, { recursive: true }); } catch {}
      const outputPath = path.join(sdrCacheDir, `${videoId}.mp4`);

      // ★ 原本を永続保存（SDRキャッシュ削除しても復元可能）
      const originalPath = path.join(originalsDir, `${videoId}.mp4`);
      fs.copyFileSync(inputPath, originalPath);
      console.log(`[upload] Original saved: ${videoId.slice(0, 8)} → .upload-originals/`);

      // 2. 変換 or コピー → SDRキャッシュに直接保存
      const t0 = Date.now();
      if (needsConversion) {
        // HLG→SDR tonemap + SAR焼き込み
        await execAsync("ffmpeg", [
          "-y", "-i", inputPath,
          "-vf", "zscale=t=linear:npl=300,format=gbrpf32le,tonemap=reinhard:desat=0,zscale=t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
          "-c:v", "libx264", "-preset", "fast", "-crf", "18",
          "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709",
          "-color_range", "tv",
          "-movflags", "+faststart",
          "-c:a", "aac", "-b:a", "128k",
          outputPath,
        ], { timeout: 300000 });
        console.log(`[upload] Tonemap完了 ${((Date.now()-t0)/1000).toFixed(1)}s → ${videoId.slice(0, 8)}`);
      } else if (needsReencode) {
        // bt709 + SAR焼き込みが必要な場合のみ再エンコード
        await execAsync("ffmpeg", [
          "-y", "-i", inputPath,
          "-vf", "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
          "-c:v", "libx264", "-crf", "18", "-preset", "fast",
          "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709",
          "-color_range", "tv",
          "-movflags", "+faststart",
          "-c:a", "copy",
          outputPath,
        ], { timeout: 120000 });
        console.log(`[upload] SAR bake完了 ${((Date.now()-t0)/1000).toFixed(1)}s → ${videoId.slice(0, 8)}`);
      } else {
        // bt709動画はそのままコピー（変換不要）
        fs.copyFileSync(inputPath, outputPath);
        console.log(`[upload] bt709 stream copy → ${videoId.slice(0, 8)}`);
      }

      // 3. サムネ生成（SAR適用 = X-1修正済み）
      const thumbPath = path.join(thumbCacheDir, `${videoId}.jpg`);
      await execAsync("ffmpeg", [
        "-i", outputPath,
        "-vf", "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2",
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        thumbPath,
      ], { timeout: 15000 });
      console.log(`[upload] サムネ生成完了 → ${videoId.slice(0, 8)}`);

      // Cleanup
      try { fs.unlinkSync(inputPath); } catch {}

      res.json({
        videoId,
        title,
        converted: needsConversion,
        videoUrl: `/api/sdr/${videoId}`,
        thumbUrl: `/api/sdr-thumb/${videoId}`,
      });
      console.log(`[upload] 完了: ${videoId} (${title})`);
    } catch (e: any) {
      console.error("[upload] error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ★ v86: 自前HLS 0.5秒セグメント配信（Safariネイティブ HLS 用）
  // .hls-cache/{videoId}/playlist.m3u8 + seg*.ts を静的配信
  app.use("/hls-cache", express.static(path.join(process.cwd(), ".hls-cache"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache'); // m3u8はキャッシュしない
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));

  // ★ v87j: solo.html を Vite SPA フォールバックより先に静的配信
  // React ルーターに吸われないよう、Express レベルで直接返す
  app.get("/solo.html", (_req, res) => {
    const soloPath = path.resolve(process.cwd(), "client/public/solo.html");
    if (fs.existsSync(soloPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs.readFileSync(soloPath, "utf-8"));
    } else {
      res.status(404).send("solo.html not found");
    }
  });

  // 動画プロキシエンドポイント（レガシー動画用）
  app.options("/api/video-proxy", videoProxyOptionsHandler);
  app.get("/api/video-proxy", videoProxyHandler);

  // ★ v93e: TikTok本家方式 — MP4 frame 0をffmpegで抽出してサムネイルとして返す
  // Bunny APIのthumbnailFileName問い合わせを廃止。MP4の実際のframe 0を使うことで
  // 動画との色味不一致（SDR JPEG vs HDR動画）を解消
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  // ★ /api/thumb → /api/sdr-thumb へリダイレクト（旧エンドポイント互換）
  app.get("/api/thumb", (req, res) => {
    const id = req.query.id as string;
    if (!id || !/^[\w-]+$/.test(id)) {
      return res.status(400).send("Invalid id");
    }
    console.log(`[thumb] redirect ${id.slice(0, 8)} → /api/sdr-thumb/${id}`);
    res.redirect(301, `/api/sdr-thumb/${id}`);
  });
  
  // ★ デバッグログ収集: 実機(iPhone) → サーバー → curl で確認
  const _debugLogs: string[] = [];
  const MAX_DEBUG_LOGS = 2000; // ★ v42: 500→2000（INACT圧縮 + 長時間テスト対応）
  app.post("/api/debug-log", (req, res) => {
    const lines: string[] = req.body?.lines;
    if (Array.isArray(lines)) {
      for (const line of lines) {
        _debugLogs.push(line);
        if (_debugLogs.length > MAX_DEBUG_LOGS) _debugLogs.shift();
      }
    }
    res.json({ ok: true });
  });
  app.get("/api/debug-log", (_req, res) => {
    res.json({ count: _debugLogs.length, lines: _debugLogs });
  });
  app.delete("/api/debug-log", (_req, res) => {
    _debugLogs.length = 0;
    res.json({ ok: true, cleared: true });
  });

  // ★ ネットワークキャプチャ: iPhoneのperformance.getEntriesByType("resource")を自動収集
  const _netCapturePath = path.join(process.cwd(), "net-capture.json");
  app.post("/api/net-capture", (req, res) => {
    const data = req.body;
    try {
      fs.writeFileSync(_netCapturePath, JSON.stringify(data, null, 2));
      console.log(`[net-capture] saved ${data?.entries?.length || 0} entries to ${_netCapturePath}`);
    } catch (e: any) {
      console.error("[net-capture] write failed:", e.message);
    }
    res.json({ ok: true, entries: data?.entries?.length || 0 });
  });
  app.get("/api/net-capture", (_req, res) => {
    try {
      if (fs.existsSync(_netCapturePath)) {
        const raw = fs.readFileSync(_netCapturePath, "utf-8");
        res.type("json").send(raw);
      } else {
        res.json({ entries: [] });
      }
    } catch { res.json({ entries: [] }); }
  });
  app.delete("/api/net-capture", (_req, res) => {
    try { fs.unlinkSync(_netCapturePath); } catch {}
    res.json({ ok: true, cleared: true });
  });

  // ========== 実験2: SDR自動変換エンドポイント ==========
  // Bunny CDNのHDR動画(bt2020nc/arib-std-b67) → SDR(bt709)に変換してキャッシュ配信
  const _sdrCacheDir = path.join(process.cwd(), ".sdr-cache");
  try { fs.mkdirSync(_sdrCacheDir, { recursive: true }); } catch {}
  const _sdrThumbCacheDir = path.join(process.cwd(), ".sdr-thumb-cache");
  try { fs.mkdirSync(_sdrThumbCacheDir, { recursive: true }); } catch {}

  // SDR変換済みMP4を配信（なければBunnyからDL→ffmpegでSDR変換→キャッシュ）
  app.get("/api/sdr/:videoId", async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId || !/^[0-9a-f-]+$/.test(videoId)) {
      return res.status(400).send("Invalid videoId");
    }
    const sdrPath = path.join(_sdrCacheDir, `${videoId}.mp4`);

    // キャッシュHIT
    if (fs.existsSync(sdrPath)) {
      console.log(`[sdr] HIT ${videoId.slice(0, 8)}`);
      return res.sendFile(sdrPath, {
        headers: {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-SDR-Cache": "HIT",
        }
      });
    }

    // MISS → まず.upload-originalsチェック → なければBunny CDNからDL → SDR変換
    try {
      console.log(`[sdr] MISS ${videoId.slice(0, 8)} → converting HDR→SDR...`);
      const _originalsDir = path.join(process.cwd(), ".upload-originals");
      const originalFile = path.join(_originalsDir, `${videoId}.mp4`);
      const tmpInput = path.join(_sdrCacheDir, `${videoId}_tmp_input.mp4`);

      if (fs.existsSync(originalFile)) {
        // ★ ローカルアップロード原本から復元
        console.log(`[sdr] RESTORE from .upload-originals: ${videoId.slice(0, 8)}`);
        fs.copyFileSync(originalFile, tmpInput);
      } else {
        // Bunny CDNからDL
        const bunnyUrl = `https://vz-2e234254-464.b-cdn.net/${videoId}/play_720p.mp4`;
        const upstream = await fetch(bunnyUrl, {
          headers: { "Referer": "https://iframe.mediadelivery.net/" }
        });
        if (!upstream.ok) {
          return res.status(upstream.status).send("Bunny CDN error");
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        fs.writeFileSync(tmpInput, buf);
      }

      // ffprobe で色空間 + SAR チェック
      let isHDR = false;
      let sarStr = "1:1";
      try {
        const { stdout } = await execFileAsync("ffprobe", [
          "-v", "quiet", "-show_streams", "-select_streams", "v:0",
          "-print_format", "json", tmpInput
        ]);
        const vs = JSON.parse(stdout)?.streams?.[0];
        isHDR = (vs?.color_transfer === "arib-std-b67") || (vs?.color_primaries === "bt2020");
        sarStr = vs?.sample_aspect_ratio || "1:1";
      } catch {}
      const needsSarBake = sarStr !== "1:1" && sarStr !== "N/A";

      if (isHDR) {
        // HLG/bt2020 → bt709 SDR変換（reinhard tonemap + SAR焼き込み）
        await execFileAsync("ffmpeg", [
          "-y", "-i", tmpInput,
          "-vf", "zscale=t=linear:npl=300,format=gbrpf32le,tonemap=reinhard:desat=0,zscale=t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
          "-c:v", "libx264", "-preset", "fast", "-crf", "18",
          "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709",
          "-color_range", "tv",
          "-movflags", "+faststart",
          "-c:a", "copy",
          sdrPath,
        ], { timeout: 120000 });
        console.log(`[sdr] reinhard tonemap HLG→bt709 + SAR bake: ${videoId.slice(0, 8)}`);
      } else if (needsSarBake) {
        // bt709 + SAR焼き込みが必要な場合のみ再エンコード
        await execFileAsync("ffmpeg", [
          "-y", "-i", tmpInput,
          "-vf", "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
          "-c:v", "libx264", "-crf", "18", "-preset", "fast",
          "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709",
          "-color_range", "tv",
          "-movflags", "+faststart",
          "-c:a", "copy",
          sdrPath,
        ], { timeout: 120000 });
        console.log(`[sdr] SAR bake: ${videoId.slice(0, 8)}`);
      } else {
        // bt709動画はそのままコピー（変換不要）
        fs.copyFileSync(tmpInput, sdrPath);
        console.log(`[sdr] bt709 stream copy: ${videoId.slice(0, 8)}`);
      }

      // tmpファイル削除
      try { fs.unlinkSync(tmpInput); } catch {}

      if (!fs.existsSync(sdrPath)) {
        return res.status(500).send("SDR conversion failed");
      }

      return res.sendFile(sdrPath, {
        headers: {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=2592000",
          "X-SDR-Cache": "MISS",
        }
      });
    } catch (e: any) {
      console.error(`[sdr] error ${videoId.slice(0, 8)}:`, e.message);
      return res.status(502).send("SDR conversion error");
    }
  });

  // SDR変換済みMP4からサムネイル（frame 0）抽出
  app.get("/api/sdr-thumb/:videoId", async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId || !/^[0-9a-f-]+$/.test(videoId)) {
      return res.status(400).send("Invalid videoId");
    }
    const thumbPath = path.join(_sdrThumbCacheDir, `${videoId}.jpg`);

    // キャッシュHIT
    if (fs.existsSync(thumbPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(thumbPath);
    }

    // SDR MP4からframe 0を抽出
    const sdrPath = path.join(_sdrCacheDir, `${videoId}.mp4`);
    let mp4Source = sdrPath;

    // SDRキャッシュなければ先にSDR変換をトリガー
    if (!fs.existsSync(sdrPath)) {
      try {
        await fetch(`http://localhost:${parseInt(process.env.PORT || "3001")}/api/sdr/${videoId}`);
      } catch {}
    }

    if (!fs.existsSync(sdrPath)) {
      // それでもなければBunny CDN直接
      mp4Source = `https://vz-2e234254-464.b-cdn.net/${videoId}/play_720p.mp4`;
    }

    try {
      await execFileAsync("ffmpeg", [
        "-i", mp4Source,
        "-vf", "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2",
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        thumbPath,
      ], { timeout: 15000 });

      if (!fs.existsSync(thumbPath)) {
        return res.status(500).send("Thumbnail extraction failed");
      }

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(thumbPath);
    } catch (e: any) {
      console.error(`[sdr-thumb] error ${videoId.slice(0, 8)}:`, e.message);
      return res.status(502).send("Thumbnail error");
    }
  });

  // ★ v84b: MP4キャッシュプロキシ — 詳細ロギング + ディスク配信方式
  // v84で判明: メモリBuffer→res.send()方式だとiOS Safariが30秒遅延
  // v84b: ディスクに書いてexpress.staticのsendFile()で配信（正しいRange対応）
  const _mp4Cache = new Map<string, string>(); // videoId → filePath
  const _mp4CacheDir = path.join(process.cwd(), ".mp4-cache");
  try { fs.mkdirSync(_mp4CacheDir, { recursive: true }); } catch {}

  // ★ v84b: 全リクエストログ — iOS Safariの挙動を完全記録
  const _mp4ReqLog: string[] = [];
  app.get("/api/mp4-cache/:videoId", async (req, res) => {
    const t0 = Date.now();
    const videoId = req.params.videoId;
    const range = req.headers.range || "none";
    const logEntry = `[mp4] ${new Date().toISOString().slice(11,23)} GET vid=${videoId?.slice(0,8)} Range=${range}`;
    _mp4ReqLog.push(logEntry);
    console.log(logEntry);

    if (!videoId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(videoId)) {
      return res.status(400).send("Invalid videoId");
    }

    // キャッシュ済みファイルがあればsendFileで配信（OSレベルのRange対応）
    // ★ v85: メモリマップになくてもディスクファイルを先にチェック（再エンコード済みMP4の保護）
    const diskPath = path.join(_mp4CacheDir, `${videoId}.mp4`);
    let cachedPath = _mp4Cache.get(videoId);
    if (!cachedPath && fs.existsSync(diskPath)) {
      cachedPath = diskPath;
      _mp4Cache.set(videoId, diskPath);
    }
    if (cachedPath && fs.existsSync(cachedPath)) {
      const stat = fs.statSync(cachedPath);
      _mp4ReqLog.push(`[mp4] HIT size=${stat.size} → sendFile`);
      console.log(`[mp4] HIT size=${stat.size} → sendFile dt=${Date.now()-t0}ms`);
      return res.sendFile(cachedPath, {
        headers: {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=2592000",
          "X-MP4-Cache": "HIT",
        }
      });
    }

    // キャッシュミス → Bunnyから取得してディスクに保存
    const bunnyUrl = `https://vz-2e234254-464.b-cdn.net/${videoId}/play_720p.mp4`;
    try {
      console.log(`[mp4-cache] MISS → fetching from Bunny: ${videoId.slice(0, 8)}...`);
      const upstream = await fetch(bunnyUrl, {
        headers: { "Referer": "https://iframe.mediadelivery.net/" }
      });
      if (!upstream.ok) {
        return res.status(upstream.status).send("Bunny CDN error");
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const filePath = path.join(_mp4CacheDir, `${videoId}.mp4`);
      fs.writeFileSync(filePath, buf);
      _mp4Cache.set(videoId, filePath);
      console.log(`[mp4-cache] cached ${videoId.slice(0, 8)}... (${(buf.length / 1024).toFixed(0)}KB) → ${filePath}`);
      return res.sendFile(filePath, {
        headers: {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=2592000",
          "X-MP4-Cache": "MISS",
        }
      });
    } catch (e: any) {
      console.error(`[mp4-cache] fetch error: ${e.message}`);
      return res.status(502).send("Proxy error");
    }
  });
  // ★ v84b: MP4リクエストログ確認用
  app.get("/api/mp4-log", (_req, res) => {
    res.json({ count: _mp4ReqLog.length, lines: _mp4ReqLog });
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // 0.0.0.0 で明示バインド → LAN（iPhone Wi-Fi）からもアクセス可能
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  Local:   http://localhost:${port}/`);
    const lanIPs = (Object.values(os.networkInterfaces()) as os.NetworkInterfaceInfo[][])
      .flat()
      .filter((iface): iface is os.NetworkInterfaceInfo => !!iface && iface.family === "IPv4" && !iface.internal)
      .map(iface => `http://${iface.address}:${port}/`);
    if (lanIPs.length > 0) {
      lanIPs.forEach(url => console.log(`  Network: ${url}  ← iPhone(Wi-Fi)はこのURLを使用`));
    }
    console.log();
    // ★ v38: APIキャッシュをプリウォーム — 初回ページロードでDB待ちさせない
    fetch(`http://localhost:${port}/api/trpc/vehicles.firstVideo`).catch(() => {});
    fetch(`http://localhost:${port}/api/trpc/vehicles.firstWithMedia`).catch(() => {});
    fetch(`http://localhost:${port}/api/trpc/vehicles.listWithMedia`).catch(() => {});
    console.log('  [v38] API cache pre-warming started...');
    // ★ v93h: 全MP4 + 全サムネをプリウォーム — 黒画面根絶 + 1ms配信
    (async () => {
      try {
        const resp = await fetch(`http://localhost:${port}/api/trpc/vehicles.listWithMedia`);
        const data = await resp.json() as any;
        const mediaMap = data?.result?.data?.json?.mediaMap || {};
        const videoIds: string[] = [];
        for (const vId of Object.keys(mediaMap)) {
          for (const m of mediaMap[vId]) {
            if (m.bunnyVideoId) videoIds.push(m.bunnyVideoId);
          }
        }
        const unique = [...new Set(videoIds)];
        console.log(`  [v93h] Pre-warming ${unique.length} MP4s + thumbnails...`);
        // ★ 実験2: SDR変換+キャッシュ（1本ずつ — ffmpegが重いので直列）
        for (const vid of unique) {
          try {
            console.log(`  [exp2] SDR converting: ${vid.slice(0, 8)}...`);
            await fetch(`http://localhost:${port}/api/sdr/${vid}`);
            console.log(`  [exp2] SDR done: ${vid.slice(0, 8)}`);
          } catch (e: any) {
            console.log(`  [exp2] SDR fail: ${vid.slice(0, 8)} ${e.message}`);
          }
        }
        // SDRサムネ生成
        for (const vid of unique) {
          try {
            await fetch(`http://localhost:${port}/api/sdr-thumb/${vid}`);
            console.log(`  [exp2] SDR thumb done: ${vid.slice(0, 8)}`);
          } catch (e: any) {
            console.log(`  [exp2] SDR thumb fail: ${vid.slice(0, 8)} ${e.message}`);
          }
        }
        console.log(`  [exp2] Pre-warm complete: ${unique.length} videos`);
      } catch (e: any) {
        console.log(`  [v93h] Pre-warm failed: ${e.message}`);
      }
    })();
  });
}

startServer().catch(console.error);
