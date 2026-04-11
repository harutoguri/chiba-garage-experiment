import mysql from 'mysql2/promise';
import { execSync } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL!;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY!;

interface VideoRecord {
  id: number;
  vehicleId: number;
  url: string;
}

async function downloadVideo(url: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`  Downloading: ${url}`);
    execSync(`curl -s -o "${outputPath}" "${url}"`, { stdio: 'pipe' });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (error) {
    console.error(`  Download failed: ${error}`);
    return false;
  }
}

async function getVideoCodec(inputPath: string): Promise<string> {
  try {
    const result = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return result;
  } catch (error) {
    return 'unknown';
  }
}

async function convertToH264(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`  Converting to H.264...`);
    execSync(
      `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`,
      { stdio: 'pipe', timeout: 300000 }
    );
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (error) {
    console.error(`  Conversion failed: ${error}`);
    return false;
  }
}

async function uploadToS3(filePath: string, fileKey: string): Promise<string | null> {
  try {
    console.log(`  Uploading to S3: ${fileKey}`);
    const fileBuffer = fs.readFileSync(filePath);
    
    const uploadUrl = new URL('v1/storage/upload', FORGE_API_URL + '/');
    uploadUrl.searchParams.set('path', fileKey);
    
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    formData.append('file', blob, fileKey.split('/').pop()!);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
      body: formData,
    });
    
    if (!response.ok) {
      console.error(`  Upload failed: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error(`  Upload failed: ${error}`);
    return null;
  }
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // 変換が必要な動画を取得（.movファイルのみ）
  const [rows] = await connection.execute(
    "SELECT id, vehicleId, url FROM vehicle_media WHERE type = 'video' AND url LIKE '%.mov' ORDER BY id"
  );
  const videos = rows as VideoRecord[];
  
  console.log(`Found ${videos.length} videos to convert`);
  
  const tmpDir = '/tmp/video_convert';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  for (const video of videos) {
    console.log(`\nProcessing video ID ${video.id} (vehicleId: ${video.vehicleId})`);
    
    const inputPath = `${tmpDir}/input_${video.id}.mov`;
    const outputPath = `${tmpDir}/output_${video.id}.mp4`;
    
    // ダウンロード
    if (!await downloadVideo(video.url, inputPath)) {
      console.error(`  Skipping: Download failed`);
      continue;
    }
    
    // コーデック確認
    const codec = await getVideoCodec(inputPath);
    console.log(`  Current codec: ${codec}`);
    
    // H.264に変換
    if (!await convertToH264(inputPath, outputPath)) {
      console.error(`  Skipping: Conversion failed`);
      fs.unlinkSync(inputPath);
      continue;
    }
    
    // ファイルサイズ確認
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    console.log(`  Size: ${(inputSize / 1024 / 1024).toFixed(2)}MB -> ${(outputSize / 1024 / 1024).toFixed(2)}MB`);
    
    // S3にアップロード
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const fileKey = `vehicles/h264-${video.vehicleId}-${randomSuffix}.mp4`;
    const newUrl = await uploadToS3(outputPath, fileKey);
    
    if (!newUrl) {
      console.error(`  Skipping: Upload failed`);
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      continue;
    }
    
    // データベース更新
    await connection.execute(
      "UPDATE vehicle_media SET url = ? WHERE id = ?",
      [newUrl, video.id]
    );
    console.log(`  Updated DB: ${newUrl}`);
    
    // 一時ファイル削除
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  }
  
  await connection.end();
  console.log('\nAll videos converted!');
}

main().catch(console.error);
