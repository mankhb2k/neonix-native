/**
 * V1-native layer-graph compilation: prepares runtime layers/propertyAnimations
 * from an in-memory layer graph plus compiler motion units.
 *
 * LayerMotionUnit (internal schema) is compiled as motion-units only — not timeline clips.
 */
import { type MotionLayer } from "@motionvideo/motion-protocol";
import type { LayerMotionUnit } from "@motionvideo/motion-protocol/internal";
import {
  type MotionRuntimeProject,
  type RuntimeLayerGraph,
  type RuntimeSourceRef,
} from "@motionvideo/motion-protocol/runtime";
import { applyLayoutConstraints } from "./layout-solver";
import { expandMotionPreset } from "./preset-registry";
import { layerPoseFromAtoms } from "./layer-pose";

type RuntimePropertyAnimation = MotionRuntimeProject["propertyAnimations"][number];
type RuntimeNode = Exclude<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function playbackRate(unit: LayerMotionUnit): number {
  const rate = number(
    unit.playback.rate,
    `motionUnits.${unit.id}.playback.rate`,
  );
  if (rate <= 0)
    throw new Error(`motionUnits.${unit.id}.playback.rate must be > 0`);
  return rate;
}

function playbackDuration(
  unit: LayerMotionUnit,
  graphDuration?: number,
): number {
  const rate = playbackRate(unit);
  if (unit.playback.iterations === "infinite") {
    if (graphDuration === undefined)
      throw new Error(
        `Infinite playback requires a timeline duration: ${unit.id}`,
      );
    return Math.max(0, graphDuration);
  }
  return (unit.duration * unit.playback.iterations) / rate;
}

function scheduleTimes(
  units: LayerMotionUnit[],
  graphDuration?: number,
): Map<string, number> {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const times = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (unit: LayerMotionUnit): number => {
    const cached = times.get(unit.id);
    if (cached !== undefined) return cached;
    if (visiting.has(unit.id))
      throw new Error(`Motion-unit schedule cycle: ${unit.id}`);
    visiting.add(unit.id);
    let at: number;
    if (unit.schedule.kind === "absolute") at = unit.schedule.at;
    else if (unit.schedule.kind === "timeline-end") {
      const duration = graphDuration ?? 0;
      at = Math.max(0, duration - unit.duration + unit.schedule.offset);
    } else {
      const dependency = byId.get(unit.schedule.clipId);
      if (!dependency)
        throw new Error(
          `Unknown schedule motion-unit: ${unit.schedule.clipId}`,
        );
      const dependencyStart = resolve(dependency);
      at =
        unit.schedule.kind === "after"
          ? dependencyStart +
            playbackDuration(dependency, graphDuration) +
            (unit.schedule.offset ?? 0)
          : dependencyStart + (unit.schedule.offset ?? 0);
    }
    visiting.delete(unit.id);
    times.set(unit.id, at);
    return at;
  };
  for (const unit of units) resolve(unit);
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
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  return clone(params);
}

function presetTracks(
  node: RuntimeNode,
  preset: string,
  start: number,
  end: number,
  params?: Record<string, unknown>,
): RuntimePropertyAnimation[] {
  return expandMotionPreset({
    presetId: preset,
    layerId: node.id,
    start,
    end,
    transform: layerPoseFromAtoms(node),
    params,
  }) as RuntimePropertyAnimation[];
}

function expandPlaybackTrack(
  track: RuntimePropertyAnimation,
  unit: LayerMotionUnit,
  start: number,
  graphDuration: number,
): RuntimePropertyAnimation {
  const rate = playbackRate(unit);
  const cycleDuration = unit.duration / rate;
  const iterations =
    unit.playback.iterations === "infinite"
      ? Number.POSITIVE_INFINITY
      : unit.playback.iterations;
  const keys: RuntimePropertyAnimation["keys"] = [];
  const append = (key: RuntimePropertyAnimation["keys"][number]): void => {
    const previous = keys.at(-1);
    if (previous && Math.abs(previous.t - key.t) <= 1e-8)
      keys[keys.length - 1] = { ...key, t: previous.t };
    else if (key.t <= graphDuration + 1e-9) keys.push(key);
  };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cycleStart = canonicalTime(start + iteration * cycleDuration);
    if (cycleStart >= graphDuration - 1e-9) break;
    const cycleEnd = Math.min(graphDuration, cycleStart + cycleDuration);
    const reverse =
      unit.playback.direction === "reverse" ||
      (unit.playback.direction === "alternate" && iteration % 2 === 1);
    const sourceKeys = reverse
      ? [...track.keys].reverse().map((key) => ({
          ...key,
          t: canonicalTime((unit.duration - key.t) / rate),
        }))
      : track.keys.map((key) => ({ ...key, t: canonicalTime(key.t / rate) }));
    for (const key of sourceKeys) {
      const absolute = canonicalTime(cycleStart + key.t);
      if (absolute <= cycleEnd + 1e-9) append({ ...key, t: absolute });
    }
  }
  return { ...track, keys };
}

function resolveTrackTime(time: unknown, unitId: string): number {
  if (typeof time === "number" && Number.isFinite(time)) return time;
  throw new Error(
    `Invalid keyframe time in motion-unit ${unitId}: ${JSON.stringify(time)}`,
  );
}

function compileMotionUnits(
  layers: RuntimeNode[],
  units: LayerMotionUnit[],
  graphDuration: number,
): RuntimePropertyAnimation[] {
  const layerById = new Map(layers.map((node) => [node.id, node]));
  const starts = scheduleTimes(units, graphDuration);
  const expanded = units.flatMap((unit) => {
    const start = canonicalTime(starts.get(unit.id) ?? 0);
    if (unit.source.kind === "propertyAnimations") {
      return unit.source.items.map((item) =>
        expandPlaybackTrack(
          {
            layerId: item.layerId,
            property: item.property,
            ...(item.valueKind ? { valueKind: item.valueKind } : {}),
            ...(item.preBehavior ? { preBehavior: item.preBehavior } : {}),
            ...(item.postBehavior ? { postBehavior: item.postBehavior } : {}),
            keys: item.keys.map((key) => ({
              t: resolveTrackTime(key.t, unit.id),
              v: clone(key.v) as RuntimePropertyAnimation["keys"][number]["v"],
              ...(key.easing ? { easing: key.easing } : {}),
            })),
          },
          unit,
          start,
          graphDuration,
        ),
      );
    }
    if (!unit.layerId)
      throw new Error(`Preset motion-unit ${unit.id} requires layerId`);
    const node = layerById.get(unit.layerId);
    if (!node)
      throw new Error(`Unknown motion-unit target layer: ${unit.layerId}`);
    return presetTracks(
      node,
      unit.source.presetId,
      0,
      unit.duration,
      literalPresetParams(
        unit.source.params as Record<string, unknown> | undefined,
      ),
    ).map((track) =>
      expandPlaybackTrack(track, unit, start, graphDuration),
    );
  });
  const merged = new Map<string, RuntimePropertyAnimation>();
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

export function compileLayerGraphToRuntime(input: {
  id: string;
  duration: number;
  layers: MotionLayer[];
  motionUnits: LayerMotionUnit[];
  /** Unused on this path: V1 variables reach internals only via prop bindings. */
  variables: Map<string, unknown>;
  space?: RuntimeLayerGraph["space"];
  motionBlur?: RuntimeLayerGraph["motionBlur"];
  drivers?: RuntimeLayerGraph["drivers"];
  activeCameraLayerId?: string;
  sourceRef?: RuntimeSourceRef;
}): RuntimeLayerGraph {
  const laidOut = applyLayoutConstraints(clone(input.layers));
  // Authoring path layers carry no fillRule; the runtime node requires it.
  // Default it here so authoring → runtime IR stays lossless.
  const runtimeNodes: RuntimeNode[] = laidOut.map((node) =>
    node.type === "path"
      ? {
          ...node,
          payload: {
            ...node.payload,
            fillRule: node.payload.fillRule ?? ("nonzero" as const),
          },
        }
      : node,
  ) as RuntimeNode[];
  const sourceRef = input.sourceRef ?? {
    projectPath: ["layers", input.id],
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
    propertyAnimations: [
      ...compileMotionUnits(
        runtimeNodes,
        input.motionUnits,
        input.duration,
      ),
    ],
  };
}
