#!/usr/bin/env node
// Batch re-convert all S3-origin videos with SAR baking + tonemap
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const SDR_CACHE = ".sdr-cache";
const THUMB_CACHE = ".sdr-thumb-cache";
const TMP_DIR = ".bt709-tmp";
[SDR_CACHE, THUMB_CACHE, TMP_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const VIDEOS = [
  ["18b7391b-d5a2-42ae-97b8-68a3590a7523", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/xVJm75C0Y54i7oIt3YZVx.mp4"],
  ["62f056f9-aca0-48d0-9e69-96c5455b0eae", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/h264-30002-0512d5ecdbd83759.mp4"],
  ["835a6bec-9684-4a31-b98b-33c771dee032", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/VzH6pte7E72TTmNy25LFc.mp4"],
  ["7c301445-f2e5-4fb0-bd57-f9efe71289aa", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/gCxE6LiStNXfpD_O-wtZR.mp4"],
  ["5e40e31d-9133-4468-b9c7-05daad4fdc3e", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/HZNF8FAnf4aFdoyw3TqRP.mp4"],
  ["f0375b57-76cd-48d8-9f69-4a1e8c0bdb28", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/5XpuHuplJ6yGyENmyT4LQ.mp4"],
  ["a6169724-85c1-478c-887a-f5f591ef0363", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/F7li1AEs-oAlMIhjRsczL.mp4"],
  ["e763e9ed-2035-4d8a-bea5-cb61d1fca8ba", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/DsQecYSVFG6eEefQef-1Y.mp4"],
  ["ffbf9107-caff-4f16-b947-4219454bfa7d", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/zwtohIZJmKdSSseVsG5fA.mp4"],
  ["09622a0b-adec-4fed-88a6-62c9dd2a83c1", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/-1wWuDIHywxLW9J1Yi4ZB.mp4"],
  ["ce01d862-e884-4c41-9915-d43b6514ae94", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/n-3yPQzIyBuL0HCQnMfp1.mp4"],
  ["bc5387f7-f5db-4730-af9f-8cd4b2f828f0", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/3CFBHNRxwcj5CDajFHsbe.mp4"],
  ["0331d9f4-cd31-4a69-860f-d583664ac24c", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/piQzHH3qhRMxg9Np0HUIv.mp4"],
  ["17ed05e6-4f08-4ce3-beee-c17f265acf3e", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/N5Ati3FgJUn6e_QL_M8ad.mp4"],
  ["8dedf3e4-33d7-42f0-896a-1397ed908949", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/dGfRrEymwSrJbw0v66cwj.mp4"],
  ["455695b2-daff-4de0-a8d8-b556a00d4b7c", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/HvWpcusmFpq2t90wg0xPu.mp4"],
  ["1d9675f5-652e-46df-9a74-668edf52bbe3", "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/GLuSTIexh5F8BMX2JRHfO.mp4"],
];

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { timeout: 300000, stdio: "pipe", ...opts }).toString();
}

console.log(`=== Batch: ${VIDEOS.length} S3 videos ===\n`);

for (let i = 0; i < VIDEOS.length; i++) {
  const [vid, url] = VIDEOS[i];
  const short = vid.slice(0, 8);
  const input = path.join(TMP_DIR, `${vid}_input.mp4`);
  const output = path.join(SDR_CACHE, `${vid}.mp4`);
  const thumb = path.join(THUMB_CACHE, `${vid}.jpg`);

  console.log(`[${i + 1}/${VIDEOS.length}] ${short} — downloading...`);

  try {
    // Download from S3
    run("curl", ["-sL", "-o", input, url]);
    const size = (fs.statSync(input).size / 1024 / 1024).toFixed(1);
    console.log(`  Downloaded: ${size}MB`);

    // Check color space
    let isHDR = false;
    try {
      const probe = run("ffprobe", ["-v", "quiet", "-show_streams", "-select_streams", "v:0", input]);
      isHDR = probe.includes("bt2020") || probe.includes("arib-std-b67");
    } catch {}

    if (isHDR) {
      console.log(`  HDR → tonemap + SAR bake...`);
      run("ffmpeg", [
        "-y", "-i", input,
        "-vf", "zscale=t=linear:npl=300,format=gbrpf32le,tonemap=reinhard:desat=0,zscale=t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709",
        "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "128k",
        output,
      ]);
    } else {
      console.log(`  SDR → SAR bake...`);
      run("ffmpeg", [
        "-y", "-i", input,
        "-vf", "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1",
        "-c:v", "libx264", "-crf", "18", "-preset", "fast",
        "-movflags", "+faststart",
        "-c:a", "copy",
        output,
      ]);
    }

    // Generate thumbnail (SAR is now 1:1, just even-round)
    run("ffmpeg", [
      "-y", "-i", output,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-frames:v", "1", "-q:v", "2",
      thumb,
    ]);

    // Cleanup
    try { fs.unlinkSync(input); } catch {}

    const outSize = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ Done (${outSize}MB)\n`);
  } catch (e) {
    console.error(`  FAIL: ${e.message}\n`);
    try { fs.unlinkSync(input); } catch {}
  }
}

// Verify
console.log("=== Verify SAR ===");
for (const f of fs.readdirSync(SDR_CACHE).filter(f => f.endsWith(".mp4"))) {
  const vid = f.replace(".mp4", "");
  try {
    const sar = run("ffprobe", ["-v", "quiet", "-select_streams", "v:0", "-show_entries", "stream=sample_aspect_ratio", "-of", "csv=p=0", path.join(SDR_CACHE, f)]).trim();
    const dims = run("ffprobe", ["-v", "quiet", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(SDR_CACHE, f)]).trim();
    console.log(`  ${vid.slice(0, 8)} | SAR=${sar} | dims=${dims}`);
  } catch {}
}
