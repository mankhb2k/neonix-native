/**
 * Manual performance baseline checklist (không assert wall-clock trong CI vì dễ flaky).
 *
 * Fixture sizes: 20 / 100 / 500 / 2000 clips — see `large-timeline.ts`.
 * Automated gate: DOM-count ≈ visible + overscan + pins (visible-range.test + virtualization test).
 *
 * Ghi lại trong release notes khi profile:
 *
 * 1. Scroll ngang TimelineBoard — React Profiler: offscreen TimelineClipItem không mount.
 * 2. Clip drag — Performance panel: tối đa 1 RAF flush / frame; không setState mỗi pointermove.
 * 3. Marquee — đo getBoundingClientRect một lần/session (hoặc domain geometry).
 * 4. Playback — playhead transform ~60fps; PreviewStage không sort clips mỗi frame.
 * 5. Long task — fixture 500 clip không có long task mới > 50ms khi scroll/scrub.
 */
export {
  PERFORMANCE_BASELINE_CLIP_COUNTS,
  createDenseTimelineFixture,
  expectedVisibleClipBudget,
} from "./large-timeline";
