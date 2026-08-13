/**
 * V3-native per-scene compilation: prepares a runtime-ready scene from
 * normalized authoring layers, clips, and variables.
 *
 * Pipeline: resolve variables → layout constraints → fit text → compile
 * clips → assemble runtime scene.
 *
 * This is the canonical V3 → Runtime IR path. No V2 intermediate shape.
 *
 * @internal — used by `compile-v3`; re-exported from the package barrel.
 */
import {
  type MotionClip,
  type MotionLayer,
  type MotionRuntimeProject,
  type RuntimeSourceRef,
} from "@motionvideo/motion-protocol";
import { applyLayoutConstraints } from "./layout-solver";
import { expandMotionPreset } from "./preset-registry";

type RuntimeTrack = MotionRuntimeProject["scenes"][number]["tracks"][number];
type RuntimeNode = MotionRuntimeProject["scenes"][number]["layers"][number];
type RuntimeScene = MotionRuntimeProject["scenes"][number];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveValue(
  value: unknown,
  variables: Map<string, unknown>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => resolveValue(item, variables));
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const ref = record.ref;
  if (
    ref &&
    typeof ref === "object" &&
    (ref as Record<string, unknown>).kind === "variable"
  ) {
    const id = (ref as Record<string, unknown>).id;
    if (typeof id !== "string" || !variables.has(id))
      throw new Error(`Unknown variable reference: ${String(id)}`);
    const raw = variables.get(id);
    const map = record.map;
    if (map && typeof map === "object" && typeof raw === "number") {
      const scale =
        typeof (map as Record<string, unknown>).scale === "number"
          ? (map as Record<string, number>).scale
          : 1;
      const offset =
        typeof (map as Record<string, unknown>).offset === "number"
          ? (map as Record<string, number>).offset
          : 0;
      return raw * scale + offset;
    }
    return clone(raw);
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, nested]) => [
      key,
      resolveValue(nested, variables),
    ]),
  );
}

function playbackRate(
  clip: MotionClip,
  variables: Map<string, unknown>,
): number {
  const rate = number(
    resolveValue(clip.playback.rate, variables),
    `clips.${clip.id}.playback.rate`,
  );
  if (rate <= 0) throw new Error(`clips.${clip.id}.playback.rate must be > 0`);
  return rate;
}

function playbackDuration(
  clip: MotionClip,
  variables: Map<string, unknown>,
  sceneDuration?: number,
): number {
  const rate = playbackRate(clip, variables);
  if (clip.playback.iterations === "infinite") {
    if (sceneDuration === undefined)
      throw new Error(
        `Infinite playback requires a scene duration: ${clip.id}`,
      );
    return Math.max(0, sceneDuration);
  }
  return (clip.duration * clip.playback.iterations) / rate;
}

function scheduleTimes(
  clips: MotionClip[],
  variables: Map<string, unknown> = new Map(),
  sceneDuration?: number,
): Map<string, number> {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const times = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (clip: MotionClip): number => {
    const cached = times.get(clip.id);
    if (cached !== undefined) return cached;
    if (visiting.has(clip.id))
      throw new Error(`Clip schedule cycle: ${clip.id}`);
    visiting.add(clip.id);
    let at: number;
    if (clip.schedule.kind === "absolute") at = clip.schedule.at;
    else if (clip.schedule.kind === "scene-end") {
      const duration = sceneDuration ?? 0;
      at = Math.max(0, duration - clip.duration + clip.schedule.offset);
    } else {
      const dependency = byId.get(clip.schedule.clipId);
      if (!dependency)
        throw new Error(`Unknown schedule clip: ${clip.schedule.clipId}`);
      const dependencyStart = resolve(dependency);
      at =
        clip.schedule.kind === "after"
          ? dependencyStart +
            playbackDuration(dependency, variables, sceneDuration) +
            (clip.schedule.offset ?? 0)
          : dependencyStart + (clip.schedule.offset ?? 0);
    }
    visiting.delete(clip.id);
    times.set(clip.id, at);
    return at;
  };
  for (const clip of clips) resolve(clip);
  return times;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must resolve to a number`);
  return value;
}

function canonicalTime(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function literalPresetParams(
  params: Record<string, unknown> | undefined,
  variables: Map<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = resolveValue(value, variables);
  }
  return out;
}

function presetTracks(
  node: RuntimeNode,
  preset: string,
  start: number,
  end: number,
  params?: Record<string, unknown>,
): RuntimeTrack[] {
  return expandMotionPreset({
    presetId: preset,
    layerId: node.id,
    start,
    end,
    transform: {
      x: node.transform.x,
      y: node.transform.y,
      opacity: node.transform.opacity,
      scaleX: node.transform.scaleX,
      scaleY: node.transform.scaleY,
    },
    params,
  }) as RuntimeTrack[];
}

function expandPlaybackTrack(
  track: RuntimeTrack,
  clip: MotionClip,
  start: number,
  sceneDuration: number,
  variables: Map<string, unknown>,
): RuntimeTrack {
  const rate = playbackRate(clip, variables);
  const cycleDuration = clip.duration / rate;
  const iterations =
    clip.playback.iterations === "infinite"
      ? Number.POSITIVE_INFINITY
      : clip.playback.iterations;
  const keys: RuntimeTrack["keys"] = [];
  const append = (key: RuntimeTrack["keys"][number]): void => {
    const previous = keys.at(-1);
    if (previous && Math.abs(previous.t - key.t) <= 1e-8)
      keys[keys.length - 1] = { ...key, t: previous.t };
    else if (key.t <= sceneDuration + 1e-9) keys.push(key);
  };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cycleStart = canonicalTime(start + iteration * cycleDuration);
    if (cycleStart >= sceneDuration - 1e-9) break;
    const cycleEnd = Math.min(sceneDuration, cycleStart + cycleDuration);
    const reverse =
      clip.playback.direction === "reverse" ||
      (clip.playback.direction === "alternate" && iteration % 2 === 1);
    const sourceKeys = reverse
      ? [...track.keys].reverse().map((key) => ({
          ...key,
          t: canonicalTime((clip.duration - key.t) / rate),
        }))
      : track.keys.map((key) => ({ ...key, t: canonicalTime(key.t / rate) }));
    for (const key of sourceKeys) {
      const absolute = canonicalTime(cycleStart + key.t);
      if (absolute <= cycleEnd + 1e-9) append({ ...key, t: absolute });
    }
  }
  return { ...track, keys };
}

function resolveTrackTime(
  time: unknown,
  markers: Map<string, number>,
  clipId: string,
): number {
  if (typeof time === "number" && Number.isFinite(time)) return time;
  if (time && typeof time === "object" && "markerId" in time) {
    const markerId = (time as { markerId: string; offset?: number }).markerId;
    const offset = (time as { offset?: number }).offset ?? 0;
    if (!markers.has(markerId))
      throw new Error(`Unknown scene marker ${markerId} in clip ${clipId}`);
    return markers.get(markerId)! + offset;
  }
  throw new Error(
    `Invalid keyframe time in clip ${clipId}: ${JSON.stringify(time)}`,
  );
}

function compileClips(
  layers: RuntimeNode[],
  clips: MotionClip[],
  variables: Map<string, unknown>,
  sceneDuration: number,
  markers: Map<string, number> = new Map(),
): RuntimeTrack[] {
  const layerById = new Map(layers.map((node) => [node.id, node]));
  const starts = scheduleTimes(clips, variables, sceneDuration);
  const expanded = clips.flatMap((clip) => {
    const start = canonicalTime(starts.get(clip.id) ?? 0);
    if (clip.source.kind === "tracks") {
      return clip.source.tracks.map((track) =>
        expandPlaybackTrack(
          {
            layerId: track.layerId,
            property: track.property,
            ...(track.valueKind ? { valueKind: track.valueKind } : {}),
            ...(track.preBehavior ? { preBehavior: track.preBehavior } : {}),
            ...(track.postBehavior ? { postBehavior: track.postBehavior } : {}),
            keys: track.keys.map((key) => ({
              t: resolveTrackTime(key.t, markers, clip.id),
              v: resolveValue(
                key.v,
                variables,
              ) as RuntimeTrack["keys"][number]["v"],
              ...(key.easing ? { easing: key.easing } : {}),
            })),
          },
          clip,
          start,
          sceneDuration,
          variables,
        ),
      );
    }
    if (!clip.layerId)
      throw new Error(`Preset clip ${clip.id} requires layerId`);
    const node = layerById.get(clip.layerId);
    if (!node) throw new Error(`Unknown clip target: ${clip.layerId}`);
    return presetTracks(
      node,
      clip.source.presetId,
      0,
      clip.duration,
      literalPresetParams(
        clip.source.params as Record<string, unknown> | undefined,
        variables,
      ),
    ).map((track) =>
      expandPlaybackTrack(track, clip, start, sceneDuration, variables),
    );
  });
  const merged = new Map<string, RuntimeTrack>();
  for (const track of expanded) {
    const key = `${track.layerId}\u0000${track.property}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...track, keys: [...track.keys] });
      continue;
    }
    const byTime = new Map(
      current.keys.map((keyframe) => [keyframe.t, keyframe]),
    );
    for (const keyframe of track.keys) byTime.set(keyframe.t, keyframe);
    current.keys = [...byTime.values()].sort((a, b) => a.t - b.t);
  }
  return [...merged.values()];
}

export function compileSceneToRuntime(input: {
  id: string;
  duration: number;
  layers: MotionLayer[];
  clips: MotionClip[];
  variables: Map<string, unknown>;
  markers?: Array<{ id: string; t: number }>;
  space?: RuntimeScene["space"];
  motionBlur?: RuntimeScene["motionBlur"];
  drivers?: RuntimeScene["drivers"];
  activeCameraLayerId?: string;
  sourceRef?: RuntimeSourceRef;
}): RuntimeScene {
  const variables = input.variables;
  const resolvedAuthoringNodes = input.layers.map(
    (node) => resolveValue(node, variables) as unknown as MotionLayer,
  );
  const laidOut = applyLayoutConstraints(resolvedAuthoringNodes);
  // Authoring path layers carry no fillRule; the runtime node requires it.
  // Default it here so authoring → runtime IR stays lossless.
  const runtimeNodes: RuntimeNode[] = laidOut.map((node) =>
    node.type === "path"
      ? { ...node, payload: { ...node.payload, fillRule: "nonzero" as const } }
      : node,
  ) as RuntimeNode[];
  const markers = new Map<string, number>(
    (input.markers ?? []).map((m) => [m.id, m.t]),
  );
  const sourceRef = input.sourceRef ?? {
    projectPath: ["scenes", input.id],
  };
  return {
    id: input.id,
    duration: input.duration,
    ...(input.space ? { space: input.space } : {}),
    ...(input.motionBlur ? { motionBlur: input.motionBlur } : {}),
    ...(input.drivers && input.drivers.length > 0
      ? { drivers: clone(input.drivers) }
      : {}),
    ...(input.activeCameraLayerId
      ? { activeCameraLayerId: input.activeCameraLayerId }
      : {}),
    sourceRef,
    layers: runtimeNodes,
    tracks: [
      ...compileClips(
        runtimeNodes,
        input.clips,
        variables,
        input.duration,
        markers,
      ),
    ],
  };
}
