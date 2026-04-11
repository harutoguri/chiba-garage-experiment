#!/bin/bash
# Batch re-convert all videos from S3 originals with SAR baking
# Usage: bash batch-reconvert.sh

set -e
SDR_CACHE=".sdr-cache"
THUMB_CACHE=".sdr-thumb-cache"
TMP_DIR=".bt709-tmp"
mkdir -p "$SDR_CACHE" "$THUMB_CACHE" "$TMP_DIR"

# Video list: bunnyVideoId | S3 URL
# From tRPC vehicles.listWithMedia + consignment.listWithMedia
declare -A VIDEOS=(
  ["18b7391b-d5a2-42ae-97b8-68a3590a7523"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/xVJm75C0Y54i7oIt3YZVx.mp4"
  ["62f056f9-aca0-48d0-9e69-96c5455b0eae"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/h264-30002-0512d5ecdbd83759.mp4"
  ["835a6bec-9684-4a31-b98b-33c771dee032"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/VzH6pte7E72TTmNy25LFc.mp4"
  ["7c301445-f2e5-4fb0-bd57-f9efe71289aa"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/gCxE6LiStNXfpD_O-wtZR.mp4"
  ["5e40e31d-9133-4468-b9c7-05daad4fdc3e"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/HZNF8FAnf4aFdoyw3TqRP.mp4"
  ["f0375b57-76cd-48d8-9f69-4a1e8c0bdb28"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/5XpuHuplJ6yGyENmyT4LQ.mp4"
  ["a6169724-85c1-478c-887a-f5f591ef0363"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/F7li1AEs-oAlMIhjRsczL.mp4"
  ["e763e9ed-2035-4d8a-bea5-cb61d1fca8ba"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/DsQecYSVFG6eEefQef-1Y.mp4"
  ["ffbf9107-caff-4f16-b947-4219454bfa7d"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/zwtohIZJmKdSSseVsG5fA.mp4"
  ["09622a0b-adec-4fed-88a6-62c9dd2a83c1"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/-1wWuDIHywxLW9J1Yi4ZB.mp4"
  ["ce01d862-e884-4c41-9915-d43b6514ae94"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/n-3yPQzIyBuL0HCQnMfp1.mp4"
  ["bc5387f7-f5db-4730-af9f-8cd4b2f828f0"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/3CFBHNRxwcj5CDajFHsbe.mp4"
  ["0331d9f4-cd31-4a69-860f-d583664ac24c"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/piQzHH3qhRMxg9Np0HUIv.mp4"
  ["17ed05e6-4f08-4ce3-beee-c17f265acf3e"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/N5Ati3FgJUn6e_QL_M8ad.mp4"
  ["8dedf3e4-33d7-42f0-896a-1397ed908949"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/dGfRrEymwSrJbw0v66cwj.mp4"
  ["455695b2-daff-4de0-a8d8-b556a00d4b7c"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/HvWpcusmFpq2t90wg0xPu.mp4"
  ["1d9675f5-652e-46df-9a74-668edf52bbe3"]="https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/GLuSTIexh5F8BMX2JRHfO.mp4"
)

# Videos without S3 URL (pipeline uploads) — skip download, re-encode from existing cache
NO_S3_VIDEOS=("74cfa784-2558-4495-8bad-c319e0221703" "e1147dd3-bfb5-46cc-bca5-8d0b303ad573" "6a94f6bc-ab12-4998-b4f3-8bd8daad3628" "8c2a21ca-94a0-459f-be27-4fbc6bbc1e2a" "93066eff-0204-4af6-8173-b113fc3bdaa1")

TOTAL=${#VIDEOS[@]}
COUNT=0

echo "=== Batch Re-conversion: $TOTAL S3 videos + ${#NO_S3_VIDEOS[@]} local videos ==="
echo ""

# Process S3 videos
for VID in "${!VIDEOS[@]}"; do
  COUNT=$((COUNT + 1))
  URL="${VIDEOS[$VID]}"
  SHORT="${VID:0:8}"
  INPUT="$TMP_DIR/${VID}_input.mp4"
  OUTPUT="$SDR_CACHE/${VID}.mp4"
  THUMB="$THUMB_CACHE/${VID}.jpg"

  echo "[$COUNT/$TOTAL] $SHORT — downloading from S3..."

  # Download from S3
  if ! curl -sL -o "$INPUT" "$URL"; then
    echo "  FAIL: download error"
    continue
  fi

  FILESIZE=$(du -h "$INPUT" | cut -f1)
  echo "  Downloaded: $FILESIZE"

  # Check color space
  PROBE=$(ffprobe -v quiet -show_streams -select_streams v:0 "$INPUT" 2>/dev/null || true)
  IS_HDR=false
  if echo "$PROBE" | grep -qE "bt2020|arib-std-b67"; then
    IS_HDR=true
  fi

  if $IS_HDR; then
    echo "  HDR detected → tonemap + SAR bake..."
    ffmpeg -y -i "$INPUT" \
      -vf "zscale=t=linear:npl=300,format=gbrpf32le,tonemap=reinhard:desat=0,zscale=t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1" \
      -c:v libx264 -preset medium -crf 18 \
      -colorspace bt709 -color_trc bt709 -color_primaries bt709 \
      -movflags +faststart \
      -c:a aac -b:a 128k \
      "$OUTPUT" 2>/dev/null
    echo "  ✓ HDR→SDR + SAR bake done"
  else
    echo "  SDR → SAR bake..."
    ffmpeg -y -i "$INPUT" \
      -vf "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1" \
      -c:v libx264 -crf 18 -preset fast \
      -movflags +faststart \
      -c:a copy \
      "$OUTPUT" 2>/dev/null
    echo "  ✓ SDR + SAR bake done"
  fi

  # Generate thumbnail
  ffmpeg -y -i "$OUTPUT" \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -frames:v 1 -q:v 2 \
    "$THUMB" 2>/dev/null
  echo "  ✓ Thumbnail generated"

  # Cleanup
  rm -f "$INPUT"

  OUTSIZE=$(du -h "$OUTPUT" | cut -f1)
  echo "  Output: $OUTSIZE"
  echo ""
done

# Process local-only videos (no S3 URL)
echo "=== Processing ${#NO_S3_VIDEOS[@]} local-only videos ==="
for VID in "${NO_S3_VIDEOS[@]}"; do
  SHORT="${VID:0:8}"
  EXISTING="$SDR_CACHE/${VID}.mp4"
  THUMB="$THUMB_CACHE/${VID}.jpg"

  if [ ! -f "$EXISTING" ]; then
    echo "  $SHORT — no cache file, skipping"
    continue
  fi

  # Check if SAR is already 1:1
  SAR=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=sample_aspect_ratio -of csv=p=0 "$EXISTING" 2>/dev/null)
  if [ "$SAR" = "1:1" ] || [ "$SAR" = "N/A" ]; then
    echo "  $SHORT — SAR already 1:1, regenerating thumbnail only"
    ffmpeg -y -i "$EXISTING" \
      -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
      -frames:v 1 -q:v 2 \
      "$THUMB" 2>/dev/null
    echo "  ✓ Thumbnail regenerated"
    continue
  fi

  echo "  $SHORT — SAR=$SAR, re-encoding with SAR bake..."
  TMP="$TMP_DIR/${VID}_reencode.mp4"
  ffmpeg -y -i "$EXISTING" \
    -vf "scale=trunc(iw*sar/2)*2:trunc(ih/2)*2,setsar=1" \
    -c:v libx264 -crf 18 -preset fast \
    -movflags +faststart \
    -c:a copy \
    "$TMP" 2>/dev/null
  mv "$TMP" "$EXISTING"

  ffmpeg -y -i "$EXISTING" \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -frames:v 1 -q:v 2 \
    "$THUMB" 2>/dev/null
  echo "  ✓ SAR bake + thumbnail done"
done

echo ""
echo "=== DONE ==="
echo "Verify SAR:"
for f in "$SDR_CACHE"/*.mp4; do
  vid=$(basename "$f" .mp4)
  sar=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=sample_aspect_ratio -of csv=p=0 "$f" 2>/dev/null)
  dims=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f" 2>/dev/null)
  echo "  ${vid:0:8} | SAR=$sar | dims=$dims"
done
