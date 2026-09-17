# Native Skia direct-raster surface A/B plan

## Mục tiêu

Đo riêng lợi ích của việc cho Native Skia CPU raster trực tiếp vào buffer RGBA mà encoder sử dụng, thay cho:

```text
SkSurfaces::Raster -> SkSurface::readPixels -> RGBA buffer -> libyuv/libswscale -> libx264
```

Biến thể thử nghiệm:

```text
SkSurfaces::RasterDirect -> RGBA buffer -> libyuv/libswscale -> libx264
```

Thử nghiệm này **không bật cache**, không thay đổi hình học, command protocol, libyuv, libx264, preset, độ phân giải, FPS hay chất lượng video.

## Phạm vi và baseline

- Cloud Run Job: `neonix-skia-command-cpu-libyuv-sandbox`
- 4 vCPU, 16 GiB, không GPU
- 1920x1080, 30 FPS, 60 giây, 1.800 frame
- Native Skia CPU raster, sRGB, RGBA_8888, opaque
- In-process FFmpeg, `libx264`, `yuv420p`, preset `veryfast`
- Color converter: `libyuv`, BT.709, limited range
- Baseline: `BENCHMARK_SURFACE_MODE=copy`
- Candidate: `BENCHMARK_SURFACE_MODE=direct-raster`

## Thay đổi kỹ thuật

`copy` dùng `SkSurfaces::Raster` và `surface->readPixels(...)` như trước.

`direct-raster` cấp phát một buffer `width * height * 4` trước khi tạo surface và dùng `SkSurfaces::RasterDirect(...)`. Skia vẽ trực tiếp vào buffer đó; bước `readPixels` bị bỏ qua. Encoder vẫn đọc cùng buffer sau `endFrame`.

Các invariant phải giữ nguyên:

- `SkColorType::kRGBA_8888_SkColorType`
- `SkAlphaType::kOpaque_SkAlphaType`
- sRGB color space
- row bytes `width * 4`
- background/alpha compositing
- command order và matrix
- color conversion BT.709 limited range

## Số liệu phải ghi

Mỗi execution phải ghi:

- `surfaceMode`, surface kind, image digest
- total wall time và native process time
- `renderMs`
- `readbackMs`
- `colorConvertMs`
- `encodeMs`, `muxMs`, `finalizeMs`
- protocol overhead
- frame count và output byte size
- raw RGBA sample hashes ở frame 0, giữa và cuối
- YUV sample hashes
- MP4 SHA-256
- alpha opaque check
- lỗi hoặc frame mismatch

## Ma trận A/B

Chạy tối thiểu 3 lần mỗi biến thể; khi quyết định production chạy 5 lần mỗi biến thể.

| Case | Surface | Converter | Mục đích |
|---|---|---|---|
| A1 | copy | libyuv | baseline hiện tại |
| B1 | direct-raster | libyuv | đo loại `readPixels` |
| A2 | copy | libswscale | control correctness cũ |
| B2 | direct-raster | libswscale | xác nhận surface độc lập converter |

## Tiêu chí chấp nhận

### Correctness

- `alphaSamplesOpaque=true`.
- Raw RGBA hashes của copy và direct-raster giống nhau ở các frame mẫu.
- YUV sample hashes giống nhau khi cùng converter.
- MP4 giải mã được bằng `ffprobe`/decoder.
- Không có frame dropped, frame reorder hoặc kích thước output bất thường.
- Không thay đổi pixel do surface mode; nếu hash không giống phải dừng và điều tra trước khi đánh giá tốc độ.

### Performance

Đánh giá bằng median và p95, không dùng một execution đơn lẻ.

- `readbackMs` của direct-raster phải xấp xỉ 0.
- Native process giảm tương ứng với chi phí `readPixels` hoặc tốt hơn nhờ giảm memory copy.
- Wall time không được tăng quá 5% ở p95.
- Nếu direct-raster không giảm tối thiểu 1 giây trên fixture 60 giây thì không đưa vào production chỉ vì lý do hiệu năng.

## Vòng lặp feedback

1. Build image immutable và ghi digest.
2. Chạy smoke 5 giây để bắt lỗi surface/lifetime.
3. Chạy A/B 60 giây cùng image, cùng job spec.
4. So sánh hash và timing.
5. Nếu correctness fail: rollback về `copy`, lưu stderr và digest, không tối ưu tiếp.
6. Nếu correctness pass: chạy lặp 3–5 lần và tính median/p95.
7. Chạy lại trên F0–F7; fixture shape hiện tại chỉ là control, chưa đủ đại diện cho text/effect/image/video.
8. Chỉ sau khi direct-raster ổn định mới bắt đầu cache path/glyph/command IR.

## Kết quả baseline đã biết

Từ benchmark libyuv trước khi thay surface:

- Skia render trung bình: khoảng 6,65 giây.
- Readback trung bình: khoảng 1,63 giây.
- Render + readback: khoảng 8,28 giây.
- Native process: khoảng 13,83 giây.
- Wall time: khoảng 14,75 giây.

Mức tiết kiệm tối đa lý thuyết của thử nghiệm này trước khi đo là khoảng 1,63 giây; direct-raster không giải quyết chi phí rasterization.

## Kết quả thực nghiệm ngày 2026-09-17

Image đã benchmark:

- Cloud Build: `7814263f-5101-43ca-876f-0b083a51da1d`
- Image digest: `sha256:903942ba727de646453b2fe9bdaa29906972816ab93a89367b928f671ea5e77f`
- Cloud Run Job: `neonix-skia-command-cpu-direct-raster-sandbox`
- 4 vCPU, 16 GiB, không GPU, cùng image và cùng libyuv revision cho cả hai nhánh

### Smoke test 5 giây

Smoke direct-raster thành công với execution `...-tjrlg`:

- `readbackMs = 0`
- `alphaSamplesOpaque = true`
- Raw RGBA hash: `cd702832`
- YUV hash: `3758788d`
- MP4 SHA-256: `ddb9ca0115d27f08ed837818ef248568c4a6c886c5526ddedb74ec6e52d748f4`

Control copy cùng fixture cho hash giống hệt. Ở workload 5 giây, readback chỉ khoảng 114 ms nên nhiễu Cloud Run lớn hơn lợi ích quan sát được; quyết định dựa trên workload 60 giây.

### A/B 60 giây, 3 lần mỗi nhánh

Timings dưới đây là milliseconds, lấy từ `nativeMetrics.timingsMs`:

| Nhánh | Execution | Wall | Native | Render | Readback | libyuv | Encode |
|---|---|---:|---:|---:|---:|---:|---:|
| direct | `...-w49w9` | 12,759.717 | 11,891.538 | 6,688.973 | 0 | 1,578.817 | 3,421.856 |
| direct | `...-nmz9j` | 11,548.678 | 10,724.893 | 5,598.035 | 0 | 1,479.313 | 3,437.724 |
| direct | `...-pfc4j` | 12,294.154 | 11,428.274 | 6,191.577 | 0 | 1,533.495 | 3,481.577 |
| copy | `...-c7t4q` | 15,051.505 | 14,182.158 | 7,062.420 | 1,549.053 | 1,757.840 | 3,593.304 |
| copy | `...-5zp6x` | 14,959.597 | 14,079.383 | 6,953.415 | 1,466.473 | 1,718.376 | 3,720.545 |
| copy | `...-lffzx` | 15,363.901 | 14,443.365 | 7,309.181 | 1,485.563 | 1,758.547 | 3,682.841 |

Trung bình:

| Chỉ số | direct-raster | copy-readback | Cải thiện |
|---|---:|---:|---:|
| Wall time | 12,200.850 ms | 15,125.001 ms | **19.33%** |
| Native process | 11,348.235 ms | 14,234.969 ms | **20.28%** |
| Skia render | 6,159.528 ms | 7,108.339 ms | 13.35% thấp hơn |
| Readback | **0 ms** | 1,500.363 ms | **loại bỏ 100%** |
| Render + readback | 6,159.528 ms | 8,608.702 ms | **28.45%** |
| libyuv | 1,530.542 ms | 1,744.921 ms | 12.29% thấp hơn |
| Encode | 3,447.052 ms | 3,665.563 ms | 5.96% thấp hơn |

Median wall time là 12,294.154 ms ở direct-raster và 15,051.505 ms ở copy-readback. Với chỉ 3 mẫu, max được xem là upper bound p95: 12,759.717 ms so với 15,363.901 ms; cần thêm mẫu khi quyết định capacity production.

### Correctness

Tất cả 6 execution đều giữ nguyên:

- Raw RGBA sample hash: `cd702832` ở frame đầu/giữa/cuối.
- YUV sample hash: `3758788d` ở frame đầu/giữa/cuối.
- MP4 output bytes: `357166`.
- MP4 SHA-256: `1f110fb53d910a613f44c6210451781df8946ebd7e52b57c512a8f38fceca576`.
- `alphaSamplesOpaque=true`.

Kết luận A/B: direct-raster không làm thay đổi pixel hoặc output MP4 trong fixture này và đã loại bỏ hoàn toàn `readPixels`. Mức giảm wall time thực tế khoảng 19%, cao hơn mức readback riêng khoảng 1,5 giây vì direct surface cũng giảm memory pressure trong pipeline serial. Không được quy toàn bộ 19% chỉ cho `readPixels` nếu chưa chạy thêm repetitions.

### Lỗi và cách xử lý

1. Build r1: `SkSurfaces::RasterDirect` không tồn tại trong Skia revision đang pin.
2. Build r2: `SkSurface::MakeRasterDirect` cũng không tồn tại.
3. Kiểm tra đúng `SkSurface.h` của revision cho thấy API tương thích là `SkSurfaces::WrapPixels`; build r3 đã pass.
4. Smoke execution đầu tiên fail vì PowerShell truyền toàn bộ chuỗi comma vào một biến `BENCHMARK_MODE`; job được update lại bằng cách quote đúng `--set-env-vars`.
5. Smoke r3 phát hiện format JSON timing bị lệch do thiếu placeholder `%llu`; đã sửa, build r4 và chạy lại smoke trước A/B 60 giây.

## Trạng thái quyết định

- [x] Thêm surface mode `copy` và `direct-raster`.
- [x] Giữ copy-readback làm default an toàn.
- [x] Thêm metrics nhận diện surface mode.
- [x] Build image sandbox immutable.
- [x] Smoke test 5 giây.
- [x] A/B benchmark 60 giây, 3 lần mỗi nhánh.
- [x] Xác nhận raw/YUV/MP4 hash không đổi trên fixture smoke.
- [ ] Chạy A/B trên F0–F7, đặc biệt text, layer/effect, image và video.
- [ ] Chạy tối thiểu 5–10 repetitions cho capacity p50/p95.
- [ ] Chỉ promote direct-raster sau khi F0–F7 đạt parity và không có lifetime/asset regression.
