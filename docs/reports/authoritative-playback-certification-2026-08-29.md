# Authoritative PlaybackEngine — certification snapshot

Ngày: 2026-08-29

## Đã kiểm tra

- `@motionvideo/playback-engine` unit tests: 11 files, 28 tests pass.
- Playback-engine typecheck: pass.
- Motion runtime typecheck: pass.
- Motion compiler typecheck: pass.
- Web app typecheck: pass.
- `git diff --check`: không có whitespace error.

## Đã khóa trong implementation

- Render tick không làm async transport operation cũ thành stale.
- `play → pause` khi `play()` còn pending không thể publish `playing` sau pause.
- Engine phát snapshot state thay đổi bất đồng bộ cho UI.
- `preparing` chỉ chuyển thành `playing` sau backend start hoàn tất.
- Composition clock có anchor cho AudioContext và rendered samples; monotonic
  clock là fallback explicit.
- Audio graph lập lịch look-ahead 12.000 samples (~250 ms) và không reset
  automation khi cửa sổ mới còn nằm trong vùng đã schedule.
- Video drift dùng policy thuần; hard-seek chỉ xảy ra khi vượt ngưỡng.

## Chưa tuyên bố hoàn tất

- Chưa chạy soak 30–60 phút trên máy người dùng trong snapshot này.
- WebAudio V1 vẫn dùng browser media decoder; chưa phải sample-accurate PCM.
- `StreamingWorklet` và `AudioSampleClock` production path vẫn là Phase V2.
- Các demo chuyên biệt trong `PreviewLab` còn native transport riêng; chúng không
  được coi là editor playback hot path cho đến khi migrate qua preview adapter.

## Tiêu chí Phase 8 còn lại

Chạy Playwright với media thật (audio-only, video-only, video embedded audio +
music), 1.000 scrubs, 100 play/pause/seek cycles và long-media soak; lưu metrics
drift, late schedule, underrun, heap và active media resources trước khi xóa
temporary compatibility code.
