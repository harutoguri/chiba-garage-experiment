/**
 * 動画プロキシモジュール
 * 
 * CloudFront/S3動画プロキシ: Range request対応
 * （レガシー動画用。Bunny Stream動画はCDN直リンクを使用）
 */

import { Request, Response } from "express";

const ALLOWED_DOMAINS = [
  "d2xsxph8kpxj0f.cloudfront.net",
  "manus-storage-prod-sg.s3.ap-southeast-1.amazonaws.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain);
  } catch {
    return false;
  }
}

export async function videoProxyHandler(req: Request, res: Response) {
  const videoUrl = req.query.url as string;

  if (!videoUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  if (!isAllowedUrl(videoUrl)) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  try {
    const rangeHeader = req.headers.range;
    const fetchHeaders: HeadersInit = {};
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(videoUrl, {
      method: "GET",
      headers: fetchHeaders,
    });

    if (!response.ok && response.status !== 206) {
      res.status(response.status).json({ 
        error: `Upstream error: ${response.status} ${response.statusText}` 
      });
      return;
    }

    res.setHeader("Content-Type", response.headers.get("content-type") || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    res.status(response.status);

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            if (res.writableEnded) {
              reader.cancel();
              break;
            }
            res.write(Buffer.from(value));
          }
        } catch (err) {
          console.error("[VideoProxy] Stream error:", err);
          if (!res.writableEnded) {
            res.end();
          }
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[VideoProxy] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy error" });
    }
  }
}

export function videoProxyOptionsHandler(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
}
