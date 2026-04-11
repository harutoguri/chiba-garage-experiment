/**
 * 動画ファイルの形式をチェックするユーティリティ
 * 実験2: MOV/MP4両方許可（サーバー側でSDR MP4に自動変換）
 */

export interface VideoCodecCheckResult {
  isValid: boolean;
  errorMessage: string | null;
}

export function checkVideoCodec(file: File): VideoCodecCheckResult {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();
  const mimeType = file.type.toLowerCase();

  // MP4 or MOV は許可
  if (extension === 'mp4' || extension === 'mov' ||
      mimeType === 'video/mp4' || mimeType === 'video/quicktime' ||
      mimeType.includes('mp4')) {
    return { isValid: true, errorMessage: null };
  }

  return {
    isValid: false,
    errorMessage: `${extension || mimeType || '不明な形式'}はサポートされていません。\n\nMP4またはMOV形式でアップロードしてください。`,
  };
}

export function formatCodecErrorMessage(result: VideoCodecCheckResult): string {
  if (result.isValid) return '';
  return result.errorMessage || '動画形式が不正です。';
}
