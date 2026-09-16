#!/usr/bin/env bash
set -Eeuo pipefail

width="${BENCH_WIDTH:-1920}"
height="${BENCH_HEIGHT:-1080}"
frames="${BENCH_FRAMES:-1800}"
fps="${BENCH_FPS:-30}"
output="${BENCH_OUTPUT:-/tmp/native-skia-cpu.mp4}"
mode="export"

# Cloud Run's --args flag can arrive as one shell-like argument when the job
# is created through gcloud. Accept both normal argv and that representation.
if (($# == 1)) && [[ "$1" == *" "* ]]; then
  read -r -a split_args <<< "$1"
  set -- "${split_args[@]}"
fi

while (($#)); do
  case "$1" in
    --width) width="$2"; shift 2 ;;
    --height) height="$2"; shift 2 ;;
    --frames) frames="$2"; shift 2 ;;
    --fps) fps="$2"; shift 2 ;;
    --output) output="$2"; shift 2 ;;
    --render-only) mode="render-only"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$(dirname "$output")"
native_metrics=/tmp/neonix-native-skia-metrics.json
ffmpeg_log=/tmp/neonix-native-skia-ffmpeg.log
started_ms="$(date +%s%3N)"

if [[ "$mode" == "render-only" ]]; then
  /usr/local/bin/neonix-skia-cpu-backend --width "$width" --height "$height" --frames "$frames" \
    --output /tmp/neonix-native-skia-last-frame.ppm 2>"$native_metrics"
else
  set +e
  /usr/local/bin/neonix-skia-cpu-backend --width "$width" --height "$height" --frames "$frames" --raw 2>"$native_metrics" \
    | ffmpeg -hide_banner -loglevel error -f rawvideo -pixel_format rgba \
        -video_size "${width}x${height}" -framerate "$fps" -i - \
        -c:v libx264 -preset "${FFMPEG_PRESET:-veryfast}" -crf "${FFMPEG_CRF:-23}" \
        -threads "${FFMPEG_THREADS:-1}" \
        -pix_fmt yuv420p -movflags +faststart "$output" 2>"$ffmpeg_log"
  pipeline_status=$?
  set -e
  if [[ "$pipeline_status" -ne 0 ]]; then
    cat "$native_metrics" >&2 || true
    cat "$ffmpeg_log" >&2 || true
    exit "$pipeline_status"
  fi
fi

finished_ms="$(date +%s%3N)"
native_line="$(tail -n 1 "$native_metrics")"
printf '%s\n' "$native_line"
if [[ "$mode" == "export" && -f "$output" ]]; then
  output_bytes="$(stat -c %s "$output")"
  output_sha256="$(sha256sum "$output" | cut -d ' ' -f 1)"
else
  output_bytes=0
  output_sha256=""
fi
printf '{"ok":true,"benchmark":"native-skia-cpu-cloud-run","mode":"%s","width":%s,"height":%s,"frames":%s,"fps":%s,"output":"%s","outputBytes":%s,"outputSha256":"%s","wallMilliseconds":%s}\n' \
  "$mode" "$width" "$height" "$frames" "$fps" "$output" "$output_bytes" "$output_sha256" "$((finished_ms - started_ms))"
