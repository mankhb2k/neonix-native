# Báo cáo playback soak — 2026-08-28

## Cách chạy

- Runner: Playwright Chromium, 1 worker.
- Spec: `apps/web/e2e/playback-soak.spec.ts`.
- Thời lượng: 600 giây (10 phút 0.9 giây thực tế).
- Backend: WebGL2.
- Fixture video dài 3 giây được tự động seek về đầu khi chạm cuối để giữ composition clock chạy liên tục.
- Heap snapshot được chụp bằng CDP `HeapProfiler` sau `collectGarbage` trước và sau soak.

## Kết quả

| Chỉ số | Trước | Sau | Chênh lệch |
| --- | ---: | ---: | ---: |
| V8 used heap | 20,017,964 B | 20,771,772 B | +753,808 B (+3.77%) |
| Heap snapshot file | 24,739,508 B | 28,682,347 B | +3,942,839 B |
| Resource entries | 1 | 1 | 0 |
| Active assets/videos/rVFC | 1 / 1 / 1 | 1 / 1 / 1 | 0 |
| CPU/GPU preview bytes | 8,294,400 / 8,294,400 B | 8,294,400 / 8,294,400 B | 0 |
| Over-budget CPU bytes | 0 B | 0 B | 0 |
| Dropped-frame estimate | 11 | 13 | +2 |

Paint interval lấy mẫu mỗi 30 giây:

- Trung bình: khoảng 22.18 ms.
- Đỉnh: 39.1 ms.
- Không có diagnostics `error` hoặc `unavailable`.

## Artifact

- [Metrics JSON](</D:/NextJS/moticlip/apps/web/test-results/playback-soak-10-minute-pl-87bc4--during-continuous-playback-chromium/playback-soak.metrics.json>)
- [Heap before](</D:/NextJS/moticlip/apps/web/test-results/playback-soak-10-minute-pl-87bc4--during-continuous-playback-chromium/heap-before.heapsnapshot>)
- [Heap after](</D:/NextJS/moticlip/apps/web/test-results/playback-soak-10-minute-pl-87bc4--during-continuous-playback-chromium/heap-after.heapsnapshot>)

## Đánh giá

Không thấy dấu hiệu leak tuyến tính ở JS heap hoặc preview resource registry: resource count và byte count giữ nguyên trong suốt soak, V8 heap sau GC tăng khoảng 0.75 MB. Snapshot file tăng không phải chỉ báo leak đáng tin cậy vì format snapshot chứa metadata/runtime bookkeeping khác nhau.

Điểm cần theo dõi tiếp: paint interval có đỉnh 39.1 ms và trung bình cao hơn budget 16.7 ms. Đây là jank render theo thời điểm, không phải memory leak. Cần chạy thêm profile Chrome Performance/CPU throttling để tách main-thread compile/paint khỏi GPU upload; đồng thời chạy fixture video dài thực tế để loại ảnh hưởng của seek reset mỗi 3 giây.

WebGPU không được đo trong run này vì Chromium environment skip WebGPU; chạy cùng spec trên máy/CI có WebGPU để có baseline backend parity.
