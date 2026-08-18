/**
 * Slice a root visual layer (group = "scene") to a local-time window for
 * export bake. Root timing is reset to a local `start: 0` window of the
 * requested duration, and every descendant's `timing.start` is shifted by
 * `-localStart` so a clip starting mid-layer bakes the correct local timeline.
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";

type ComponentLayer = Extract<MotionLayer, { type: "component" }>;

function isKeyframesValue(value: unknown): value is {
  kind: "keyframes";
  keys: Array<Record<string, unknown>>;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "keyframes" && Array.isArray(record.keys);
}

/**
 * Shift a sliced root component's prop keyframes (`payload.props.*` with
 * `{ kind: "keyframes", keys: [{ t, ... }] }`) by `-localStart`. The root's
 * keyframe `t` values are scene-local, so a mid-scene slice must re-base them;
 * descendant components keep their own layer-local keyframes (unchanged).
 */
function shiftComponentKeyframes(
  payload: ComponentLayer["payload"],
  offset: number,
): ComponentLayer["payload"] {
  if (offset <= 0) return payload;
  let changed = false;
  const nextProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload.props)) {
    if (!isKeyframesValue(value)) {
      nextProps[key] = value;
      continue;
    }
    const keys = value.keys
      .map((k) => {
        const t = typeof k.t === "number" ? k.t : 0;
        return { ...k, t: t - offset };
      })
      .filter((k) => typeof k.t === "number" && k.t >= -1e-9)
      .map((k) => ({ ...k, t: Math.max(0, k.t as number) }));
    nextProps[key] = { ...value, keys };
    changed = true;
  }
  return changed
    ? ({ ...payload, props: nextProps } as ComponentLayer["payload"])
    : payload;
}

/**
 * Re-base the child list into the `[0, duration)` window: children fully
 * before/after the window are dropped; partial ones get their `timing.start`
 * shifted by `-localStart` and duration clamped to the window.
 */
function sliceChildWindow(
  children: MotionLayer[],
  localStart: number,
  duration: number,
): MotionLayer[] {
  const out: MotionLayer[] = [];
  for (const child of children) {
    const childStart = child.timing.start;
    const shiftedStart = childStart - localStart;
    const shiftedEnd = shiftedStart + child.timing.duration;
    // Entirely before the window → drop.
    if (shiftedEnd <= 1e-9) continue;
    // Entirely after the window → drop.
    if (shiftedStart >= duration - 1e-9) continue;

    const newStart = Math.max(0, shiftedStart);
    const newEnd = Math.min(duration, shiftedEnd);
    const nextDuration = Math.max(0.001, newEnd - newStart);
    const timing = { start: newStart, duration: nextDuration };
    if (child.type === "group") {
      // Grandchild timing is local to THIS group, not the root. The slice
      // window inside the group is `[localStart - childStart, …)`, so a
      // mid-root clip does not over-shift or drop nested descendants.
      const childWindowStart = Math.max(0, localStart - childStart);
      out.push({
        ...child,
        timing,
        children: sliceChildWindow(
          child.children,
          childWindowStart,
          nextDuration,
        ),
      });
    } else {
      out.push({ ...child, timing });
    }
  }
  return out;
}

/**
 * Deep-clone `scene` trimmed to [localStart, localStart + duration).
 * Result timing starts at 0 and lasts `duration` seconds.
 */
export function sliceScene(
  scene: MotionLayer,
  localStart: number,
  duration: number,
): MotionLayer {
  const dur = Math.max(0.001, duration);
  const start = Math.max(0, localStart);
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionLayer;
  const timing = { start: 0, duration: dur };
  if (cloned.type === "group") {
    return {
      ...cloned,
      timing,
      children: sliceChildWindow(cloned.children, start, dur),
    };
  }
  if (cloned.type === "component") {
    return {
      ...cloned,
      timing,
      payload: shiftComponentKeyframes(cloned.payload, start),
    };
  }
  return { ...cloned, timing };
}

/** Local time of a timeline clip at global `time` (same as preview). */
export function clipLocalTime(
  startTime: number,
  clipDuration: number,
  time: number,
): number {
  const local = time - startTime;
  if (local <= 0) return 0;
  if (local >= clipDuration) return Math.max(0, clipDuration - 1e-6);
  return local;
}
