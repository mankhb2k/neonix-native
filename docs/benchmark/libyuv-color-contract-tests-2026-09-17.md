# libyuv color-contract A/B tests — 2026-09-17

## Kết luận

Bộ test sandbox đã được tạo và chạy trên container Linux `linux/amd64`.
Pipeline `libyuv` hiện tại đạt gate parity `99,9%` khi so với `libswscale`
được cấu hình bằng `SWS_AREA`, cùng BT.709 limited-range contract:

```text
libyuv RGBA → YUV420P BT.709 limited
        vs.
libswscale SWS_AREA, RGB full → YUV420P limited, BT.709
```

Kết quả thực tế:

| Metric | Result |
| --- | ---: |
| Cases | 21 |
| Pixels/planes compared | 1.032.192 |
| Aggregate within ±1 | **100,000000%** |
| Y within ±1 | 100,000000% |
| U within ±1 | 100,000000% |
| V within ±1 | 100,000000% |
| Aggregate contract gate | **PASS** |
| Range failures | 0 |
| Channel-order failures | 0 |

Đây là kết quả của test chuyển đổi màu, không phải parity toàn bộ MP4 sau
H.264 encode. `libx264` vẫn có thể tạo sai khác pixel do lượng tử hóa; quality
MP4 cần được kiểm tra bằng decode + PSNR/SSIM/DeltaE riêng.

## Phạm vi kiểm tra

Test dùng fixture RGBA tổng hợp cố định ở `256×128`, gồm:

- black, white, gray;
- red, green, blue;
- cyan, magenta, yellow;
- các màu saturated trong color card;
- pattern gradient/chroma tần số cao;
- input stride `width * 4`, `+7`, `+13`, `+31` bytes.

Mỗi case chạy đồng thời qua `libyuv` và `libswscale`, sau đó so sánh toàn bộ
ba plane Y/U/V. Padding stride được đưa vào để phát hiện việc dùng sai
`width * 4` thay cho `rowBytes()`/source stride thực tế.

## Correctness contract

Input được khóa là:

```text
Skia bytes: R, G, B, A
libyuv mapping: ABGR little-endian = RGBA bytes in memory
matrix: kAbgrH709Constants
range: limited / TV
output: YUV420P
```

Oracle màu cố định kiểm tra:

| Input | Y kỳ vọng | U kỳ vọng | V kỳ vọng |
| --- | ---: | ---: | ---: |
| Black | 16 | 128 | 128 |
| White | 235 | 128 | 128 |
| Red | 63 | 102 | 240 |
| Green | 173 | 42 | 26 |
| Blue | 32 | 240 | 118 |

Tolerance của oracle là ±2 để không biến rounding hợp lệ thành lỗi. Test này
đã cho `rangeFailures=0` và `channelFailures=0`, nên chưa thấy lỗi full/limited
hoặc đảo Red/Blue.

## A/B filter của libswscale

Chạy cùng một binary, cùng input và cùng `kAbgrH709Constants`:

| Reference filter | Aggregate within ±1 | U within ±1 | V within ±1 | Max U/V | Gate |
| --- | ---: | ---: | ---: | ---: | --- |
| `SWS_POINT` | 96,002779% | 88,183594% | 87,833078% | 90 / 53 | Fail |
| `SWS_FAST_BILINEAR` | 99,218169% | 98,629325% | 99,119350% | 5 / 4 | Fail |
| `SWS_BILINEAR` | 97,962007% | 92,222377% | 95,549665% | 23 / 31 | Fail |
| `SWS_AREA` | **100,000000%** | **100,000000%** | **100,000000%** | 1 / 1 | **Pass** |

### SWS_AREA result chi tiết

| Plane | Samples | Exact | Within ±1 | Mean abs diff | P95 | P99 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Y | 688.128 | 79,511515% | 100,000000% | 0,204885 | 1 | 1 | 1 |
| U | 172.032 | 67,211914% | 100,000000% | 0,327881 | 1 | 1 | 1 |
| V | 172.032 | 68,164062% | 100,000000% | 0,318359 | 1 | 1 | 1 |

## Diễn giải

Sai khác trước đây không phải do `kAbgrH709Constants` dùng sai range. Khi
`libswscale` dùng `SWS_BILINEAR`, cách lọc chroma của reference khác với
libyuv nên U/V lệch đáng kể, đặc biệt ở saturated edge và pattern tần số cao.

`SWS_AREA` cho reference gần với phép giảm 2×2 của libyuv hơn. Vì vậy:

- dùng `SWS_AREA` cho correctness reference là hợp lý;
- không tự động đổi production libswscale từ `SWS_BILINEAR` sang `SWS_AREA`;
- nếu muốn thay đổi production control, cần chạy thêm A/B video decode và
  kiểm tra chất lượng hình ảnh, không chỉ dựa vào parity byte-level.

## Cách chạy

```powershell
docker build --platform=linux/amd64 `
  --file infra/cloud-run/export-renderer/libyuv-color-contract/Dockerfile `
  --tag neonix-libyuv-color-contract:v3 .

docker run --rm neonix-libyuv-color-contract:v3
docker run --rm neonix-libyuv-color-contract:v3 --sws-filter bilinear
docker run --rm neonix-libyuv-color-contract:v3 --enforce-parity
```

Lệnh `--enforce-parity` trả về exit code khác 0 nếu không đạt
`within ±1 >= 99,9%` trên cả Y, U và V.

## Vòng feedback tiếp theo

```text
RGBA contract test
       ↓
range/channel/stride gate
       ↓
libyuv vs libswscale SWS_AREA
       ↓
MP4 encode + ffprobe metadata
       ↓
decode MP4 → RGB
       ↓
PSNR / SSIM / DeltaE / visual heatmap
       ↓
3 repetitions trên Cloud Run 4 vCPU
       ↓
promotion hoặc giữ libyuv ở sandbox
```

## Files

- `infra/cloud-run/export-renderer/skia-gpu-poc/neonix_libyuv_color_ab_test.cpp`
- `infra/cloud-run/export-renderer/libyuv-color-contract/Dockerfile`
- `infra/cloud-run/export-renderer/libyuv-color-contract/cloudbuild.yaml`
- `packages/export-renderer/src/benchmark-libyuv-color-contract.ts`
- `packages/export-renderer/package.json`

Trạng thái hiện tại: **libyuv đạt parity conversion gate với reference
`SWS_AREA`; chưa thay đổi production converter và chưa coi đây là MP4 visual
parity cuối cùng.**
