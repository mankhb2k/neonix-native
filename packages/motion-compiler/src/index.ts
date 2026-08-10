import {
  NormalizedMotionProjectV2Schema,
  CAPABILITY_MANIFEST_VERSION,
  MOTION_RUNTIME_VERSION,
  getTextPayloadPlain,
  segmentTextUnits,
  setTextPayloadPlain,
  type MotionClip,
  type MotionComponentV2,
  type MotionNode,
  type MotionProject,
  type NormalizedMotionProjectV2,
  type RuntimeCompositionMetadata,
  type RuntimeSourceRef,
} from "@motionvideo/motion-protocol";
import { createHash } from "node:crypto";
import { applyFitText, applyLayoutConstraints } from "./layout-solver";
import { expandMotionPreset } from "./preset-registry";
import { COMPILER_VERSION } from "./compile-cache";
import { compileMotionProjectV3 } from "./compile-v3";

type RuntimeTrack =
  NormalizedMotionProjectV2["scenes"][number]["tracks"][number];
type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];
type SceneMarker = { id: string; t: number };

export type CompileOptions = {
  components?: MotionComponentV2[];
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

function expandComponents(
  nodes: MotionNode[],
  clips: MotionClip[],
  componentPackages: Map<string, MotionComponentV2>,
  projectVariables: Map<string, unknown>,
  sceneDuration: number,
): {
  nodes: RuntimeNode[];
  clips: MotionClip[];
  variables: Map<string, unknown>;
} {
  const outputNodes: RuntimeNode[] = [];
  const sceneStarts = scheduleTimes(clips, projectVariables, sceneDuration);
  const actionInvocationIds = new Set(
    clips
      .filter((clip) => clip.source.kind === "component-action")
      .map((clip) => clip.id),
  );
  const outputClips = clips
    .filter((clip) => clip.source.kind !== "component-action")
    .map((clip) =>
      clip.schedule.kind !== "absolute" &&
      clip.schedule.kind !== "scene-end" &&
      actionInvocationIds.has(clip.schedule.clipId)
        ? {
            ...clone(clip),
            schedule: {
              kind: "absolute" as const,
              at: sceneStarts.get(clip.id) ?? 0,
            },
          }
        : clone(clip),
    );
  const componentVariables = new Map<string, unknown>();
  for (const node of nodes) {
    if (node.type !== "component") {
      outputNodes.push(clone(node) as RuntimeNode);
      continue;
    }
    const key = `${node.payload.componentId}@${node.payload.componentVersion}`;
    const component = componentPackages.get(key);
    if (!component) throw new Error(`Component package unavailable: ${key}`);
    const values = new Map<string, unknown>(
      component.variables.map((variable) => [
        variable.id,
        clone(variable.value),
      ]),
    );
    for (const api of component.publicAPI)
      if (api.id in node.payload.props)
        values.set(api.variableId, clone(node.payload.props[api.id]));
    const internalById = new Map(
      component.nodes.map((internal) => [internal.id, internal]),
    );
    const repeatRoots = component.nodes.filter((internal) => internal.repeat);
    const repeatOwner = (internal: MotionNode): MotionNode | undefined => {
      let current: MotionNode | undefined = internal;
      while (current) {
        if (current.repeat) return current;
        current = current.parentId
          ? internalById.get(current.parentId)
          : undefined;
      }
      return undefined;
    };
    type ExpandedTarget = {
      node?: RuntimeNode;
      context?: Record<string, unknown>;
      itemIndex?: number;
      repeatKey?: string;
      timeStagger?: number;
    };
    const targets = new Map<string, ExpandedTarget[]>();
    const expanded: RuntimeNode[] = [];
    const addExpanded = (
      internal: MotionNode,
      id: string,
      parentId: string | null,
      context?: Record<string, unknown>,
      itemIndex?: number,
      repeatKey?: string,
      timeStagger?: number,
    ): void => {
      if (internal.type === "component")
        throw new Error(
          `Nested component is not supported: ${key}/${internal.id}`,
        );
      const next = clone(internal) as RuntimeNode;
      delete (next as RuntimeNode & { repeat?: unknown }).repeat;
      next.id = id;
      next.parentId = parentId;
      if (internal.mask) {
        const source = internalById.get(internal.mask.sourceNodeId);
        const sharesRepeat = Boolean(
          repeatKey &&
          source &&
          repeatOwner(source)?.id === repeatOwner(internal)?.id,
        );
        next.mask = {
          ...internal.mask,
          sourceNodeId: `${node.id}::${internal.mask.sourceNodeId}${sharesRepeat ? `::${repeatKey}` : ""}`,
        };
      }
      if (internal.modifiers) {
        next.modifiers = internal.modifiers.map((modifier) => {
          if (modifier.type === "motion-path") {
            const source = internalById.get(modifier.pathNodeId);
            const sharesRepeat = Boolean(
              repeatKey &&
              source &&
              repeatOwner(source)?.id === repeatOwner(internal)?.id,
            );
            return {
              ...modifier,
              pathNodeId: `${node.id}::${modifier.pathNodeId}${sharesRepeat ? `::${repeatKey}` : ""}`,
            };
          }
          if (modifier.type === "secondary-motion") {
            return {
              ...modifier,
              driverNodeId: `${node.id}::${modifier.driverNodeId}`,
              chainNodeIds: modifier.chainNodeIds.map(
                (chainNodeId) => `${node.id}::${chainNodeId}`,
              ),
            };
          }
          return modifier;
        });
      }
      if (internal.parentId === null) {
        next.transform.x += node.transform.x;
        next.transform.y += node.transform.y;
        next.transform.scaleX *= node.transform.scaleX;
        next.transform.scaleY *= node.transform.scaleY;
        next.transform.opacity *= node.transform.opacity;
        next.zIndex = (node.zIndex ?? 0) + (internal.zIndex ?? 0);
      }
      expanded.push(next);
      const list = targets.get(internal.id) ?? [];
      list.push({ node: next, context, itemIndex, repeatKey, timeStagger });
      targets.set(internal.id, list);
    };
    for (const internal of component.nodes.filter(
      (candidate) => !repeatOwner(candidate),
    )) {
      addExpanded(
        internal,
        `${node.id}::${internal.id}`,
        internal.parentId ? `${node.id}::${internal.parentId}` : node.parentId,
      );
    }
    for (const root of repeatRoots) {
      const directive = root.repeat!;
      const items =
        directive.source.kind === "list"
          ? values.get(directive.source.variableId)
          : Array.from({ length: directive.source.count }, (_, index) => ({
              index: index + 1,
            }));
      if (!Array.isArray(items))
        throw new Error(
          `Repeater source must be a list: ${key}/${directive.source.kind === "list" ? directive.source.variableId : root.id}`,
        );
      const subtree = component.nodes.filter(
        (candidate) => repeatOwner(candidate)?.id === root.id,
      );
      items.forEach((item, index) => {
        if (item === null || typeof item !== "object" || Array.isArray(item))
          throw new Error(`Repeater item ${index} must be an object`);
        const rawKey =
          directive.source.kind === "list"
            ? getPath(item, directive.source.keyPath)
            : `${directive.source.keyPrefix}-${index + 1}`;
        if (typeof rawKey !== "string" && typeof rawKey !== "number")
          throw new Error(
            `Repeater key ${directive.source.kind === "list" ? directive.source.keyPath : directive.source.keyPrefix} is missing at item ${index}`,
          );
        const repeatKey = String(rawKey);
        const context = {
          [directive.itemAlias]: item,
          [directive.indexAlias]: index + 1,
        };
        for (const internal of subtree) {
          const id = `${node.id}::${internal.id}::${repeatKey}`;
          const parentId =
            internal.id === root.id
              ? root.parentId
                ? `${node.id}::${root.parentId}`
                : node.parentId
              : `${node.id}::${internal.parentId}::${repeatKey}`;
          addExpanded(
            internal,
            id,
            parentId,
            context,
            index,
            repeatKey,
            directive.timeStagger,
          );
          const created = expanded[expanded.length - 1]!;
          if (internal.id === root.id) {
            const layout = directive.layout;
            if (layout.kind === "linear") {
              created.transform.x += index * layout.offsetX;
              created.transform.y += index * layout.offsetY;
            } else if (layout.kind === "grid") {
              created.transform.x += (index % layout.columns) * layout.gapX;
              created.transform.y +=
                Math.floor(index / layout.columns) * layout.gapY;
            } else if (layout.kind === "radial") {
              const angle =
                items.length === 1
                  ? layout.startAngle
                  : layout.startAngle +
                    ((layout.endAngle - layout.startAngle) * index) /
                      (items.length - 1);
              const radians = (angle * Math.PI) / 180;
              created.transform.x += Math.cos(radians) * layout.radius;
              created.transform.y += Math.sin(radians) * layout.radius;
              if (layout.orientToAngle) created.transform.rotation += angle;
            }
          }
        }
      });
    }
    const readContext = (
      context: Record<string, unknown> | undefined,
      path: string,
    ): unknown => {
      let current: unknown = context;
      for (const part of path.split(".")) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    };
    for (const binding of component.bindings) {
      for (const target of targets.get(binding.target.nodeId) ?? []) {
        const value =
          binding.source.kind === "variable"
            ? values.get(binding.source.variableId)
            : readContext(target.context, binding.source.path);
        setPath(
          target.node as unknown as Record<string, unknown>,
          binding.target.property,
          value,
        );
      }
    }
    outputNodes.push(...expanded);
    for (const clipInput of component.clips) {
      const resolved = resolveValue(clipInput, values) as MotionClip;
      const clipTargets: ExpandedTarget[] = resolved.targetId
        ? (targets.get(resolved.targetId) ?? [])
        : [{ node: undefined }];
      for (const target of clipTargets) {
        const suffix = target.repeatKey ? `::${target.repeatKey}` : "";
        const presetStagger =
          resolved.source.kind === "preset"
            ? resolved.source.params?.stagger
            : undefined;
        const staggerStep =
          target.timeStagger ??
          (typeof presetStagger === "number" ? presetStagger : 0);
        const stagger =
          target.itemIndex !== undefined ? staggerStep * target.itemIndex : 0;
        outputClips.push({
          ...clone(resolved),
          id: `${node.id}::${resolved.id}${suffix}`,
          targetId: target.node?.id,
          schedule:
            resolved.schedule.kind === "absolute"
              ? {
                  ...resolved.schedule,
                  at: canonicalTime(resolved.schedule.at + stagger),
                }
              : resolved.schedule.kind === "scene-end"
                ? { ...resolved.schedule }
                : {
                    ...resolved.schedule,
                    clipId: `${node.id}::${resolved.schedule.clipId}${suffix}`,
                  },
          source:
            resolved.source.kind === "tracks"
              ? {
                  ...clone(resolved.source),
                  tracks: resolved.source.tracks.map((track) => {
                    const matching =
                      targets
                        .get(track.targetId)
                        ?.find(
                          (candidate) =>
                            candidate.repeatKey === target.repeatKey,
                        ) ?? targets.get(track.targetId)?.[0];
                    return {
                      ...clone(track),
                      targetId:
                        matching?.node?.id ?? `${node.id}::${track.targetId}`,
                    };
                  }),
                }
              : clone(resolved.source),
        });
      }
    }
    const slotByNodeId = new Map(
      component.cutoutRigs.flatMap((rig) =>
        rig.slots.map((slot) => [slot.nodeId, slot] as const),
      ),
    );
    for (const invocation of clips.filter(
      (clip) =>
        clip.targetId === node.id && clip.source.kind === "component-action",
    )) {
      if (invocation.source.kind !== "component-action") continue;
      const actionId = invocation.source.actionId;
      const action = component.actions.find(
        (candidate) => candidate.id === actionId,
      );
      if (!action)
        throw new Error(`Unknown Component Action: ${key}/${actionId}`);
      const baseValues = new Map([...projectVariables, ...values]);
      const actionValues = new Map(baseValues);
      for (const [paramId, paramValue] of Object.entries(
        invocation.source.params ?? {},
      ))
        actionValues.set(paramId, resolveValue(paramValue, baseValues));
      const outerRate = number(
        resolveValue(invocation.playback.rate, baseValues),
        `clips.${invocation.id}.playback.rate`,
      );
      if (outerRate <= 0)
        throw new Error(`clips.${invocation.id}.playback.rate must be > 0`);
      const resolvedActionClips = action.clips.map(
        (clip) =>
          resolveValue(
            resolveValue(clip, actionValues),
            actionValues,
          ) as MotionClip,
      );
      const actionStarts = scheduleTimes(
        resolvedActionClips,
        actionValues,
        action.duration,
      );
      const invocationStart = sceneStarts.get(invocation.id) ?? 0;
      const cycleTracks: RuntimeTrack[] = [];
      if (action.lipSync) {
        const slot = component.cutoutRigs
          .flatMap((rig) => rig.slots)
          .find((candidate) => candidate.id === action.lipSync!.slotId);
        if (!slot)
          throw new Error(
            `Unknown Component Action lip-sync slot: ${key}/${action.lipSync.slotId}`,
          );
        const expandedTarget = targets.get(slot.nodeId)?.[0]?.node;
        if (!expandedTarget)
          throw new Error(
            `Unknown Component Action lip-sync target: ${key}/${action.id}/${slot.nodeId}`,
          );
        cycleTracks.push({
          targetId: expandedTarget.id,
          property: "payload.assetId",
          keys: action.lipSync.cues.map((cue) => {
            const variant = slot.variants.find(
              (candidate) => candidate.id === cue.variantId,
            );
            if (!variant)
              throw new Error(
                `Unknown Component Action lip-sync variant: ${key}/${action.id}/${slot.id}/${cue.variantId}`,
              );
            return { t: cue.at, v: variant.assetId, easing: "step" };
          }),
        });
      }
      for (const actionClip of resolvedActionClips) {
        const innerRate = number(
          resolveValue(actionClip.playback.rate, actionValues),
          `actions.${action.id}.clips.${actionClip.id}.playback.rate`,
        );
        if (innerRate <= 0)
          throw new Error(
            `actions.${action.id}.clips.${actionClip.id}.playback.rate must be > 0`,
          );
        const localStart = actionStarts.get(actionClip.id) ?? 0;
        if (actionClip.source.kind === "component-action")
          throw new Error(
            `Nested Component Action is not supported: ${key}/${action.id}`,
          );
        const baseTracks =
          actionClip.source.kind === "tracks"
            ? actionClip.source.tracks.map((track) => {
                const expandedTarget = targets.get(track.targetId)?.[0]?.node;
                if (!expandedTarget)
                  throw new Error(
                    `Unknown Component Action target: ${key}/${action.id}/${track.targetId}`,
                  );
                if (track.property !== "payload.variantId") {
                  return {
                    targetId: expandedTarget.id,
                    property: track.property,
                    ...(track.preBehavior
                      ? { preBehavior: track.preBehavior }
                      : {}),
                    ...(track.postBehavior
                      ? { postBehavior: track.postBehavior }
                      : {}),
                    keys: track.keys.map((keyframe) => ({
                      t: keyframe.t,
                      v: resolveValue(
                        keyframe.v,
                        actionValues,
                      ) as RuntimeTrack["keys"][number]["v"],
                      ...(keyframe.easing ? { easing: keyframe.easing } : {}),
                    })),
                  };
                }
                const slot = slotByNodeId.get(track.targetId);
                if (!slot)
                  throw new Error(
                    `Unknown Component Action variant slot: ${key}/${track.targetId}`,
                  );
                return {
                  targetId: expandedTarget.id,
                  property: "payload.assetId",
                  keys: track.keys.map((keyframe) => {
                    const variant = slot.variants.find(
                      (candidate) => candidate.id === keyframe.v,
                    );
                    if (!variant)
                      throw new Error(
                        `Unknown variant ${String(keyframe.v)} for ${slot.id}`,
                      );
                    return {
                      t: keyframe.t,
                      v: variant.assetId,
                      ...(keyframe.easing ? { easing: keyframe.easing } : {}),
                    };
                  }),
                };
              })
            : (() => {
                const target = actionClip.targetId
                  ? targets.get(actionClip.targetId)?.[0]?.node
                  : undefined;
                if (!target)
                  throw new Error(
                    `Preset Component Action clip requires target: ${key}/${action.id}/${actionClip.id}`,
                  );
                return presetTracks(
                  target,
                  actionClip.source.presetId,
                  0,
                  actionClip.duration,
                  literalPresetParams(
                    actionClip.source.params as
                      | Record<string, unknown>
                      | undefined,
                    actionValues,
                  ),
                );
              })();
        for (const track of baseTracks) {
          cycleTracks.push(
            expandPlaybackTrack(
              track as RuntimeTrack,
              {
                ...actionClip,
                playback: { ...actionClip.playback, rate: innerRate },
              },
              localStart,
              action.duration,
              actionValues,
            ),
          );
        }
      }
      const mergedCycle = new Map<string, RuntimeTrack>();
      for (const track of cycleTracks) {
        const trackKey = `${track.targetId}\u0000${track.property}`;
        const current = mergedCycle.get(trackKey);
        if (!current) {
          mergedCycle.set(trackKey, { ...track, keys: [...track.keys] });
          continue;
        }
        const byTime = new Map(
          current.keys.map((keyframe) => [keyframe.t, keyframe]),
        );
        for (const keyframe of track.keys) byTime.set(keyframe.t, keyframe);
        current.keys = [...byTime.values()].sort(
          (left, right) => left.t - right.t,
        );
      }
      const cycleWall = action.duration / outerRate;
      const fillLoop = action.loop && invocation.playback.iterations === 1;
      const outerIterations =
        invocation.playback.iterations === "infinite"
          ? ("infinite" as const)
          : fillLoop
            ? Math.max(1, Math.ceil(invocation.duration / cycleWall - 1e-9))
            : invocation.playback.iterations;
      if (
        !fillLoop &&
        typeof outerIterations === "number" &&
        cycleWall * outerIterations > invocation.duration + 1e-9
      ) {
        throw new Error(
          `Component Action ${invocation.id} exceeds invocation duration`,
        );
      }
      outputClips.push({
        id: `${node.id}::action:${invocation.id}`,
        schedule: { kind: "absolute", at: canonicalTime(invocationStart) },
        duration: action.duration,
        playback: {
          iterations: outerIterations,
          direction: invocation.playback.direction,
          rate: outerRate,
        },
        source: {
          kind: "tracks",
          tracks: [...mergedCycle.values()].map((track) => ({
            targetId: track.targetId,
            property: track.property,
            ...(track.preBehavior ? { preBehavior: track.preBehavior } : {}),
            ...(track.postBehavior ? { postBehavior: track.postBehavior } : {}),
            keys: track.keys.map((keyframe) => ({
              t: keyframe.t,
              v: keyframe.v,
              ...(keyframe.easing ? { easing: keyframe.easing } : {}),
            })),
          })),
        } as Extract<MotionClip["source"], { kind: "tracks" }>,
      });
    }
  }
  return {
    nodes: outputNodes,
    clips: outputClips,
    variables: componentVariables,
  };
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

/** Authoring IR v2 → renderer-only literal Runtime IR. */

// ── Phase 6 — runtime IR enrichment ───────────────────────────────────

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> =
  {
    "9:16": { width: 1080, height: 1920 },
    "16:9": { width: 1920, height: 1080 },
    "1:1": { width: 1080, height: 1080 },
  };

/**
 * Derive composition-level runtime metadata from the v2 authoring
 * metadata. The runtime IR becomes self-contained for renderers.
 */
function buildRuntimeComposition(
  metadata: MotionProject["metadata"],
): RuntimeCompositionMetadata {
  const dims =
    ASPECT_RATIO_DIMENSIONS[metadata.aspectRatio] ?? {
      width: 1920,
      height: 1080,
    };
  const background = metadata.designTokens?.colors?.["background"] ?? "#000000";
  return {
    width: dims.width,
    height: dims.height,
    fps: metadata.fps,
    background,
    colorSpace: "srgb",
    audioSampleRate: 44100,
    ...(metadata.safeArea ? { safeArea: metadata.safeArea } : {}),
  };
}

/**
 * Deterministic fingerprint of the capability manifest used to compile.
 * Bumped via `CAPABILITY_MANIFEST_VERSION` in motion-protocol.
 */
function buildCapabilityFingerprint(): string {
  return createHash("sha256")
    .update(`motion-capabilities:${CAPABILITY_MANIFEST_VERSION}`)
    .digest("hex")
    .slice(0, 16);
}

/** Recursive key-sorted canonical JSON for deterministic hashing. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Deterministic runtime hash over the IR (excluding the `runtimeHash`
 * field itself). Same project + same compiler → same hash.
 */
function computeRuntimeHash(ir: Record<string, unknown>): string {
  const { runtimeHash: _omit, ...hashInputs } = ir;
  return createHash("sha256")
    .update(canonicalJson(hashInputs))
    .digest("hex")
    .slice(0, 32);
}

/** Encode a scene sourceRef as a stable human-readable string. */
function encodeSourceRef(ref: RuntimeSourceRef): string {
  const base = ref.projectPath.join(":");
  return ref.sourceModule ? `${base}#${ref.sourceModule}` : base;
}

/** Authoring scene with an optional pre-attached runtime sourceRef. */
type AuthoringScene = MotionProject["scenes"][number] & {
  sourceRef?: RuntimeSourceRef;
};

export function compileMotionProject(
  project: MotionProject,
  options: CompileOptions = {},
): NormalizedMotionProjectV2 {
  // Phase 4: v3 projects compile through the v3 pipeline.
  if ((project as Record<string, unknown>).formatVersion === 3) {
    const result = compileMotionProjectV3(project as Parameters<typeof compileMotionProjectV3>[0], options);
    if (!result.ok) {
      throw new Error(
        `compileMotionProject failed: ${result.diagnostics
          .map((d: { code: string; message: string }) => `${d.code}: ${d.message}`)
          .join(" | ")}`,
      );
    }
    return result.project;
  }

  const projectVariables = new Map(
    project.variables.map((variable) => [variable.id, clone(variable.value)]),
  );
  const componentPackages = new Map(
    (options.components ?? []).map((component) => [
      `${component.componentId}@${component.componentVersion}`,
      component,
    ]),
  );
  const sceneOrder = new Map(
    project.timeline.sceneOrder.map((id, index) => [id, index]),
  );
  const scenes = project.scenes
    .map((scene) => clone(scene))
    .sort((a, b) => (sceneOrder.get(a.id) ?? 0) - (sceneOrder.get(b.id) ?? 0))
    .map((scene) => {
      for (const binding of project.bindings.filter(
        (candidate) => candidate.target.sceneId === scene.id,
      )) {
        const target = scene.nodes.find(
          (node) => node.id === binding.target.nodeId,
        );
        if (target)
          setPath(
            target as unknown as Record<string, unknown>,
            binding.target.property,
            projectVariables.get(binding.source.variableId),
          );
      }
      const expanded = expandComponents(
        scene.nodes,
        scene.clips,
        componentPackages,
        projectVariables,
        scene.duration,
      );
      const variables = new Map([...projectVariables, ...expanded.variables]);
      const resolvedAuthoringNodes = expanded.nodes.map(
        (node) => resolveValue(node, variables) as unknown as MotionNode,
      );
      const laidOut = applyLayoutConstraints(resolvedAuthoringNodes);
      const fitted = applyFitText(laidOut);
      const textExpanded = expandTextAnimators(fitted.nodes);
      const markers = new Map<string, number>(
        (scene.markers ?? []).map((marker: SceneMarker) => [
          marker.id,
          marker.t,
        ]),
      );
      const sourceRef = (scene as AuthoringScene).sourceRef ?? {
        projectPath: ["scenes", scene.id],
      };
      return {
        id: scene.id,
        duration: scene.duration,
        ...(scene.space ? { space: scene.space } : {}),
        ...(scene.motionBlur ? { motionBlur: scene.motionBlur } : {}),
        ...(scene.drivers && scene.drivers.length > 0
          ? { drivers: clone(scene.drivers) }
          : {}),
        ...(scene.activeCameraId
          ? { activeCameraId: scene.activeCameraId }
          : {}),
        ...(scene.transition ? { transition: scene.transition } : {}),
        sourceRef,
        nodes: textExpanded.nodes,
        tracks: [
          ...compileClips(
            textExpanded.nodes,
            expanded.clips,
            variables,
            scene.duration,
            markers,
          ),
          ...textExpanded.tracks,
        ],
      };
    });
  const sourceRefIndex: Record<string, string> = {};
  for (const scene of scenes) {
    sourceRefIndex[scene.id] = encodeSourceRef(scene.sourceRef);
  }
  const ir = {
    format: "motion-runtime",
    formatVersion: 2,
    runtimeVersion: MOTION_RUNTIME_VERSION,
    metadata: project.metadata,
    assets: project.assets,
    // v3 compiles carry explicit composition settings; v2 compiles derive
    // them from metadata (aspect ratio → pixel dimensions).
    composition:
      (project as { composition?: RuntimeCompositionMetadata }).composition ??
      buildRuntimeComposition(project.metadata),
    compilerVersion: COMPILER_VERSION,
    capabilityFingerprint: buildCapabilityFingerprint(),
    timeline: project.timeline,
    sourceRef: { scenes: sourceRefIndex },
    scenes,
  };
  return NormalizedMotionProjectV2Schema.parse({
    ...ir,
    runtimeHash: computeRuntimeHash(ir as unknown as Record<string, unknown>),
  });
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

// ── Structured compile entry point (Phase 2) ──────────────────────────

import {
  DiagnosticCollector,
  compileSuccess,
  compileFailure,
  type CompileResult,
} from "./compile-result";

/**
 * Compile a MotionProject → NormalizedMotionProjectV2 with structured diagnostics.
 *
 * Unlike `compileMotionProject()` which throws on errors, this returns
 * `{ ok: false, diagnostics }` so callers can surface issues without
 * try/catch boilerplate.
 */
export function compileMotionProjectV2(
  project: MotionProject,
  options: CompileOptions = {},
): CompileResult<NormalizedMotionProjectV2> {
  const collector = new DiagnosticCollector();

  try {
    const compiled = compileMotionProject(project, options);
    // Zod parse inside compileMotionProject may throw ZodError
    const warnings: typeof collector.diagnostics = [];
    // (Future: collect non-fatal warnings during compilation)
    return compileSuccess(compiled, [...warnings]);
  } catch (err: unknown) {
    // Convert Zod validation errors to structured diagnostics
    if (err && typeof err === "object" && "issues" in err) {
      const zodErr = err as {
        issues: Array<{
          path: (string | number)[];
          message: string;
          code: string;
        }>;
      };
      for (const issue of zodErr.issues) {
        collector.error("RUNTIME_VALIDATION_ERROR", issue.message, {
          path: issue.path,
          details: { zodCode: issue.code },
        });
      }
    } else if (err instanceof Error) {
      // Map known error messages to diagnostic codes
      const msg = err.message;
      if (msg.includes("Unknown variable reference")) {
        collector.error("UNKNOWN_VARIABLE", msg);
      } else if (msg.includes("Unknown clip target")) {
        collector.error("UNKNOWN_CLIP_TARGET", msg);
      } else if (msg.includes("Unknown scene marker")) {
        collector.error("UNKNOWN_MARKER", msg);
      } else if (
        msg.includes("Component package unavailable") ||
        msg.includes("Unknown Component Action") ||
        msg.includes("Unknown Component Action lip-sync")
      ) {
        collector.error("UNKNOWN_COMPONENT", msg);
      } else if (msg.includes("Unknown variant")) {
        collector.error("UNKNOWN_VARIANT", msg);
      } else if (msg.includes("Invalid keyframe time")) {
        collector.error("INVALID_KEYFRAME_TIME", msg);
      } else if (
        msg.includes("must be > 0") ||
        msg.includes("playback.rate must")
      ) {
        collector.error("INVALID_PLAYBACK_RATE", msg);
      } else if (msg.includes("Clip schedule cycle")) {
        collector.error("CLIP_SCHEDULE_CYCLE", msg);
      } else if (msg.includes("exceeds invocation duration")) {
        collector.error("CLIP_EXCEEDS_DURATION", msg);
      } else if (
        msg.includes("Nested component") ||
        msg.includes("Nested Component Action")
      ) {
        collector.error("NESTED_COMPONENT", msg);
      } else if (
        msg.includes("Repeater source must be a list") ||
        msg.includes("Repeater item") ||
        msg.includes("Repeater key")
      ) {
        collector.error("REPEATER_INVALID_SOURCE", msg);
      } else if (
        msg.includes("Preset clip") &&
        msg.includes("requires targetId")
      ) {
        collector.error("PRESET_NO_TARGET", msg);
      } else if (msg.includes("Unexpanded Component Action clip")) {
        collector.error("UNEXPANDED_ACTION_CLIP", msg);
      } else {
        collector.error("RUNTIME_VALIDATION_ERROR", msg);
      }
    } else {
      collector.error("RUNTIME_VALIDATION_ERROR", String(err));
    }
    return compileFailure([...collector.diagnostics]);
  }
}
