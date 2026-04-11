/**
 * 画像最適化パイプライン
 * sharpを使用してWebP変換・複数サイズ生成を行う
 */
import sharp from 'sharp';
import { storagePut } from './storage';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * HEIC/HEIFバッファをJPEGに変換する。
 * sharpのlibheifがHEVC未対応の場合、OS標準コマンドにフォールバックする。
 *   macOS: sips -s format jpeg
 *   その他: ffmpeg -i input output
 */
async function heicToJpegBuffer(buf: Buffer): Promise<Buffer> {
  // sharp で試みる（libheif が HEVC 対応ビルドなら成功）
  try {
    return await sharp(buf).rotate().jpeg({ quality: 92, progressive: true }).toBuffer();
  } catch {
    // フォールバック: 一時ファイル経由でシステムコマンドを使用
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tmpIn = join(tmpdir(), `heic-in-${id}.heic`);
    const tmpOut = join(tmpdir(), `heic-out-${id}.jpg`);
    writeFileSync(tmpIn, buf);
    try {
      try {
        // macOS: sips (HEVC ネイティブ対応)
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', tmpIn, '--out', tmpOut], { stdio: 'pipe' });
      } catch {
        // クロスプラットフォーム: ffmpeg
        execFileSync('ffmpeg', ['-y', '-i', tmpIn, '-q:v', '2', tmpOut], { stdio: 'pipe' });
      }
      return readFileSync(tmpOut);
    } finally {
      try { unlinkSync(tmpIn); } catch {}
      try { unlinkSync(tmpOut); } catch {}
    }
  }
}

// 生成するサイズ定義
const IMAGE_SIZES = [
  { name: 'sm', width: 480 },
  { name: 'md', width: 960 },
  { name: 'lg', width: 1440 },
] as const;

type ImageSize = typeof IMAGE_SIZES[number]['name'];

export interface OptimizedImage {
  /** オリジナル画像のURL（S3） */
  originalUrl: string;
  /** WebP版のURL（各サイズ） */
  webp: Record<ImageSize, string>;
  /** JPEG版のURL（各サイズ、フォールバック用） */
  jpeg: Record<ImageSize, string>;
  /** 元画像の幅 */
  originalWidth: number;
  /** 元画像の高さ */
  originalHeight: number;
}

/**
 * 画像バッファを最適化し、複数サイズのWebP/JPEGを生成してS3にアップロード
 */
export async function optimizeImage(
  imageBuffer: Buffer | Uint8Array,
  originalFilename: string,
  vehicleId: number,
): Promise<OptimizedImage> {
  let buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);

  // HEIC/HEIF → JPEG 事前変換（ChromeはHEICを表示できないため）
  const metadata = await sharp(buf).metadata();
  const isHeic = metadata.format === 'heif' ||
    originalFilename.toLowerCase().endsWith('.heic') ||
    originalFilename.toLowerCase().endsWith('.heif');

  if (isHeic) {
    console.log(`[imageOptimizer] HEIC detected: ${originalFilename}, converting to JPEG...`);
    buf = await heicToJpegBuffer(buf);
    // ファイル名も.jpgに変更
    originalFilename = originalFilename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    console.log(`[imageOptimizer] HEIC → JPEG conversion done: ${buf.length} bytes`);
  }

  // 変換後のメタデータを再取得
  const finalMetadata = isHeic ? await sharp(buf).metadata() : metadata;
  const originalWidth = finalMetadata.width || 0;
  const originalHeight = finalMetadata.height || 0;

  // ユニークなハッシュを生成
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  const baseName = originalFilename.replace(/\.[^.]+$/, '');
  const baseKey = `vehicles/${vehicleId}/images/${baseName}-${hash}`;

  // オリジナル画像をS3にアップロード（HEIC変換済みならJPEG）
  const ext = originalFilename.match(/\.([^.]+)$/)?.[1] || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const { url: originalUrl } = await storagePut(
    `${baseKey}/original.${ext}`,
    buf,
    contentType,
  );
  
  // 各サイズのWebP/JPEGを並列生成
  const webp: Record<string, string> = {};
  const jpeg: Record<string, string> = {};
  
  const tasks = IMAGE_SIZES.flatMap(({ name, width }) => {
    // 元画像より大きいサイズはスキップ（元画像をそのまま使用）
    const targetWidth = originalWidth > 0 ? Math.min(width, originalWidth) : width;
    
    return [
      // WebP版
      (async () => {
        const webpBuf = await sharp(buf)
          .resize(targetWidth, undefined, { 
            withoutEnlargement: true,
            fit: 'inside',
          })
          .webp({ quality: 80, effort: 4 })
          .toBuffer();
        
        const { url } = await storagePut(
          `${baseKey}/${name}.webp`,
          webpBuf,
          'image/webp',
        );
        webp[name] = url;
      })(),
      // JPEG版（フォールバック）
      (async () => {
        const jpegBuf = await sharp(buf)
          .resize(targetWidth, undefined, {
            withoutEnlargement: true,
            fit: 'inside',
          })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();
        
        const { url } = await storagePut(
          `${baseKey}/${name}.jpg`,
          jpegBuf,
          'image/jpeg',
        );
        jpeg[name] = url;
      })(),
    ];
  });
  
  await Promise.all(tasks);
  
  return {
    originalUrl,
    webp: webp as Record<ImageSize, string>,
    jpeg: jpeg as Record<ImageSize, string>,
    originalWidth,
    originalHeight,
  };
}

/**
 * srcset文字列を生成するヘルパー
 */
export function buildSrcSet(urls: Record<ImageSize, string>, format: 'webp' | 'jpeg' = 'webp'): string {
  const sizeMap = format === 'webp' ? urls : urls;
  return IMAGE_SIZES
    .map(({ name, width }) => `${sizeMap[name]} ${width}w`)
    .join(', ');
}

/**
 * sizes属性のデフォルト値
 * 一覧: 480px幅、ギャラリー: 960px幅、背景: 100vw
 */
export const IMAGE_SIZES_ATTR = {
  thumbnail: '(max-width: 640px) 100vw, 480px',
  gallery: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 960px',
  background: '100vw',
} as const;
