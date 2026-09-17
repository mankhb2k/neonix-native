# libyuv color-conversion A/B sandbox benchmark — 2026-09-17

## Kết luận ngắn

Sandbox A/B đã hoàn thành trên Cloud Run với 4 vCPU, 16 GiB RAM, không GPU,
1920×1080, 30 fps, 1.800 frames/60 giây và in-process `libavcodec`.

- `libyuv` chạy nhanh hơn `libswscale` khoảng **46,85% wall time trung bình**
  trên hai lần lặp cho mỗi converter.
- Riêng bước RGBA → YUV420P giảm từ trung bình **14.108 ms** xuống
  **1.679 ms**, tức khoảng **88,10%**.
- Container, binary native, encoder và output MP4 đều chạy thành công với
  `libyuv`.
- Đối chiếu correctness 3 frame × 3 plane đạt `meanAbsDiff=0.153686`,
  `within1=99.7139%`, `within2=99.7455%`, `maxAbsDiff=10`.
- Color-card 24 patch 60 giây cho kết quả chặt hơn: aggregate
  `within1=99.5068%`, `meanAbsDiff=0.487365`, `maxAbsDiff=14`; Y có max 1,
  còn U/V có max 14 ở vùng biên màu bão hòa.
- Vì chưa đạt ngưỡng parity byte-exact 99,9% và fixture hiện tại là synthetic
  shapes tĩnh, **chưa promote libyuv vào production**. Đây là sandbox pass về
  tích hợp/hiệu năng, chưa phải quality gate cuối cùng.

## Mục tiêu và biến số

Mục tiêu là cô lập tác động của bộ chuyển đổi màu, không thay đổi renderer,
protocol, encoder hay tài nguyên Cloud Run.

| Thành phần | Cố định |
| --- | --- |
| Backend | Native Skia raster / `skia-native-raster` |
| Encoding | In-process FFmpeg libraries, `libx264`, `yuv420p` |
| Color contract | sRGB surface, BT.709, limited/TV range |
| Resolution/FPS | 1920×1080 @ 30 fps |
| Workload | `native-export-smoke`, 1.800 frames, 60 giây |
| Cloud Run | `asia-southeast1`, 4 vCPU, 16 GiB, 1 task, không GPU |
| Protocol | file transport, batch 1 frame, không pipe RGBA |
| Quality reference | `libswscale` với explicit BT.709 contract |
| libyuv | upstream revision `2dd4257364d39c38d79465c4ddc4b93137fe729b` |

Sandbox target và production target là hai binary khác nhau. Production image
không link và không ship libyuv.

## Artifact và triển khai

- Cloud Build r1 thất bại vì `libyuv-dev` Ubuntu 22.04 không có
  `ARGBToI420Matrix` và `kAbgrH709Constants`.
- Cloud Build r2 thành công nhưng smoke runtime thất bại vì thiếu
  `libyuv.so` trong loader bundle.
- Cloud Build r3 thành công và đã thêm toàn bộ `libyuv.so*` vào
  `/opt/ffmpeg-compat`.
- Cloud Build r4 thành công sau khi thêm color-card scene và thống kê riêng
  theo plane Y/U/V.

| Artifact | Giá trị |
| --- | --- |
| Cloud Build r1 | `406f2b3b-10be-4cef-8b58-f369bc95771a` — compile fail |
| Cloud Build r2 | `bf5b0c48-4eab-4619-8584-ff70898cdfe6` — success |
| Cloud Build r3 | `e054702f-1090-4deb-9a98-a5574defac6d` — success, 8m22s |
| Cloud Build r4 | `8cd88d50-e881-4bc3-bb3e-7f57c6e49e6e` — success, 11m59s |
| Image | `skia-command-cpu-libyuv-sandbox:20260917-ab-r3` |
| Image r4 | `skia-command-cpu-libyuv-sandbox:20260917-ab-r4` |
| Digest r4 | `sha256:551cca35bdd7a86305803c31daba29ad1e461e481a2834e5829f7610d5c19c09` |
| Cloud Run Job | `neonix-skia-command-cpu-libyuv-sandbox` |
| Runtime | native binary + in-process libavcodec/libavformat/libswscale + libyuv |

## Correctness smoke và 60-second compare

Execution `neonix-skia-command-cpu-libyuv-sandbox-k6f48` chạy 5 giây/150
frames với `BENCHMARK_COMPARE_COLOR=true`, selected converter là libyuv và
reference là libswscale. Execution 60 giây có compare là
`neonix-skia-command-cpu-libyuv-sandbox-fcn2k`.

| Metric | Measured |
| --- | ---: |
| Compared samples | 9.331.200 |
| Exact samples | 7.961.706 (85,3235%) |
| Within ±1 | 9.304.500 (99,7139%) |
| Within ±2 | 9.307.455 (99,7455%) |
| Mean absolute difference | 0,153686 |
| Maximum absolute difference | 10 |
| Comparison cost, 60s run | 47,220 ms |
| libyuv YUV sample hash | `3758788d` |
| libswscale YUV sample hash | `5e929f05` |
| MP4 output | 357.166 bytes, SHA-256 bắt đầu `1f110f...` |

### Diễn giải

Hai hash YUV khác nhau là bằng chứng trực tiếp rằng hai thuật toán không tạo
cùng từng byte. `within1` rất cao và mean error thấp, phù hợp với sai khác
rounding/chroma-subsampling, nhưng `maxAbsDiff=10` chưa đủ để khẳng định không
có lỗi màu ở mọi vùng ảnh. Vì vậy không dùng tiêu chí “99,9% gần đúng” nếu
chưa có thống kê riêng Y/U/V, heatmap và color-card fixture.

Đối chiếu chỉ lấy frame 0, giữa và cuối; workload synthetic hiện tạo cùng
khung hình tĩnh ở các sample. Nó xác nhận đường chuyển đổi/stride/metadata
hoạt động, nhưng chưa thay thế bộ color-card động và fixture có image/video.

### Color-card correctness

Execution `neonix-skia-command-cpu-libyuv-sandbox-n4x5p` chạy 60 giây với
24 patch màu phẳng, selected converter là libyuv và reference là libswscale.
Execution đối xứng `neonix-skia-command-cpu-libyuv-sandbox-tlxch` chọn
libswscale và reference là libyuv. Hai execution cho cùng số liệu tuyệt đối,
chứng minh wrapper/instrumentation không tạo sai lệch theo chiều so sánh.

| Plane | Samples | Exact | Within ±1 | Within ±2 | Mean abs diff | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Y | 6.220.800 | 2.808.000 | 100,0000% | 100,0000% | 0,548611 | 1 |
| U | 1.555.200 | 1.181.580 | 98,5455% | 98,6960% | 0,333526 | 14 |
| V | 1.555.200 | 1.113.720 | 98,4954% | 98,5455% | 0,396219 | 14 |

Kết quả không đạt ngưỡng đề xuất `within1 >= 99,9%`. Sai khác tập trung ở
chroma U/V và tăng rõ rệt tại ranh giới các patch màu; đây là lý do giữ
libyuv trong sandbox, không thay thế libswscale production. Muốn đạt gate
99,9% cần khóa cùng chroma filter/siting/rounding hoặc chọn một reference
color-science độc lập thay vì ép hai thuật toán khác nhau phải byte-identical.

## A/B hiệu năng 60 giây

Các run đều encode thành công, `alphaSamplesOpaque=true`,
`surfaceColorSpace=srgb`, `videoColorSpace=bt709`, `videoColorRange=limited`.
Không cộng các timing chồng lấn; `applicationWall` và `nativeProcess` là tổng
để so sánh, còn stage timings dùng để khoanh vùng.

### Các lần chạy thực tế

| Converter | Execution | Wall ms | Native ms | Render ms | Readback ms | Color convert ms | Encode ms | Output bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| libswscale | `...-zbmcz` | 27.300,401 | 26.299,121 | 6.841,544 | 1.783,625 | 13.689,395 | 3.671,932 | 353.739 |
| libswscale | `...-86bnt` | 28.216,749 | 27.319,727 | 7.164,062 | 1.756,905 | 14.526,019 | 3.636,824 | 353.739 |
| libyuv | `...-mdj46` | 15.715,311 | 14.759,389 | 7.328,894 | 1.501,615 | 1.784,454 | 3.867,250 | 357.166 |
| libyuv | `...-fqmvt` | 13.794,118 | 12.902,324 | 5.970,221 | 1.750,397 | 1.574,139 | 3.330,397 | 357.166 |

Execution `...-fcn2k` là run libyuv 60 giây có correctness compare: wall
13.582,959 ms, native 12.771,317 ms, color convert 1.518,798 ms và compare
47,220 ms. Run này không đưa vào cặp performance chính vì có thêm compare.

### Tổng hợp A/B

| Chỉ số | libswscale trung bình | libyuv trung bình | Thay đổi |
| --- | ---: | ---: | ---: |
| Application wall | 27.759 s | 14.755 s | **-46,85%** |
| Native process | 26.809 s | 13.831 s | -48,41% |
| Render | 7.003 s | 6.650 s | -5,03% |
| Readback | 1.770 s | 1.626 s | -8,15% |
| Color convert | 14.108 s | 1.679 s | **-88,10%** |
| Encode | 3.654 s | 3.599 s | -1,51% |

Chênh lệch output MP4 là hệ quả expected của YUV input khác nhau; kích thước
không phải quality metric. Cả hai đều giữ `libx264`, `yuv420p` và cùng preset,
nên A/B này không đánh đổi tốc độ bằng encoder nhanh hơn.

## Tiêu chí promotion

libyuv chỉ được đưa vào production sau khi tất cả điều kiện sau đạt:

1. Color-card fixture BT.709 có black/white, primary/secondary, gray ramp,
   skin-like colors, alpha-over-background và saturated edges.
2. Đo riêng Y, U, V: exact, within ±1/±2, mean, p95/p99, max và số pixel
   khác biệt theo từng frame; không chỉ aggregate toàn bộ plane.
3. Decode hai MP4 về cùng raw format, kiểm tra metadata bằng `ffprobe`, rồi
   tính PSNR/SSIM/ΔE trên RGB/YUV. `maxAbsDiff=10` hiện phải được giải thích
   bằng heatmap trước khi nới gate.
4. Chạy cùng bộ test ở 8-bit RGBA packed và các `rowBytes`/stride khác nhau;
   xác nhận không có channel swap, padding leak, OOB hoặc alpha leak.
5. Lặp tối thiểu 3 lần mỗi converter trên cùng revision/image; dùng median và
   p95, không dùng một run đơn lẻ.
6. Giữ feature fixtures riêng: text/font, image decode, SVG/path, effect,
   animation; kết quả color A/B không được coi là parity của toàn bộ F0–F7.

Ngưỡng đề xuất cho promotion: `within1 >= 99.9%`, `meanAbsDiff <= 0.05`,
`maxAbsDiff` phải nằm trong sai số đã được giải thích theo plane/fixture, và
không có mismatch ở các patch màu phẳng. Nếu mục tiêu là tương thích với
libswscale chứ không phải với reference color-science độc lập, cần khóa luôn
chroma siting và rounding contract của reference.

## Vòng lặp feedback tiếp theo

```text
color-card + dynamic fixture
        ↓
libyuv / libswscale cùng RGBA snapshot
        ↓
Y/U/V per-plane diff + heatmap + ffprobe
        ↓
phân loại matrix / range / channel / stride / chroma rounding
        ↓
patch wrapper hoặc contract
        ↓
3-run Cloud Run repeat
        ↓
promotion gate hoặc giữ sandbox
```

## Files đã thay đổi

- `packages/skia-renderer/native/skia_command_cpu_backend.cpp`: converter
  switch, libyuv BT.709 matrix, compare samples và instrumentation.
- `packages/export-renderer/src/benchmark-native-skia-command-cpu.ts`: env
  `BENCHMARK_COLOR_CONVERTER`, `BENCHMARK_COMPARE_COLOR`, result fields.
- `packages/export-renderer/src/testing.ts`: `native-color-card` với 24 patch
  màu phẳng.
- `infra/cloud-run/export-renderer/skia-gpu-poc/neonix_skia_target.gni`:
  sandbox native target/linking.
- `infra/cloud-run/export-renderer/skia-command-cpu-libyuv-sandbox/Dockerfile`:
  pinned libyuv source build và runtime ABI bundle.
- `infra/cloud-run/export-renderer/skia-command-cpu-libyuv-sandbox/cloudbuild.yaml`:
  reproducible Cloud Build image.

Machine-readable summary: `docs/benchmark/results/libyuv-color-ab-sandbox-2026-09-17.json`.
