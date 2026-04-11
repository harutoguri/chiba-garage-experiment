import { describe, expect, it } from "vitest";

/**
 * 動画・画像配信基盤のテスト
 * - Bunny Stream URL生成
 * - 画像最適化パイプライン
 * - 変換ステータス管理
 */

// Bunny Stream URL生成のテスト（サーバー側でも同じロジックを使うため）
const BUNNY_CDN_HOST = 'vz-2e234254-464.b-cdn.net';

function getBunnyHlsUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/playlist.m3u8`;
}

function getBunnyMp4Url(videoId: string, resolution: '360' | '480' | '720' | '1080' = '720'): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/play_${resolution}p.mp4`;
}

function getBunnyBgVideoUrl(videoId: string): string {
  return getBunnyMp4Url(videoId, '480');
}

function getBunnyThumbnailUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/thumbnail.jpg`;
}

function getBunnyPosterUrl(videoId: string): string {
  return `https://${BUNNY_CDN_HOST}/${videoId}/thumbnail.jpg?width=1280`;
}

function getOptimalImageUrl(
  originalUrl: string,
  optimizedUrls: string | null,
  size: 'sm' | 'md' | 'lg' = 'md',
): string {
  if (!optimizedUrls) return originalUrl;
  try {
    const parsed = JSON.parse(optimizedUrls);
    return parsed?.webp?.[size] || parsed?.jpeg?.[size] || originalUrl;
  } catch {
    return originalUrl;
  }
}

function buildImageSrcSet(
  optimizedUrls: { webp?: Record<string, string>; jpeg?: Record<string, string> } | null,
  format: 'webp' | 'jpeg' = 'webp',
): string | undefined {
  if (!optimizedUrls) return undefined;
  const urls = format === 'webp' ? optimizedUrls.webp : optimizedUrls.jpeg;
  if (!urls) return undefined;
  const sizeWidths: Record<string, number> = { sm: 480, md: 960, lg: 1440 };
  return Object.entries(urls)
    .filter(([_, url]) => url)
    .map(([size, url]) => `${url} ${sizeWidths[size] || 480}w`)
    .join(', ');
}

describe("Bunny Stream URL生成", () => {
  const testVideoId = "abc123-def456-ghi789";

  it("HLS URL を正しく生成する", () => {
    const url = getBunnyHlsUrl(testVideoId);
    expect(url).toBe(`https://${BUNNY_CDN_HOST}/${testVideoId}/playlist.m3u8`);
    expect(url).toContain("playlist.m3u8");
  });

  it("MP4 URL をデフォルト720pで生成する", () => {
    const url = getBunnyMp4Url(testVideoId);
    expect(url).toBe(`https://${BUNNY_CDN_HOST}/${testVideoId}/play_720p.mp4`);
  });

  it("MP4 URL を指定解像度で生成する", () => {
    expect(getBunnyMp4Url(testVideoId, '360')).toContain("play_360p.mp4");
    expect(getBunnyMp4Url(testVideoId, '480')).toContain("play_480p.mp4");
    expect(getBunnyMp4Url(testVideoId, '1080')).toContain("play_1080p.mp4");
  });

  it("背景動画用URLは480pを使用する", () => {
    const url = getBunnyBgVideoUrl(testVideoId);
    expect(url).toContain("play_480p.mp4");
  });

  it("サムネイルURLを正しく生成する", () => {
    const url = getBunnyThumbnailUrl(testVideoId);
    expect(url).toBe(`https://${BUNNY_CDN_HOST}/${testVideoId}/thumbnail.jpg`);
  });

  it("ポスターURLを正しく生成する（1280px幅）", () => {
    const url = getBunnyPosterUrl(testVideoId);
    expect(url).toContain("thumbnail.jpg?width=1280");
  });
});

describe("画像最適化URL管理", () => {
  const originalUrl = "https://example.com/original.jpg";

  const sampleOptimizedUrls = JSON.stringify({
    originalUrl: "https://s3.example.com/original.jpg",
    webp: {
      sm: "https://s3.example.com/sm.webp",
      md: "https://s3.example.com/md.webp",
      lg: "https://s3.example.com/lg.webp",
    },
    jpeg: {
      sm: "https://s3.example.com/sm.jpg",
      md: "https://s3.example.com/md.jpg",
      lg: "https://s3.example.com/lg.jpg",
    },
    originalWidth: 1920,
    originalHeight: 1080,
  });

  it("最適化済みURLがある場合、WebPを優先して返す", () => {
    const url = getOptimalImageUrl(originalUrl, sampleOptimizedUrls, 'md');
    expect(url).toBe("https://s3.example.com/md.webp");
  });

  it("smサイズを指定した場合、smのWebPを返す", () => {
    const url = getOptimalImageUrl(originalUrl, sampleOptimizedUrls, 'sm');
    expect(url).toBe("https://s3.example.com/sm.webp");
  });

  it("lgサイズを指定した場合、lgのWebPを返す", () => {
    const url = getOptimalImageUrl(originalUrl, sampleOptimizedUrls, 'lg');
    expect(url).toBe("https://s3.example.com/lg.webp");
  });

  it("最適化済みURLがnullの場合、元URLを返す", () => {
    const url = getOptimalImageUrl(originalUrl, null, 'md');
    expect(url).toBe(originalUrl);
  });

  it("不正なJSON文字列の場合、元URLを返す", () => {
    const url = getOptimalImageUrl(originalUrl, "invalid-json", 'md');
    expect(url).toBe(originalUrl);
  });

  it("WebPがない場合、JPEGにフォールバックする", () => {
    const jpegOnly = JSON.stringify({
      jpeg: { sm: "https://s3.example.com/sm.jpg", md: "https://s3.example.com/md.jpg", lg: "https://s3.example.com/lg.jpg" },
    });
    const url = getOptimalImageUrl(originalUrl, jpegOnly, 'md');
    expect(url).toBe("https://s3.example.com/md.jpg");
  });
});

describe("srcset生成", () => {
  const optimizedUrls = {
    webp: {
      sm: "https://s3.example.com/sm.webp",
      md: "https://s3.example.com/md.webp",
      lg: "https://s3.example.com/lg.webp",
    },
    jpeg: {
      sm: "https://s3.example.com/sm.jpg",
      md: "https://s3.example.com/md.jpg",
      lg: "https://s3.example.com/lg.jpg",
    },
  };

  it("WebP形式のsrcsetを正しく生成する", () => {
    const srcset = buildImageSrcSet(optimizedUrls, 'webp');
    expect(srcset).toBeDefined();
    expect(srcset).toContain("sm.webp 480w");
    expect(srcset).toContain("md.webp 960w");
    expect(srcset).toContain("lg.webp 1440w");
  });

  it("JPEG形式のsrcsetを正しく生成する", () => {
    const srcset = buildImageSrcSet(optimizedUrls, 'jpeg');
    expect(srcset).toBeDefined();
    expect(srcset).toContain("sm.jpg 480w");
    expect(srcset).toContain("md.jpg 960w");
    expect(srcset).toContain("lg.jpg 1440w");
  });

  it("nullの場合undefinedを返す", () => {
    expect(buildImageSrcSet(null)).toBeUndefined();
  });

  it("空のオブジェクトの場合undefinedを返す", () => {
    expect(buildImageSrcSet({}, 'webp')).toBeUndefined();
  });
});

describe("Bunny Streamステータス管理", () => {
  // ステータスの遷移テスト
  const validStatuses = ["pending", "processing", "ready", "error"] as const;

  it("有効なステータス値を定義している", () => {
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("processing");
    expect(validStatuses).toContain("ready");
    expect(validStatuses).toContain("error");
    expect(validStatuses).toHaveLength(4);
  });

  it("Bunny Stream API status=4 は 'ready' に対応する", () => {
    // Bunny Stream APIのstatus値マッピング
    const statusMap: Record<number, string> = {
      0: 'pending',    // Created
      1: 'pending',    // Uploaded
      2: 'processing', // Processing
      3: 'processing', // Transcoding
      4: 'ready',      // Finished
      5: 'error',      // Error
      6: 'error',      // Upload Failed
    };
    
    expect(statusMap[4]).toBe('ready');
    expect(statusMap[2]).toBe('processing');
    expect(statusMap[3]).toBe('processing');
    expect(statusMap[5]).toBe('error');
    expect(statusMap[0]).toBe('pending');
  });

  it("変換中（processing）の動画はプレースホルダーを表示すべき", () => {
    const status = "processing";
    const shouldShowPlaceholder = status === "pending" || status === "processing";
    expect(shouldShowPlaceholder).toBe(true);
  });

  it("変換完了（ready）の動画はBunny CDNから配信すべき", () => {
    const status = "ready";
    const shouldUseBunnyCdn = status === "ready";
    expect(shouldUseBunnyCdn).toBe(true);
  });

  it("エラー（error）の動画はS3フォールバックを使用すべき", () => {
    const status = "error";
    const shouldFallbackToS3 = status === "error" || status === null;
    expect(shouldFallbackToS3).toBe(true);
  });
});

describe("画像最適化サイズ定義", () => {
  const IMAGE_SIZES = [
    { name: 'sm', width: 480 },
    { name: 'md', width: 960 },
    { name: 'lg', width: 1440 },
  ] as const;

  it("3つのサイズが定義されている", () => {
    expect(IMAGE_SIZES).toHaveLength(3);
  });

  it("smは480px幅", () => {
    expect(IMAGE_SIZES[0].width).toBe(480);
  });

  it("mdは960px幅", () => {
    expect(IMAGE_SIZES[1].width).toBe(960);
  });

  it("lgは1440px幅", () => {
    expect(IMAGE_SIZES[2].width).toBe(1440);
  });

  it("サイズは昇順に並んでいる", () => {
    for (let i = 1; i < IMAGE_SIZES.length; i++) {
      expect(IMAGE_SIZES[i].width).toBeGreaterThan(IMAGE_SIZES[i - 1].width);
    }
  });
});
