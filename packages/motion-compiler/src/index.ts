import {
  type MotionClip,
  type MotionNode,
  type MotionProject,
  type MotionRuntimeProject,
  type RuntimeSourceRef,
} from "@motionvideo/motion-protocol";
import type { ComponentInput } from "./types";
import { applyFitText, applyLayoutConstraints } from "./layout-solver";
import { expandMotionPreset } from "./preset-registry";
import { compileMotionProjectV3 } from "./compile-v3";

type RuntimeTrack = MotionRuntimeProject["scenes"][number]["tracks"][number];
type RuntimeNode = MotionRuntimeProject["scenes"][number]["nodes"][number];
type SceneMarker = { id: string; t: number };

export type CompileOptions = {
  components?: ComponentInput[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last) cursor[last] = clone(value);
}

function getPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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

type PlaybackDirection = MotionClip["playback"]["direction"];

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

/** Closed allowlist of Clip.source.presetId values the compiler expands. Unknown IDs throw. */
export {
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  expandMotionPreset,
  type CompiledPresetId,
} from "./presets";
export {
  validateMotionProjectPresets,
  type UnknownPresetRef,
  type PresetValidationResult,
} from "./validate-presets";

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
    nodeId: node.id,
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
  nodes: RuntimeNode[],
  clips: MotionClip[],
  variables: Map<string, unknown>,
  sceneDuration: number,
  markers: Map<string, number> = new Map(),
): RuntimeTrack[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const starts = scheduleTimes(clips, variables, sceneDuration);
  const expanded = clips.flatMap((clip) => {
    const start = canonicalTime(starts.get(clip.id) ?? 0);
    if (clip.source.kind === "tracks") {
      return clip.source.tracks.map((track) =>
        expandPlaybackTrack(
          {
            targetId: track.targetId,
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
    if (clip.source.kind === "component-action")
      throw new Error(`Unexpanded Component Action clip: ${clip.id}`);
    if (!clip.targetId)
      throw new Error(`Preset clip ${clip.id} requires targetId`);
    const node = nodeById.get(clip.targetId);
    if (!node) throw new Error(`Unknown clip target: ${clip.targetId}`);
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
    const key = `${track.targetId}\u0000${track.property}`;
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

function expandTextAnimators(nodes: MotionNode[]): {
  nodes: RuntimeNode[];
  tracks: RuntimeTrack[];
} {
  const outputNodes: RuntimeNode[] = [];
  const outputTracks: RuntimeTrack[] = [];
  for (const node of nodes) {
    if (node.type !== "text" || !node.textAnimator) {
      outputNodes.push(clone(node) as RuntimeNode);
      continue;
    }
    const animator = node.textAnimator;
    const units = segmentTextUnits(
      getTextPayloadPlain(node.payload),
      animator.unit,
      animator.locale,
    );
    const horizontal = animator.unit !== "line";
    const cellWidth = horizontal
      ? node.transform.width / Math.max(1, units.length)
      : node.transform.width;
    const cellHeight = horizontal
      ? node.transform.height
      : node.transform.height / Math.max(1, units.length);
    const left =
      node.transform.x - node.transform.anchorX * node.transform.width;
    const top =
      node.transform.y - node.transform.anchorY * node.transform.height;
    let selectedIndex = 0;
    units.forEach((text, index) => {
      const run = clone(node) as typeof node & {
        textAnimator?: unknown;
        repeat?: unknown;
      };
      delete run.textAnimator;
      delete run.repeat;
      run.id = `${node.id}::${animator.id}::${index}`;
      run.payload = setTextPayloadPlain(run.payload, text);
      run.transform.x = horizontal
        ? left + cellWidth * (index + 0.5)
        : left + cellWidth / 2;
      run.transform.y = horizontal
        ? top + cellHeight / 2
        : top + cellHeight * (index + 0.5);
      run.transform.width = cellWidth;
      run.transform.height = cellHeight;
      run.transform.anchorX = 0.5;
      run.transform.anchorY = 0.5;
      outputNodes.push(run as RuntimeNode);

      const progress = units.length <= 1 ? 0 : index / (units.length - 1);
      if (
        progress < animator.selector.start ||
        progress > animator.selector.end
      )
        return;
      const start = canonicalTime(
        animator.startTime + selectedIndex * animator.stagger,
      );
      const end = canonicalTime(start + animator.duration);
      selectedIndex += 1;
      const track = (
        property: string,
        from: RuntimeTrack["keys"][number]["v"],
        to: RuntimeTrack["keys"][number]["v"],
      ): void => {
        outputTracks.push({
          targetId: run.id,
          property,
          keys: [
            { t: start, v: from },
            { t: end, v: to, easing: animator.easing },
          ],
        });
      };
      if (animator.properties.offsetX !== undefined)
        track(
          "transform.x",
          run.transform.x + animator.properties.offsetX,
          run.transform.x,
        );
      if (animator.properties.offsetY !== undefined)
        track(
          "transform.y",
          run.transform.y + animator.properties.offsetY,
          run.transform.y,
        );
      if (animator.properties.rotation !== undefined)
        track(
          "transform.rotation",
          run.transform.rotation + animator.properties.rotation,
          run.transform.rotation,
        );
      if (animator.properties.scale !== undefined) {
        track(
          "transform.scaleX",
          run.transform.scaleX * animator.properties.scale,
          run.transform.scaleX,
        );
        track(
          "transform.scaleY",
          run.transform.scaleY * animator.properties.scale,
          run.transform.scaleY,
        );
      }
      if (animator.properties.opacity !== undefined)
        track(
          "transform.opacity",
          run.transform.opacity * animator.properties.opacity,
          run.transform.opacity,
        );
      if (animator.properties.fill !== undefined)
        track(
          "style.fill",
          animator.properties.fill,
          run.style?.fill ?? "#ffffff",
        );
    });
  }
  return { nodes: outputNodes, tracks: outputTracks };
}

/** Encode a scene sourceRef as a stable human-readable string. */
function encodeSourceRef(ref: RuntimeSourceRef): string {
  const base = ref.projectPath.join(":");
  return ref.sourceModule ? `${base}#${ref.sourceModule}` : base;
}

/**
 * V3-native per-scene compilation: prepares a runtime-ready scene from
 * normalized authoring nodes, clips, and variables.
 *
 * Pipeline: resolve variables → layout constraints → fit text → expand
 * text animators → compile clips → assemble runtime scene.
 *
 * This is the canonical V3 → Runtime IR path. No V2 intermediate shape.
 *
 * @internal — exported for `compile-v3.ts`; not part of the public API.
 */
export function compileSceneToRuntime(input: {
  id: string;
  duration: number;
  nodes: MotionNode[];
  clips: MotionClip[];
  variables: Map<string, unknown>;
  markers?: Array<{ id: string; t: number }>;
  space?: string;
  motionBlur?: unknown;
  drivers?: unknown[];
  activeCameraId?: string;
  sourceRef?: RuntimeSourceRef;
}): MotionRuntimeProject["scenes"][number] {
  const variables = input.variables;
  const resolvedAuthoringNodes = input.nodes.map(
    (node) => resolveValue(node, variables) as unknown as MotionNode,
  );
  const laidOut = applyLayoutConstraints(resolvedAuthoringNodes);
  const fitted = applyFitText(laidOut);
  const textExpanded = expandTextAnimators(fitted.nodes);
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
    ...(input.activeCameraId ? { activeCameraId: input.activeCameraId } : {}),
    sourceRef,
    nodes: textExpanded.nodes,
    tracks: [
      ...compileClips(
        textExpanded.nodes,
        input.clips,
        variables,
        input.duration,
        markers,
      ),
      ...textExpanded.tracks,
    ],
  };
}

export function compileMotionProject(
  project: MotionProject,
  options: CompileOptions = {},
): MotionRuntimeProject {
  const result = compileMotionProjectV3(
    project as Parameters<typeof compileMotionProjectV3>[0],
    options,
  );
  if (!result.ok) {
    throw new Error(
      `compileMotionProject failed: ${result.diagnostics
        .map(
          (d: { code: string; message: string }) => `${d.code}: ${d.message}`,
        )
        .join(" | ")}`,
    );
  }
  return result.project;
}

export type { CompiledProject } from "./compile-result";
export {
  compileMotionProjectV3,
  buildCompileCacheKeyV3,
  detectScheduleCycles,
  COMPILER_VERSION_V3,
  type CompileV3Options,
  type CompileV3Profile,
} from "./compile-v3";
export {
  DiagnosticCollector,
  CompileDiagnosticError,
  compileSuccess,
  compileFailure,
  type CompileDiagnostic,
  type DiagnosticSeverity,
  type DiagnosticCode,
  type CompileResult,
  type CompileSuccess,
  type CompileFailure,
} from "./compile-result";
export {
  CompileCache,
  COMPILER_VERSION,
  hashComponentDeps,
  buildCompileCacheKey,
  type CacheEntry,
} from "./compile-cache";

export { applyFitText, applyLayoutConstraints } from "./layout-solver";
export {
  defaultTextMeasurementProvider,
  estimateTextSize,
  type TextMeasurementProvider,
  type TextMeasureRequest,
  type TextMeasureResult,
} from "./text-layout";
export {
  compileCaptionTracks,
  evaluateCaptionStateAtTime,
  type CompiledCaptionTrack,
  type CompiledCaptionCue,
  type ActiveCaptionState,
} from "./caption-compiler";
export {
  bakeMotionRecipe,
  isMotionRecipe,
  MOTION_RECIPE_IDS,
  type MotionRecipeId,
  type RecipeBakeInput,
  type BakedRecipe,
} from "./recipe-registry";
