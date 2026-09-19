import type {
  MotionProtocolV2,
  V2AnimatableValue,
  V2Easing,
  V2Track,
} from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];

/**
 * Samples V2 tracks at the authoring timeline position. Keeping this in the
 * compiler package makes docs previews and production frame compilation use
 * exactly the same playback semantics.
 */
export function sampleMotionProtocolAtTime(
  project: MotionProtocolV2,
  timeSeconds: number,
): MotionProtocolV2 {
  let changed = false;
  const layers = project.layers.map((layer) => {
    const sampledLayer = sampleMotionLayerAtTime(layer, timeSeconds);
    if (sampledLayer !== layer) changed = true;
    return sampledLayer;
  });
  return changed ? { ...project, layers } : project;
}

/** Sample one Protocol V2 layer using the canonical runtime animation policy. */
export function sampleMotionLayerAtTime(
  layer: V2Layer,
  timeSeconds: number,
): V2Layer {
  if (!layer.tracks?.length) return layer;
  let sampledLayer: V2Layer = layer;
  const localTimeMs = Math.max(0, timeSeconds * 1000) - layer.timing.start;
  for (const track of layer.tracks) {
    const sampled = sampleTrack(track, localTimeMs);
    if (sampled === undefined) continue;
    // Ordered transform operations represent the authored/base CSS transform.
    // Once a component transform track is active, its sampled values represent
    // the complete CSS `transform` property for that instant. Keeping the base
    // operation list would compose the old transform on top of the animation
    // (for example, a static rotate(45deg) would survive a keyframe that only
    // contains translateY(0)), which does not match browser replacement
    // semantics.
    if (track.path.startsWith("transform.") && sampledLayer.transform.operations?.length) {
      sampledLayer = {
        ...sampledLayer,
        transform: { ...sampledLayer.transform, operations: undefined },
      } as V2Layer;
    }
    sampledLayer = applyTrackValue(sampledLayer, track.path, toPropertyValue(sampled));
  }
  return sampledLayer;
}

function sampleTrack(track: V2Track, timeMs: number): V2AnimatableValue | undefined {
  const first = track.keyframes[0];
  if (!first) return undefined;
  const animation = track.animation;
  const durationMs = animation?.durationMs ?? Math.max(first.time, track.keyframes.at(-1)?.time ?? 1);
  const delayMs = animation?.delayMs ?? 0;
  const fillMode = animation?.fillMode ?? "both";
  const activeMs = timeMs - delayMs;

  if (activeMs < 0) return fillMode === "backwards" || fillMode === "both" ? first.value : undefined;
  // `playState` is authoring/transport metadata. The caller owns the shared
  // timeline clock, so explicit scrubbing and Play/Pause transport must sample
  // the same timeline for Browser CSS and runtime output. A paused transport
  // simply does not advance `timeSeconds`; it must not freeze seeking at t=0.

  const iterations = animation?.iterations ?? 1;
  const finiteIterations = typeof iterations === "number";
  const activeDuration = finiteIterations ? durationMs * iterations : Number.POSITIVE_INFINITY;
  if (activeMs >= activeDuration) {
    return fillMode === "forwards" || fillMode === "both" ? directedValue(track, durationMs, iterations, true) : undefined;
  }

  const iteration = durationMs > 0 ? Math.floor(activeMs / durationMs) : 0;
  const remainder = durationMs > 0 ? activeMs - iteration * durationMs : durationMs;
  const progress = durationMs > 0 ? Math.max(0, Math.min(1, remainder / durationMs)) : 1;
  const direction = animation?.direction ?? "normal";
  const reverse = direction === "reverse"
    || (direction === "alternate" && iteration % 2 === 1)
    || (direction === "alternate-reverse" && iteration % 2 === 0);
  return sampleKeyframes(track, reverse ? durationMs * (1 - progress) : durationMs * progress);
}

function directedValue(track: V2Track, durationMs: number, iterations: number | "infinite", atEnd: boolean): V2AnimatableValue {
  const fractional = typeof iterations === "number" && iterations > 0 ? iterations % 1 : 0;
  const lastIteration = typeof iterations === "number" && iterations > 0
    ? Math.max(0, fractional > 0 ? Math.floor(iterations) : Math.ceil(iterations) - 1)
    : 0;
  // A fractional iteration ends part-way through its final cycle. At the
  // active-duration boundary, `2.5` must sample progress `.5`, not jump to
  // the final keyframe as a full second iteration would.
  const endpointProgress = fractional > 0 ? fractional : 1;
  const direction = track.animation?.direction ?? "normal";
  const reverse = direction === "reverse"
    || (direction === "alternate" && lastIteration % 2 === 1)
    || (direction === "alternate-reverse" && lastIteration % 2 === 0);
  const progress = reverse && atEnd ? 1 - endpointProgress : endpointProgress;
  return sampleKeyframes(track, durationMs * progress);
}

function sampleKeyframes(track: V2Track, timeMs: number): V2AnimatableValue {
  const keyframes = track.keyframes;
  const first = keyframes[0]!;
  if (timeMs < first.time) return first.value;
  // CSS timing functions are applied to the interval starting at a
  // keyframe. In particular, steps(..., jump-start) has already advanced at
  // t=0, so returning the raw first value here makes the first plateau differ
  // from the browser. Keep the exact-boundary case on the first segment.
  if (timeMs === first.time && keyframes.length > 1) {
    const right = keyframes.slice(1).find((keyframe) => keyframe.time > first.time);
    if (right) {
      const progress = applyEasing(first.easing, 0);
      if (track.interpolation?.type === "discrete") return progress < 1 ? first.value : right.value;
      return interpolateValue(first.value, right.value, progress);
    }
    return first.value;
  }
  const last = keyframes[keyframes.length - 1]!;
  if (timeMs >= last.time) return last.value;
  const rightIndex = keyframes.findIndex((keyframe) => keyframe.time >= timeMs);
  if (rightIndex <= 0) return first.value;
  const left = keyframes[rightIndex - 1]!;
  const right = keyframes[rightIndex]!;
  const span = right.time - left.time;
  const normalized = span > 0 ? (timeMs - left.time) / span : 1;
  const progress = applyEasing(left.easing, normalized);
  if (track.interpolation?.type === "discrete") return progress < 1 ? left.value : right.value;
  return interpolateValue(left.value, right.value, progress);
}

function interpolateValue(left: V2AnimatableValue, right: V2AnimatableValue, progress: number): V2AnimatableValue {
  if (left.type !== right.type) return progress < 1 ? left : right;
  if (left.type === "number" && right.type === "number") return { type: "number", value: left.value + (right.value - left.value) * progress };
  if ((left.type === "vec2" && right.type === "vec2") || (left.type === "vec3" && right.type === "vec3") || (left.type === "vec4" && right.type === "vec4") || (left.type === "color" && right.type === "color")) {
    const values = left.value.map((value, index) => value + (right.value[index]! - value) * progress);
    if (left.type === "vec2") return { type: "vec2", value: [values[0]!, values[1]!] };
    if (left.type === "vec3") return { type: "vec3", value: [values[0]!, values[1]!, values[2]!] };
    if (left.type === "vec4") return { type: "vec4", value: [values[0]!, values[1]!, values[2]!, values[3]!] };
    return { type: "color", value: [values[0]!, values[1]!, values[2]!, values[3]!] };
  }
  return progress < 1 ? left : right;
}

function applyEasing(easing: V2Easing | undefined, progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  if (!easing || easing.type === "linear") return t;
  if (easing.type === "step") {
    const count = Math.max(1, easing.count ?? 1);
    if (easing.position === "jump-start") return Math.min(count, Math.floor(t * count) + 1) / count;
    if (easing.position === "jump-none") return Math.min(count, Math.max(0, Math.floor(t * count + 0.5))) / count;
    if (easing.position === "jump-both") return Math.min(count + 1, Math.floor(t * (count + 1)) + 1) / (count + 1);
    return Math.floor(t * count) / count;
  }
  if (easing.type === "cubicBezier") {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 18; index += 1) {
      const guess = (low + high) / 2;
      if (cubicBezierAxis(guess, easing.x1, easing.x2) < t) low = guess;
      else high = guess;
    }
    return cubicBezierAxis((low + high) / 2, easing.y1, easing.y2);
  }
  return springProgress(easing.mass, easing.stiffness, easing.damping, easing.velocity ?? 0, t);
}

function cubicBezierAxis(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function springProgress(mass: number, stiffness: number, damping: number, velocity: number, t: number): number {
  const angular = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  if (dampingRatio < 1) {
    const dampedAngular = angular * Math.sqrt(1 - dampingRatio * dampingRatio);
    const envelope = Math.exp(-dampingRatio * angular * t);
    return 1 - envelope * (Math.cos(dampedAngular * t) + ((dampingRatio * angular - velocity) / dampedAngular) * Math.sin(dampedAngular * t));
  }
  return 1 - Math.exp(-angular * t) * (1 + (angular - velocity) * t);
}

function toPropertyValue(value: V2AnimatableValue): unknown {
  if (value.type !== "color") return value.value;
  // Keep exact half-way channel values stable across floating-point paths;
  // CSS/browser serialization rounds 181.5 to 182 rather than leaking a
  // one-byte difference from values such as the first steps() plateau.
  const channels = value.value.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255 + 1e-9));
  const hex = channels.slice(0, 3).map((channel) => channel!.toString(16).padStart(2, "0")).join("");
  return channels[3] === 255 ? `#${hex}` : `#${hex}${channels[3]!.toString(16).padStart(2, "0")}`;
}

function applyTrackValue(layer: V2Layer, path: string, value: unknown): V2Layer {
  // V2 tracks use the canonical vec2 tuple representation, while the
  // render3d perspective context remains an ergonomic named-coordinate
  // object in the layer schema. Materialize that boundary explicitly before
  // the generic path writer runs.
  if (path === "render3d.perspective.origin" && Array.isArray(value) && value.length === 2
    && value.every((item) => typeof item === "number")) {
    return assignPath(layer, ["render3d", "perspective", "origin"], { x: value[0], y: value[1] }) as V2Layer;
  }
  const segments = path.split(".");
  if (segments[0] === "effects") {
    const effectId = segments[1];
    if (!effectId || !("effects" in layer) || !layer.effects) return layer;
    return { ...layer, effects: layer.effects.map((effect) => effect.id === effectId ? assignPath(effect, segments.slice(2), value) : effect) } as V2Layer;
  }
  if (segments[0] === "backdropEffects") {
    const effectId = segments[1];
    if (!effectId || !layer.backdropEffects) return layer;
    return { ...layer, backdropEffects: layer.backdropEffects.map((effect) => effect.id === effectId ? assignPath(effect, segments.slice(2), value) : effect) } as V2Layer;
  }
  // Text spans/chunks are addressed by id, not array index, so the authoring
  // path omits the chunk index entirely (`payload.chunks.spans.<spanId>...`).
  // The generic writer below cannot resolve a non-numeric segment after an
  // array; find the owning chunk/span explicitly and rewrite only that span.
  if (layer.type === "text" && segments[0] === "payload" && segments[1] === "chunks" && segments[2] === "spans") {
    const spanId = segments[3];
    if (!spanId) return layer;
    const rest = segments.slice(4);
    let found = false;
    const chunks = layer.payload.chunks.map((chunk) => {
      if (!chunk.spans.some((span) => span.id === spanId)) return chunk;
      found = true;
      return { ...chunk, spans: chunk.spans.map((span) => span.id === spanId ? assignPath(span, rest, value) : span) };
    });
    if (!found) return layer;
    return { ...layer, payload: { ...layer.payload, chunks } } as V2Layer;
  }
  // Chunks are addressed by their own id directly (not a literal "spans"
  // segment); this must run after the span branch above so a chunk id can
  // never collide with the reserved "spans" literal.
  if (layer.type === "text" && segments[0] === "payload" && segments[1] === "chunks" && segments[2] !== undefined) {
    const chunkId = segments[2];
    const rest = segments.slice(3);
    let found = false;
    const chunks = layer.payload.chunks.map((chunk) => {
      if (chunk.id !== chunkId) return chunk;
      found = true;
      return assignPath(chunk, rest, value) as typeof chunk;
    });
    if (!found) return layer;
    return { ...layer, payload: { ...layer.payload, chunks } } as V2Layer;
  }
  return assignPath(layer, segments, value) as V2Layer;
}

function assignPath(source: unknown, segments: readonly string[], value: unknown): unknown {
  const segment = segments[0];
  if (!segment) return value;
  if (Array.isArray(source)) {
    const index = Number(segment);
    if (!Number.isInteger(index) || index < 0 || index >= source.length) return source;
    const copy = source.slice();
    copy[index] = assignPath(copy[index], segments.slice(1), value);
    return copy;
  }
  if (source === null || typeof source !== "object") return source;
  const record = source as Record<string, unknown>;
  if (!(segment in record)) return source;
  return { ...record, [segment]: assignPath(record[segment], segments.slice(1), value) };
}
