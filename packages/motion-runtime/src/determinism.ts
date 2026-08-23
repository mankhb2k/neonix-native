/**
 * Determinism rules — single source of truth for frame rounding, epsilon,
 * stable sort, seed quantization, and locale invariance.
 *
 * Every module that touches time, geometry, or ordering MUST use these
 * constants and helpers to guarantee pixel-identical output across
 * Pixi preview, Remotion export, and render worker.
 *
 * Rule summary:
 * 1. Frame rounding: half-up via Math.floor(time * fps + FRAME_EPSILON)
 * 2. Geometry epsilon: 1e-12 for matrix invert, 1e-9 for length checks
 * 3. Sort tie-break: lexicographic by id after numeric sort
 * 4. Locale: never use String.localeCompare, Intl, or toLocaleString without explicit locale
 * 5. Seed: feed through deterministicUint32 before any PRNG
 */

// ── Epsilon constants ─────────────────────────────────────────────────

/**
 * Frame-time epsilon — prevents floating-point drift when converting
 * time ↔ frame index at common frame rates (24, 25, 30, 60 fps).
 * Empirical: Number.EPSILON (~2.2e-16) is too small for 60fps rounding;
 * multiplying by 8 gives enough headroom without snapping wrong frames.
 */
export const FRAME_EPSILON = Number.EPSILON * 8;

/**
 * Geometry epsilon for matrix invert / determinant checks.
 * Matches the existing pattern in spatial.ts and matrix.ts.
 */
export const GEOMETRY_EPSILON = 1e-12;

/**
 * Length epsilon — used for perimeter / path-length <= 0 checks.
 * Larger than geometry epsilon because path lengths accumulate error.
 */
export const LENGTH_EPSILON = 1e-9;

/**
 * Time-window clamp epsilon — keeps a local time strictly inside the
 * half-open segment `[0, duration)` when it lands on the boundary.
 * Much smaller than one frame at any supported fps, so it never eats a
 * legitimate frame; only prevents `t == duration` from snapping past the end.
 */
export const TIME_CLAMP_EPSILON = 1e-6;

// ── Frame rounding ────────────────────────────────────────────────────

/**
 * Round a time (in seconds) to a discrete frame index at the given fps.
 * Policy: floor(time * fps + FRAME_EPSILON) — equivalent to half-up rounding
 * after epsilon guard.
 */
export function roundTimeToFrame(time: number, fps: number): number {
  if (!Number.isFinite(time) || time < 0) return 0;
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error("FPS must be finite positive");
  return Math.floor(time * fps + FRAME_EPSILON);
}

/**
 * Quantize a time value to a stable millisecond index.
 * Used for evaluated-effect seeds so sub-frame jitter does not change hashes.
 *
 * Policy: floor with `TIME_CLAMP_EPSILON` guard — matches `roundTimeToFrame`,
 * not `Math.round`. This keeps `1.0005s → 1000ms` (sub-millisecond drift does
 * not push past the boundary) while still snapping the float representation
 * of `1.001s` (≈1000.9999999999999ms) up to `1001`.
 */
export function quantizeTimeToMilliseconds(time: number): number {
  if (!Number.isFinite(time) || time < 0) return 0;
  return Math.floor(time * 1000 + TIME_CLAMP_EPSILON);
}

/**
 * Convert a frame index back to exact frame time (NO epsilon — this
 * is the canonical time for that frame).
 */
export function frameToTime(frame: number, fps: number): number {
  if (!Number.isSafeInteger(frame) || frame < 0)
    throw new Error("Frame must be non-negative safe integer");
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error("FPS must be finite positive");
  return frame / fps;
}

/** Convert seconds to a deterministic half-open sample boundary. */
export function secondsToSamples(seconds: number, sampleRate: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Seconds must be finite and non-negative");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Sample rate must be finite and positive");
  }
  const samples = Math.floor(seconds * sampleRate + TIME_CLAMP_EPSILON);
  if (!Number.isSafeInteger(samples)) {
    throw new Error("Sample boundary exceeds safe integer range");
  }
  return samples;
}

/** Convert a non-negative sample boundary back to composition seconds. */
export function samplesToSeconds(sample: number, sampleRate: number): number {
  if (!Number.isSafeInteger(sample) || sample < 0) {
    throw new Error("Sample must be a non-negative safe integer");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Sample rate must be finite and positive");
  }
  return sample / sampleRate;
}

/**
 * Clamp a local time into the half-open segment window `[0, duration)`.
 * Never returns `duration` itself (backed off by `TIME_CLAMP_EPSILON`), so
 * `t → frame` maps to the last valid frame rather than past-the-end.
 */
export function clampSegmentLocalTime(
  localTime: number,
  duration: number,
): number {
  return Math.min(
    Math.max(0, localTime),
    Math.max(0, duration - TIME_CLAMP_EPSILON),
  );
}

// ── Sort tie-break ────────────────────────────────────────────────────

/**
 * Stable tie-break comparator for deterministic ordering.
 * After sorting by a numeric key (z-index, time, etc.), use this
 * to break ties by entity id so the same input always produces
 * the same layer order.
 */
export function deterministicTieBreak(a: string, b: string): number {
  // Lexicographic compare — no localeCompare because it's per-locale.
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Compare two numbers, then tie-break by id.
 * Usage: layers.sort((a, b) => numericThenId(a.zIndex, b.zIndex, a.id, b.id))
 */
export function numericThenId(
  aValue: number,
  bValue: number,
  aId: string,
  bId: string,
): number {
  const diff = aValue - bValue;
  if (diff !== 0) return diff;
  return deterministicTieBreak(aId, bId);
}

// ── Seed quantization ─────────────────────────────────────────────────

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

/**
 * Deterministic uint32 from seed + channel + sample index.
 * Pure random-access: output never depends on frame evaluation order.
 */
export function deterministicUint32(
  seed: string | number,
  channel: string,
  sampleIndex: number,
): number {
  if (!Number.isSafeInteger(sampleIndex) || sampleIndex < 0)
    throw new Error("Sample index must be a non-negative safe integer");
  const seedHash = typeof seed === "number" ? mix32(seed) : fnv1a(seed);
  return mix32(seedHash ^ fnv1a(channel) ^ mix32(sampleIndex));
}

/**
 * Deterministic float in [0, 1) from seed + channel + sample index.
 */
export function deterministicRandom(
  seed: string | number,
  channel: string,
  sampleIndex: number,
): number {
  return deterministicUint32(seed, channel, sampleIndex) / 0x1_0000_0000;
}

// ── Locale invariance ─────────────────────────────────────────────────

/**
 * Assert that no locale-dependent API is used without an explicit locale.
 * Call this in debug/test builds to catch accidental Intl or toLocaleString.
 *
 * Does nothing in production — the check is only for dev confidence.
 */
export function assertNoImplicitLocale(): void {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env?.NODE_ENV;
  if (nodeEnv === "production")
    return;
  // Best-effort: override toLocaleString to warn if called without locale arg.
  const original = Number.prototype.toLocaleString;
  if (
    (original as unknown as { __determinismWrapped?: boolean })
      .__determinismWrapped
  )
    return;

  Number.prototype.toLocaleString = function (...args: unknown[]) {
    if (args.length === 0) {
      console.warn(
        "[determinism] Number.toLocaleString() called without explicit locale — " +
          "this produces non-deterministic output across machines.",
      );
    }
    return original.apply(this, args as [string?, Intl.NumberFormatOptions?]);
  };
  (
    Number.prototype.toLocaleString as unknown as {
      __determinismWrapped?: boolean;
    }
  ).__determinismWrapped = true;
}
