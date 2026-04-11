/**
 * Bunny CDN サムネイルプロキシ
 * 
 * Bunny CDNのToken Authが有効なため、サムネイル画像に直接アクセスすると403になる。
 * サーバー側でBunny CDN Token Auth署名付きURLを生成してプロキシする。
 * 
 * エンドポイント: GET /api/bunny-thumbnail/:videoId
 * クエリパラメータ:
 *   - width: サムネイル幅（デフォルト: 1280）
 * 
 * Bunny CDNのサムネイルURLは常に動画の0秒目フレームを使用。
 * thumbnail.jpg はBunny側でデフォルトで動画の最初のフレームを返す。
 */

import { Request, Response } from "express";
import crypto from "crypto";

const BUNNY_CDN_TOKEN_AUTH_KEY = process.env.BUNNY_CDN_TOKEN_AUTH_KEY || "";
const BUNNY_CDN_HOSTNAME = "vz-2e234254-464.b-cdn.net";

/**
 * Bunny CDN Token Auth署名付きURLを生成
 * https://docs.bunny.net/docs/stream-security-token-authentication
 */
function generateSignedUrl(path: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const hashableBase = `${BUNNY_CDN_TOKEN_AUTH_KEY}${path}${expires}`;
  const token = crypto
    .createHash("sha256")
    .update(hashableBase)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  return `https://${BUNNY_CDN_HOSTNAME}${path}?token=${token}&expires=${expires}`;
}

/**
 * サムネイルプロキシハンドラ
 * 動画の0秒目フレームをサムネイルとして返す
 */
export async function bunnyThumbnailProxyHandler(req: Request, res: Response) {
  const videoId = req.params.videoId;

  if (!videoId || !/^[a-f0-9-]+$/i.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  try {
    // thumbnail.jpg はBunny CDNのデフォルトサムネイル（動画の最初のフレーム）
    const path = `/${videoId}/thumbnail.jpg`;
    const width = req.query.width ? parseInt(req.query.width as string) : undefined;
    
    let url: string;
    if (BUNNY_CDN_TOKEN_AUTH_KEY) {
      // Token Auth有効: 署名付きURL
      url = generateSignedUrl(path);
    } else {
      // Token Auth無効: 直接アクセス
      url = `https://${BUNNY_CDN_HOSTNAME}${path}`;
    }
    
    if (width) {
      url += (url.includes("?") ? "&" : "?") + `width=${width}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      // 署名付きURLでも403の場合、Bunny Stream APIで直接取得を試みる
      const apiKey = process.env.BUNNY_STREAM_API_KEY;
      const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
      
      if (apiKey && libraryId) {
        const apiUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/thumbnail`;
        const apiResponse = await fetch(apiUrl, {
          headers: { "AccessKey": apiKey },
        });
        
        if (apiResponse.ok && apiResponse.body) {
          const contentType = apiResponse.headers.get("content-type") || "image/jpeg";
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400, immutable");
          res.setHeader("Access-Control-Allow-Origin", "*");
          
          const buffer = await apiResponse.arrayBuffer();
          res.send(Buffer.from(buffer));
          return;
        }
      }
      
      res.status(response.status).json({ error: `Upstream error: ${response.status}` });
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const contentLength = response.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { res.end(); break; }
            if (res.writableEnded) { reader.cancel(); break; }
            res.write(Buffer.from(value));
          }
        } catch (err) {
          console.error("[BunnyThumbnailProxy] Stream error:", err);
          if (!res.writableEnded) res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[BunnyThumbnailProxy] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy error" });
    }
  }
}
