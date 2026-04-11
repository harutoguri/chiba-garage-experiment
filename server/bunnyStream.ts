/**
 * Bunny Stream API連携モジュール
 * 動画をBunny Streamにアップロードし、HLS配信を行う
 */

const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY ?? '';
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? '';

const BUNNY_API_BASE = 'https://video.bunnycdn.com';

/** Bunny Stream APIが設定されているか */
function isBunnyConfigured(): boolean {
  return !!(BUNNY_STREAM_API_KEY && BUNNY_STREAM_LIBRARY_ID);
}

interface BunnyVideo {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  length: number;
  status: number; // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
  framerate: number;
  rotation: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
  captions: any[];
  hasMP4Fallback: boolean;
  collectionId: string;
  thumbnailFileName: string;
  averageWatchTime: number;
  totalWatchTime: number;
  category: string;
  chapters: any[];
  moments: any[];
  metaTags: any[];
  transcodingMessages: any[];
}

interface CreateVideoResponse {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  length: number;
  status: number;
  framerate: number;
  rotation: number;
  width: number;
  height: number;
  availableResolutions: string | null;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
}

interface ListVideosResponse {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: BunnyVideo[];
}

/**
 * Bunny Streamに動画を作成（アップロード前の準備）
 */
export async function createBunnyVideo(title: string): Promise<CreateVideoResponse> {
  if (!isBunnyConfigured()) {
    throw new Error('[Bunny] API not configured. Set BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID.');
  }
  const response = await fetch(
    `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
    {
      method: 'POST',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Bunny video: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Bunny Streamに動画をアップロード
 */
export async function uploadToBunnyStream(
  videoId: string,
  fileBuffer: Buffer | Uint8Array,
  enabledResolutions: string = '360p,480p,720p,1080p'
): Promise<void> {
  if (!isBunnyConfigured()) {
    throw new Error('[Bunny] API not configured.');
  }
  const url = new URL(`${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`);
  url.searchParams.set('enabledResolutions', enabledResolutions);

  // Buffer/Uint8ArrayをBlobに変換
  const blob = new Blob([fileBuffer as BlobPart], { type: 'application/octet-stream' });

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to Bunny Stream: ${response.status} ${error}`);
  }
}

/**
 * 動画のサムネイルを0秒目フレームに設定
 */
export async function setBunnyThumbnailToFirstFrame(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_STREAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thumbnailTime: 0 }),
      }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[Bunny] setThumbnail failed: HTTP ${response.status} for ${videoId}. Body: ${body}`);
      return false;
    }
    // Bunny API は動画オブジェクト or { success: true } を返す。
    // HTTP 200 であれば成功とみなす（response.ok で判定）。
    const data = await response.json().catch(() => ({}));
    const ok = response.ok && data.success !== false;
    if (!ok) {
      console.error(`[Bunny] setThumbnail API returned unexpected body for ${videoId}:`, JSON.stringify(data));
    }
    return ok;
  } catch (err) {
    console.error(`[Bunny] setThumbnail exception for ${videoId}:`, err);
    return false;
  }
}

/**
 * Bunny Streamの動画情報を取得
 */
export async function getBunnyVideo(videoId: string): Promise<BunnyVideo> {
  if (!isBunnyConfigured()) {
    throw new Error('[Bunny] API not configured.');
  }
  const response = await fetch(
    `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Bunny video: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Bunny Streamの動画一覧を取得
 */
export async function listBunnyVideos(page: number = 1, itemsPerPage: number = 100): Promise<ListVideosResponse> {
  if (!isBunnyConfigured()) {
    return { totalItems: 0, currentPage: 1, itemsPerPage: 100, items: [] };
  }
  const response = await fetch(
    `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos?page=${page}&itemsPerPage=${itemsPerPage}`,
    {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list Bunny videos: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Bunny Streamの動画を削除
 */
export async function deleteBunnyVideo(videoId: string): Promise<void> {
  if (!isBunnyConfigured()) {
    throw new Error('[Bunny] API not configured.');
  }
  const response = await fetch(
    `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete Bunny video: ${response.status} ${error}`);
  }
}

/**
 * HLS再生URLを生成
 */
export function getBunnyHlsUrl(videoId: string): string {
  // Bunny StreamのHLS URL形式
  return `https://vz-2e234254-464.b-cdn.net/${videoId}/playlist.m3u8`;
}

/**
 * iframe埋め込みURLを生成
 */
export function getBunnyEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;
}

/**
 * サムネイルURLを生成
 */
export function getBunnyThumbnailUrl(videoId: string): string {
  return `https://vz-2e234254-464.b-cdn.net/${videoId}/thumbnail.jpg`;
}

/**
 * 動画のエンコード状態を確認
 * status: 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
 */
export async function checkBunnyVideoStatus(videoId: string): Promise<{
  status: number;
  encodeProgress: number;
  isReady: boolean;
}> {
  const video = await getBunnyVideo(videoId);
  return {
    status: video.status,
    encodeProgress: video.encodeProgress,
    isReady: video.status === 4, // finished
  };
}

/**
 * URLから動画をBunny Streamにフェッチ（既存のS3動画を移行する場合）
 */
export async function fetchVideoToBunny(videoUrl: string, title: string): Promise<string> {
  if (!isBunnyConfigured()) {
    throw new Error('[Bunny] API not configured.');
  }
  // まず動画を作成
  const video = await createBunnyVideo(title);
  
  // URLから動画をフェッチ
  const response = await fetch(
    `${BUNNY_API_BASE}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${video.guid}/fetch`,
    {
      method: 'POST',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: videoUrl }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch video to Bunny: ${response.status} ${error}`);
  }

  return video.guid;
}

/**
 * Bunny CDNからサムネイル画像をダウンロードしてS3にアップロード
 *
 * 【重要】Bunny StreamはthumbnailFileNameとして動画ごとに異なるファイル名
 * (例: thumbnail_feca2596.jpg) を使う。thumbnail.jpg は存在しないケースが多い。
 * → Bunny API から実際の thumbnailFileName を取得してダウンロードする。
 *
 * @returns S3に保存されたサムネイルのURL。失敗時はnull。
 */
export async function generateAndUploadThumbnail(
  videoId: string,
): Promise<string | null> {
  try {
    // 1. Bunny Set Thumbnail API で0秒フレームに設定
    await setBunnyThumbnailToFirstFrame(videoId);

    // 2. Bunnyがサムネイルを再生成するのを待つ
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Bunny APIから実際のthumbnailFileNameを取得
    //    thumbnail.jpg はすべての動画で存在するわけではない（動画固有名になることがある）
    const video = await getBunnyVideo(videoId);
    const thumbFile = video.thumbnailFileName || 'thumbnail.jpg';
    const cdnBase = 'https://vz-2e234254-464.b-cdn.net';
    const thumbnailUrl = `${cdnBase}/${videoId}/${thumbFile}`;

    console.log(`[Thumbnail] Downloading ${thumbnailUrl} for ${videoId}`);
    const response = await fetch(thumbnailUrl, {
      headers: { 'Referer': 'https://iframe.mediadelivery.net/' },
    });

    if (!response.ok) {
      // fallback: thumbnail.jpg を試みる
      if (thumbFile !== 'thumbnail.jpg') {
        const fallbackUrl = `${cdnBase}/${videoId}/thumbnail.jpg`;
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: { 'Referer': 'https://iframe.mediadelivery.net/' },
        });
        if (fallbackResponse.ok) {
          const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
          const { storagePut } = await import('./storage');
          const fileKey = `thumbnails/${videoId}-${Math.random().toString(36).substring(2, 10)}.jpg`;
          const { url } = await storagePut(fileKey, buffer, 'image/jpeg');
          console.log(`[Thumbnail] Saved (fallback) for ${videoId}: ${url}`);
          return url;
        }
      }
      console.error(`[Thumbnail] Failed to download from Bunny CDN: ${response.status} url=${thumbnailUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 4. S3にアップロード
    const { storagePut } = await import('./storage');
    const fileKey = `thumbnails/${videoId}-${Math.random().toString(36).substring(2, 10)}.jpg`;
    const { url } = await storagePut(fileKey, buffer, 'image/jpeg');

    console.log(`[Thumbnail] Saved for ${videoId}: ${url}`);
    return url;
  } catch (error) {
    console.error(`[Thumbnail] Failed to generate thumbnail for ${videoId}:`, error);
    return null;
  }
}
