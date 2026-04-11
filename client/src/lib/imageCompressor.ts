/**
 * 画像圧縮ユーティリティ
 * アップロード前にブラウザ側で画像を圧縮・リサイズする
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeMB: 5,
};

/**
 * 画像ファイルを圧縮する
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 動画は圧縮しない
  if (file.type.startsWith('video/')) {
    return file;
  }
  
  // 画像以外は圧縮しない
  if (!file.type.startsWith('image/')) {
    return file;
  }
  
  // HEIC/HEIFはそのまま返す（ブラウザでの処理が難しい）
  if (file.type === 'image/heic' || file.type === 'image/heif' || 
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    return file;
  }
  
  // 既に十分小さい場合はそのまま返す
  const maxSizeBytes = (opts.maxSizeMB || 5) * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(file);
      return;
    }

    img.onload = () => {
      let { width, height } = img;
      const maxW = opts.maxWidth || 1920;
      const maxH = opts.maxHeight || 1920;

      // アスペクト比を維持しながらリサイズ
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      
      // 白背景を描画（透過PNG対策）
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);

      // 品質を調整しながら圧縮
      let quality = opts.quality || 0.8;
      const compress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            
            // まだ大きい場合は品質を下げて再圧縮
            if (blob.size > maxSizeBytes && quality > 0.3) {
              quality -= 0.1;
              compress();
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`圧縮完了: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      compress();
    };

    img.onerror = () => {
      console.error('画像の読み込みに失敗しました');
      resolve(file);
    };

    // 画像を読み込む
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 複数の画像ファイルを圧縮する
 */
export async function compressImages(
  files: File[],
  options: CompressOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const results: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    const compressed = await compressImage(files[i], options);
    results.push(compressed);
  }
  
  return results;
}

/**
 * ファイルをBase64に変換する（チャンク処理対応）
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
