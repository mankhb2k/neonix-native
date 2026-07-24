import {
  NormalizedMotionProjectV2Schema,
  segmentTextUnits,
  type MotionClip,
  type MotionComponentV2,
  type MotionNode,
  type MotionProject,
  type NormalizedMotionProjectV2,
} from "@motionvideo/motion-schema";

type RuntimeTrack = NormalizedMotionProjectV2["scenes"][number]["tracks"][number];
type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];

export type CompileOptions = {
  components?: MotionComponentV2[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (current === null || typeof current !== "object" || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last) cursor[last] = clone(value);
}

function getPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveValue(value: unknown, variables: Map<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, variables));
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const ref = record.ref;
  if (ref && typeof ref === "object" && (ref as Record<string, unknown>).kind === "variable") {
    const id = (ref as Record<string, unknown>).id;
    if (typeof id !== "string" || !variables.has(id)) throw new Error(`Unknown variable reference: ${String(id)}`);
    const raw = variables.get(id);
    const map = record.map;
    if (map && typeof map === "object" && typeof raw === "number") {
      const scale = typeof (map as Record<string, unknown>).scale === "number" ? (map as Record<string, number>).scale : 1;
      const offset = typeof (map as Record<string, unknown>).offset === "number" ? (map as Record<string, number>).offset : 0;
      return raw * scale + offset;
    }
    return clone(raw);
  }
  return Object.fromEntries(Object.entries(record).map(([key, nested]) => [key, resolveValue(nested, variables)]));
}

type PlaybackDirection = MotionClip["playback"]["direction"];

function playbackRate(clip: MotionClip, variables: Map<string, unknown>): number {
  const rate = number(resolveValue(clip.playback.rate, variables), `clips.${clip.id}.playback.rate`);
  if (rate <= 0) throw new Error(`clips.${clip.id}.playback.rate must be > 0`);
  return rate;
}

function playbackDuration(clip: MotionClip, variables: Map<string, unknown>, sceneDuration?: number): number {
  const rate = playbackRate(clip, variables);
  if (clip.playback.iterations === "infinite") {
    if (sceneDuration === undefined) throw new Error(`Infinite playback requires a scene duration: ${clip.id}`);
    return Math.max(0, sceneDuration);
  }
  return clip.duration * clip.playback.iterations / rate;
}

function scheduleTimes(clips: MotionClip[], variables: Map<string, unknown> = new Map(), sceneDuration?: number): Map<string, number> {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const times = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (clip: MotionClip): number => {
    const cached = times.get(clip.id);
    if (cached !== undefined) return cached;
    if (visiting.has(clip.id)) throw new Error(`Clip schedule cycle: ${clip.id}`);
    visiting.add(clip.id);
    let at: number;
    if (clip.schedule.kind === "absolute") at = clip.schedule.at;
    else {
      const dependency = byId.get(clip.schedule.clipId);
      if (!dependency) throw new Error(`Unknown schedule clip: ${clip.schedule.clipId}`);
      const dependencyStart = resolve(dependency);
      at = clip.schedule.kind === "after"
        ? dependencyStart + playbackDuration(dependency, variables, sceneDuration) + (clip.schedule.offset ?? 0)
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
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must resolve to a number`);
  return value;
}

function canonicalTime(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function presetTracks(node: RuntimeNode, preset: string, start: number, end: number): RuntimeTrack[] {
  const x = node.transform.x;
  const y = node.transform.y;
  const opacity = (from = 0, to = node.transform.opacity): RuntimeTrack => ({
    targetId: node.id,
    property: "transform.opacity",
    keys: [{ t: start, v: from }, { t: end, v: to, easing: "easeOut" }],
  });
  switch (preset) {
    case "fade-up": return [opacity(), { targetId: node.id, property: "transform.y", keys: [{ t: start, v: y + 48 }, { t: end, v: y, easing: "easeOut" }] }];
    case "fade-down": return [opacity(), { targetId: node.id, property: "transform.y", keys: [{ t: start, v: y - 48 }, { t: end, v: y, easing: "easeOut" }] }];
    case "fade-left": return [opacity(), { targetId: node.id, property: "transform.x", keys: [{ t: start, v: x + 48 }, { t: end, v: x, easing: "easeOut" }] }];
    case "fade-right": return [opacity(), { targetId: node.id, property: "transform.x", keys: [{ t: start, v: x - 48 }, { t: end, v: x, easing: "easeOut" }] }];
    case "slide-up": return [opacity(), { targetId: node.id, property: "transform.y", keys: [{ t: start, v: y + 120 }, { t: end, v: y, easing: "easeOut" }] }];
    case "slide-left": return [opacity(), { targetId: node.id, property: "transform.x", keys: [{ t: start, v: x + 120 }, { t: end, v: x, easing: "easeOut" }] }];
    case "slide-right": return [opacity(), { targetId: node.id, property: "transform.x", keys: [{ t: start, v: x - 120 }, { t: end, v: x, easing: "easeOut" }] }];
    case "scale-in":
    case "zoom-in":
    case "pop": return [opacity(),
      { targetId: node.id, property: "transform.scaleX", keys: [{ t: start, v: 0.65 }, { t: end, v: node.transform.scaleX, easing: preset === "pop" ? "spring" : "easeOut" }] },
      { targetId: node.id, property: "transform.scaleY", keys: [{ t: start, v: 0.65 }, { t: end, v: node.transform.scaleY, easing: preset === "pop" ? "spring" : "easeOut" }] },
    ];
    case "counter": return [{ targetId: node.id, property: "payload.counterProgress", keys: [{ t: start, v: 0 }, { t: end, v: 1, easing: "easeOut" }] }];
    case "fade-in":
    default: return [opacity()];
  }
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
  const iterations = clip.playback.iterations === "infinite" ? Number.POSITIVE_INFINITY : clip.playback.iterations;
  const keys: RuntimeTrack["keys"] = [];
  const append = (key: RuntimeTrack["keys"][number]): void => {
    const previous = keys.at(-1);
    if (previous && Math.abs(previous.t - key.t) <= 1e-8) keys[keys.length - 1] = { ...key, t: previous.t };
    else if (key.t <= sceneDuration + 1e-9) keys.push(key);
  };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cycleStart = canonicalTime(start + iteration * cycleDuration);
    if (cycleStart >= sceneDuration - 1e-9) break;
    const cycleEnd = Math.min(sceneDuration, cycleStart + cycleDuration);
    const reverse = clip.playback.direction === "reverse"
      || (clip.playback.direction === "alternate" && iteration % 2 === 1);
    const sourceKeys = reverse
      ? [...track.keys].reverse().map((key) => ({ ...key, t: canonicalTime((clip.duration - key.t) / rate) }))
      : track.keys.map((key) => ({ ...key, t: canonicalTime(key.t / rate) }));
    for (const key of sourceKeys) {
      const absolute = canonicalTime(cycleStart + key.t);
      if (absolute <= cycleEnd + 1e-9) append({ ...key, t: absolute });
    }
  }
  return { ...track, keys };
}

function compileClips(nodes: RuntimeNode[], clips: MotionClip[], variables: Map<string, unknown>, sceneDuration: number): RuntimeTrack[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const starts = scheduleTimes(clips, variables, sceneDuration);
  const expanded = clips.flatMap((clip) => {
    const start = canonicalTime(starts.get(clip.id) ?? 0);
    if (clip.source.kind === "tracks") {
      return clip.source.tracks.map((track) => expandPlaybackTrack({
        targetId: track.targetId,
        property: track.property,
        keys: track.keys.map((key) => ({ t: key.t, v: resolveValue(key.v, variables) as RuntimeTrack["keys"][number]["v"], ...(key.easing ? { easing: key.easing } : {}) })),
      }, clip, start, sceneDuration, variables));
    }
    if (clip.source.kind === "component-action") throw new Error(`Unexpanded Component Action clip: ${clip.id}`);
    if (!clip.targetId) throw new Error(`Preset clip ${clip.id} requires targetId`);
    const node = nodeById.get(clip.targetId);
    if (!node) throw new Error(`Unknown clip target: ${clip.targetId}`);
    return presetTracks(node, clip.source.presetId, 0, clip.duration)
      .map((track) => expandPlaybackTrack(track, clip, start, sceneDuration, variables));
  });
  const merged = new Map<string, RuntimeTrack>();
  for (const track of expanded) {
    const key = `${track.targetId}\u0000${track.property}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...track, keys: [...track.keys] });
      continue;
    }
    const byTime = new Map(current.keys.map((keyframe) => [keyframe.t, keyframe]));
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
): { nodes: RuntimeNode[]; clips: MotionClip[]; variables: Map<string, unknown> } {
  const outputNodes: RuntimeNode[] = [];
  const sceneStarts = scheduleTimes(clips, projectVariables, sceneDuration);
  const actionInvocationIds = new Set(clips.filter((clip) => clip.source.kind === "component-action").map((clip) => clip.id));
  const outputClips = clips
    .filter((clip) => clip.source.kind !== "component-action")
    .map((clip) => clip.schedule.kind !== "absolute" && actionInvocationIds.has(clip.schedule.clipId)
      ? { ...clone(clip), schedule: { kind: "absolute" as const, at: sceneStarts.get(clip.id) ?? 0 } }
      : clone(clip));
  const componentVariables = new Map<string, unknown>();
  for (const node of nodes) {
    if (node.type !== "component") {
      outputNodes.push(clone(node) as RuntimeNode);
      continue;
    }
    const key = `${node.payload.componentId}@${node.payload.componentVersion}`;
    const component = componentPackages.get(key);
    if (!component) throw new Error(`Component package unavailable: ${key}`);
    const values = new Map<string, unknown>(component.variables.map((variable) => [variable.id, clone(variable.value)]));
    for (const api of component.publicAPI) if (api.id in node.payload.props) values.set(api.variableId, clone(node.payload.props[api.id]));
    const internalById = new Map(component.nodes.map((internal) => [internal.id, internal]));
    const repeatRoots = component.nodes.filter((internal) => internal.repeat);
    const repeatOwner = (internal: MotionNode): MotionNode | undefined => {
      let current: MotionNode | undefined = internal;
      while (current) {
        if (current.repeat) return current;
        current = current.parentId ? internalById.get(current.parentId) : undefined;
      }
      return undefined;
    };
    type ExpandedTarget = { node?: RuntimeNode; context?: Record<string, unknown>; itemIndex?: number; repeatKey?: string; timeStagger?: number };
    const targets = new Map<string, ExpandedTarget[]>();
    const expanded: RuntimeNode[] = [];
    const addExpanded = (internal: MotionNode, id: string, parentId: string | null, context?: Record<string, unknown>, itemIndex?: number, repeatKey?: string, timeStagger?: number): void => {
      if (internal.type === "component") throw new Error(`Nested component is not supported: ${key}/${internal.id}`);
      const next = clone(internal) as RuntimeNode;
      delete (next as RuntimeNode & { repeat?: unknown }).repeat;
      next.id = id;
      next.parentId = parentId;
      if (internal.mask) {
        const source = internalById.get(internal.mask.sourceNodeId);
        const sharesRepeat = Boolean(repeatKey && source && repeatOwner(source)?.id === repeatOwner(internal)?.id);
        next.mask = {
          ...internal.mask,
          sourceNodeId: `${node.id}::${internal.mask.sourceNodeId}${sharesRepeat ? `::${repeatKey}` : ""}`,
        };
      }
      if (internal.modifiers) {
        next.modifiers = internal.modifiers.map((modifier) => {
          if (modifier.type !== "motion-path") return modifier;
          const source = internalById.get(modifier.pathNodeId);
          const sharesRepeat = Boolean(repeatKey && source && repeatOwner(source)?.id === repeatOwner(internal)?.id);
          return { ...modifier, pathNodeId: `${node.id}::${modifier.pathNodeId}${sharesRepeat ? `::${repeatKey}` : ""}` };
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
    for (const internal of component.nodes.filter((candidate) => !repeatOwner(candidate))) {
      addExpanded(internal, `${node.id}::${internal.id}`, internal.parentId ? `${node.id}::${internal.parentId}` : node.parentId);
    }
    for (const root of repeatRoots) {
      const directive = root.repeat!;
      const items = directive.source.kind === "list"
        ? values.get(directive.source.variableId)
        : Array.from({ length: directive.source.count }, (_, index) => ({ index: index + 1 }));
      if (!Array.isArray(items)) throw new Error(`Repeater source must be a list: ${key}/${directive.source.kind === "list" ? directive.source.variableId : root.id}`);
      const subtree = component.nodes.filter((candidate) => repeatOwner(candidate)?.id === root.id);
      items.forEach((item, index) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`Repeater item ${index} must be an object`);
        const rawKey = directive.source.kind === "list"
          ? getPath(item, directive.source.keyPath)
          : `${directive.source.keyPrefix}-${index + 1}`;
        if (typeof rawKey !== "string" && typeof rawKey !== "number") throw new Error(`Repeater key ${directive.source.kind === "list" ? directive.source.keyPath : directive.source.keyPrefix} is missing at item ${index}`);
        const repeatKey = String(rawKey);
        const context = { [directive.itemAlias]: item, [directive.indexAlias]: index + 1 };
        for (const internal of subtree) {
          const id = `${node.id}::${internal.id}::${repeatKey}`;
          const parentId = internal.id === root.id
            ? (root.parentId ? `${node.id}::${root.parentId}` : node.parentId)
            : `${node.id}::${internal.parentId}::${repeatKey}`;
          addExpanded(internal, id, parentId, context, index, repeatKey, directive.timeStagger);
          const created = expanded[expanded.length - 1]!;
          if (internal.id === root.id) {
            const layout = directive.layout;
            if (layout.kind === "linear") { created.transform.x += index * layout.offsetX; created.transform.y += index * layout.offsetY; }
            else if (layout.kind === "grid") { created.transform.x += (index % layout.columns) * layout.gapX; created.transform.y += Math.floor(index / layout.columns) * layout.gapY; }
            else if (layout.kind === "radial") {
              const angle = items.length === 1 ? layout.startAngle : layout.startAngle + (layout.endAngle - layout.startAngle) * index / (items.length - 1);
              const radians = angle * Math.PI / 180;
              created.transform.x += Math.cos(radians) * layout.radius;
              created.transform.y += Math.sin(radians) * layout.radius;
              if (layout.orientToAngle) created.transform.rotation += angle;
            }
          }
        }
      });
    }
    const readContext = (context: Record<string, unknown> | undefined, path: string): unknown => {
      let current: unknown = context;
      for (const part of path.split(".")) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    };
    for (const binding of component.bindings) {
      for (const target of targets.get(binding.target.nodeId) ?? []) {
        const value = binding.source.kind === "variable"
          ? values.get(binding.source.variableId)
          : readContext(target.context, binding.source.path);
        setPath(target.node as unknown as Record<string, unknown>, binding.target.property, value);
      }
    }
    outputNodes.push(...expanded);
    for (const clipInput of component.clips) {
      const resolved = resolveValue(clipInput, values) as MotionClip;
      const clipTargets: ExpandedTarget[] = resolved.targetId ? targets.get(resolved.targetId) ?? [] : [{ node: undefined }];
      for (const target of clipTargets) {
        const suffix = target.repeatKey ? `::${target.repeatKey}` : "";
        const presetStagger = resolved.source.kind === "preset" ? resolved.source.params?.stagger : undefined;
        const staggerStep = target.timeStagger ?? (typeof presetStagger === "number" ? presetStagger : 0);
        const stagger = target.itemIndex !== undefined ? staggerStep * target.itemIndex : 0;
        outputClips.push({
          ...clone(resolved),
          id: `${node.id}::${resolved.id}${suffix}`,
          targetId: target.node?.id,
          schedule: resolved.schedule.kind === "absolute"
            ? { ...resolved.schedule, at: canonicalTime(resolved.schedule.at + stagger) }
            : { ...resolved.schedule, clipId: `${node.id}::${resolved.schedule.clipId}${suffix}` },
          source: resolved.source.kind === "tracks"
            ? { ...clone(resolved.source), tracks: resolved.source.tracks.map((track) => {
                const matching = targets.get(track.targetId)?.find((candidate) => candidate.repeatKey === target.repeatKey) ?? targets.get(track.targetId)?.[0];
                return { ...clone(track), targetId: matching?.node?.id ?? `${node.id}::${track.targetId}` };
              }) }
            : clone(resolved.source),
        });
      }
    }
    const slotByNodeId = new Map(component.cutoutRigs.flatMap((rig) => rig.slots.map((slot) => [slot.nodeId, slot] as const)));
    for (const invocation of clips.filter((clip) => clip.targetId === node.id && clip.source.kind === "component-action")) {
      if (invocation.source.kind !== "component-action") continue;
      const actionId = invocation.source.actionId;
      const action = component.actions.find((candidate) => candidate.id === actionId);
      if (!action) throw new Error(`Unknown Component Action: ${key}/${actionId}`);
      const baseValues = new Map([...projectVariables, ...values]);
      const actionValues = new Map(baseValues);
      for (const [paramId, paramValue] of Object.entries(invocation.source.params ?? {})) actionValues.set(paramId, resolveValue(paramValue, baseValues));
      const outerRate = number(resolveValue(invocation.playback.rate, baseValues), `clips.${invocation.id}.playback.rate`);
      if (outerRate <= 0) throw new Error(`clips.${invocation.id}.playback.rate must be > 0`);
      const resolvedActionClips = action.clips.map((clip) => resolveValue(resolveValue(clip, actionValues), actionValues) as MotionClip);
      const actionStarts = scheduleTimes(resolvedActionClips, actionValues, action.duration);
      const invocationStart = sceneStarts.get(invocation.id) ?? 0;
      const cycleTracks: RuntimeTrack[] = [];
      if (action.lipSync) {
        const slot = component.cutoutRigs.flatMap((rig) => rig.slots).find((candidate) => candidate.id === action.lipSync!.slotId);
        if (!slot) throw new Error(`Unknown Component Action lip-sync slot: ${key}/${action.lipSync.slotId}`);
        const expandedTarget = targets.get(slot.nodeId)?.[0]?.node;
        if (!expandedTarget) throw new Error(`Unknown Component Action lip-sync target: ${key}/${action.id}/${slot.nodeId}`);
        cycleTracks.push({
          targetId: expandedTarget.id,
          property: "payload.assetId",
          keys: action.lipSync.cues.map((cue) => {
            const variant = slot.variants.find((candidate) => candidate.id === cue.variantId);
            if (!variant) throw new Error(`Unknown Component Action lip-sync variant: ${key}/${action.id}/${slot.id}/${cue.variantId}`);
            return { t: cue.at, v: variant.assetId, easing: "step" };
          }),
        });
      }
      for (const actionClip of resolvedActionClips) {
        const innerRate = number(resolveValue(actionClip.playback.rate, actionValues), `actions.${action.id}.clips.${actionClip.id}.playback.rate`);
        if (innerRate <= 0) throw new Error(`actions.${action.id}.clips.${actionClip.id}.playback.rate must be > 0`);
        const localStart = actionStarts.get(actionClip.id) ?? 0;
        if (actionClip.source.kind === "component-action") throw new Error(`Nested Component Action is not supported: ${key}/${action.id}`);
        const baseTracks = actionClip.source.kind === "tracks"
          ? actionClip.source.tracks.map((track) => {
              const expandedTarget = targets.get(track.targetId)?.[0]?.node;
              if (!expandedTarget) throw new Error(`Unknown Component Action target: ${key}/${action.id}/${track.targetId}`);
              if (track.property !== "payload.variantId") {
                return {
                  targetId: expandedTarget.id,
                  property: track.property,
                  keys: track.keys.map((keyframe) => ({
                    t: keyframe.t,
                    v: resolveValue(keyframe.v, actionValues) as RuntimeTrack["keys"][number]["v"],
                    ...(keyframe.easing ? { easing: keyframe.easing } : {}),
                  })),
                };
              }
              const slot = slotByNodeId.get(track.targetId);
              if (!slot) throw new Error(`Unknown Component Action variant slot: ${key}/${track.targetId}`);
              return {
                targetId: expandedTarget.id,
                property: "payload.assetId",
                keys: track.keys.map((keyframe) => {
                  const variant = slot.variants.find((candidate) => candidate.id === keyframe.v);
                  if (!variant) throw new Error(`Unknown variant ${String(keyframe.v)} for ${slot.id}`);
                  return { t: keyframe.t, v: variant.assetId, ...(keyframe.easing ? { easing: keyframe.easing } : {}) };
                }),
              };
            })
          : (() => {
              const target = actionClip.targetId ? targets.get(actionClip.targetId)?.[0]?.node : undefined;
              if (!target) throw new Error(`Preset Component Action clip requires target: ${key}/${action.id}/${actionClip.id}`);
              return presetTracks(target, actionClip.source.presetId, 0, actionClip.duration);
            })();
        for (const track of baseTracks) {
          cycleTracks.push(expandPlaybackTrack(track, { ...actionClip, playback: { ...actionClip.playback, rate: innerRate } }, localStart, action.duration, actionValues));
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
        const byTime = new Map(current.keys.map((keyframe) => [keyframe.t, keyframe]));
        for (const keyframe of track.keys) byTime.set(keyframe.t, keyframe);
        current.keys = [...byTime.values()].sort((left, right) => left.t - right.t);
      }
      const cycleWall = action.duration / outerRate;
      const fillLoop = action.loop && invocation.playback.iterations === 1;
      const outerIterations = invocation.playback.iterations === "infinite"
        ? "infinite" as const
        : fillLoop
          ? Math.max(1, Math.ceil(invocation.duration / cycleWall - 1e-9))
          : invocation.playback.iterations;
      if (!fillLoop && typeof outerIterations === "number" && cycleWall * outerIterations > invocation.duration + 1e-9) {
        throw new Error(`Component Action ${invocation.id} exceeds invocation duration`);
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
  return { nodes: outputNodes, clips: outputClips, variables: componentVariables };
}

function expandTextAnimators(nodes: MotionNode[]): { nodes: RuntimeNode[]; tracks: RuntimeTrack[] } {
  const outputNodes: RuntimeNode[] = [];
  const outputTracks: RuntimeTrack[] = [];
  for (const node of nodes) {
    if (node.type !== "text" || !node.textAnimator) {
      outputNodes.push(clone(node) as RuntimeNode);
      continue;
    }
    const animator = node.textAnimator;
    const units = segmentTextUnits(node.payload.text, animator.unit, animator.locale);
    const horizontal = animator.unit !== "line";
    const cellWidth = horizontal ? node.transform.width / Math.max(1, units.length) : node.transform.width;
    const cellHeight = horizontal ? node.transform.height : node.transform.height / Math.max(1, units.length);
    const left = node.transform.x - node.transform.anchorX * node.transform.width;
    const top = node.transform.y - node.transform.anchorY * node.transform.height;
    let selectedIndex = 0;
    units.forEach((text, index) => {
      const run = clone(node) as typeof node & { textAnimator?: unknown; repeat?: unknown };
      delete run.textAnimator;
      delete run.repeat;
      run.id = `${node.id}::${animator.id}::${index}`;
      run.payload.text = text;
      run.transform.x = horizontal ? left + cellWidth * (index + 0.5) : left + cellWidth / 2;
      run.transform.y = horizontal ? top + cellHeight / 2 : top + cellHeight * (index + 0.5);
      run.transform.width = cellWidth;
      run.transform.height = cellHeight;
      run.transform.anchorX = 0.5;
      run.transform.anchorY = 0.5;
      outputNodes.push(run as RuntimeNode);

      const progress = units.length <= 1 ? 0 : index / (units.length - 1);
      if (progress < animator.selector.start || progress > animator.selector.end) return;
      const start = canonicalTime(animator.startTime + selectedIndex * animator.stagger);
      const end = canonicalTime(start + animator.duration);
      selectedIndex += 1;
      const track = (property: string, from: RuntimeTrack["keys"][number]["v"], to: RuntimeTrack["keys"][number]["v"]): void => {
        outputTracks.push({ targetId: run.id, property, keys: [{ t: start, v: from }, { t: end, v: to, easing: animator.easing }] });
      };
      if (animator.properties.offsetX !== undefined) track("transform.x", run.transform.x + animator.properties.offsetX, run.transform.x);
      if (animator.properties.offsetY !== undefined) track("transform.y", run.transform.y + animator.properties.offsetY, run.transform.y);
      if (animator.properties.rotation !== undefined) track("transform.rotation", run.transform.rotation + animator.properties.rotation, run.transform.rotation);
      if (animator.properties.scale !== undefined) {
        track("transform.scaleX", run.transform.scaleX * animator.properties.scale, run.transform.scaleX);
        track("transform.scaleY", run.transform.scaleY * animator.properties.scale, run.transform.scaleY);
      }
      if (animator.properties.opacity !== undefined) track("transform.opacity", run.transform.opacity * animator.properties.opacity, run.transform.opacity);
      if (animator.properties.fill !== undefined) track("style.fill", animator.properties.fill, run.style?.fill ?? "#ffffff");
    });
  }
  return { nodes: outputNodes, tracks: outputTracks };
}

/** Authoring IR v2 → renderer-only literal Runtime IR. */
export function compileMotionProject(project: MotionProject, options: CompileOptions = {}): NormalizedMotionProjectV2 {
  const projectVariables = new Map(project.variables.map((variable) => [variable.id, clone(variable.value)]));
  const componentPackages = new Map((options.components ?? []).map((component) => [`${component.componentId}@${component.componentVersion}`, component]));
  const sceneOrder = new Map(project.timeline.sceneOrder.map((id, index) => [id, index]));
  const scenes = project.scenes
    .map((scene) => clone(scene))
    .sort((a, b) => (sceneOrder.get(a.id) ?? 0) - (sceneOrder.get(b.id) ?? 0))
    .map((scene) => {
      for (const binding of project.bindings.filter((candidate) => candidate.target.sceneId === scene.id)) {
        const target = scene.nodes.find((node) => node.id === binding.target.nodeId);
        if (target) setPath(target as unknown as Record<string, unknown>, binding.target.property, projectVariables.get(binding.source.variableId));
      }
      const expanded = expandComponents(scene.nodes, scene.clips, componentPackages, projectVariables, scene.duration);
      const variables = new Map([...projectVariables, ...expanded.variables]);
      const resolvedAuthoringNodes = expanded.nodes.map((node) => resolveValue(node, variables) as unknown as MotionNode);
      const textExpanded = expandTextAnimators(resolvedAuthoringNodes);
      return {
        id: scene.id,
        duration: scene.duration,
        nodes: textExpanded.nodes,
        tracks: [...compileClips(textExpanded.nodes, expanded.clips, variables, scene.duration), ...textExpanded.tracks],
      };
    });
  return NormalizedMotionProjectV2Schema.parse({
    format: "motion-runtime",
    formatVersion: 2,
    metadata: project.metadata,
    assets: project.assets,
    timeline: project.timeline,
    scenes,
  });
}

export type CompiledProject = NormalizedMotionProjectV2;
