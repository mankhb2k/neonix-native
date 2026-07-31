/**
 * Manual performance baseline checklist (không assert trong CI vì dễ flaky).
 *
 * Fixture sizes: 20 / 100 / 500 clips trên main + overlay.
 * Ghi lại trong release notes khi profile:
 *
 * 1. Scroll ngang TimelineBoard — React Profiler: Tracks render count phải = 0 nếu clips/lanes không đổi (sau Phase 3).
 * 2. Clip drag — Performance panel: tối đa 1 RAF flush / frame; không setState mỗi pointermove.
 * 3. Marquee — đo getBoundingClientRect một lần/session.
 * 4. Playback — playhead transform ~60fps; PreviewStage không sort clips mỗi frame.
 * 5. Long task — fixture 100 clip không có long task mới > 50ms khi scroll/scrub.
 */
export const PERFORMANCE_BASELINE_CLIP_COUNTS = [20, 100, 500] as const;
