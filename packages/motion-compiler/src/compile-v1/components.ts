import { V1 } from "@motionvideo/motion-protocol";
import {
  clone,
  setPropertyPath,
  type JsonRecord,
  type V1SceneClip,
} from "./helpers";
import { prepareRuntimeLayer } from "./prepare";

export type ComponentInstanceRef = {
  componentLayerId: string;
  componentId: string;
  runtimeSceneId: string;
};

type ResolvedLayerTarget = {
  instancePrefix: string;
  layerId: string;
  property: string;
};

export function resolvePropTargets(
  components: Map<string, V1.ComponentDefinitionV1>,
  component: V1.ComponentDefinitionV1,
  propId: string,
  instancePrefix: string,
  stack: Set<string> = new Set(),
): ResolvedLayerTarget[] {
  const cycleKey = `${component.id}::${propId}`;
  if (stack.has(cycleKey)) return [];
  const nextStack = new Set(stack);
  nextStack.add(cycleKey);

  const out: ResolvedLayerTarget[] = [];
  for (const binding of component.propBindings) {
    if (binding.propId !== propId) continue;
    const target = binding.target;
    if (target.kind === "layerProperty") {
      out.push({
        instancePrefix,
        layerId: target.layerId,
        property: target.property,
      });
      continue;
    }
    const childNode = component.layers.find(
      (node) => node.id === target.childLayerId,
    );
    if (!childNode || childNode.type !== "component") continue;
    const childDef = components.get(childNode.payload.componentId);
    if (!childDef) continue;
    out.push(
      ...resolvePropTargets(
        components,
        childDef,
        target.propId,
        `${instancePrefix}__${childNode.id}`,
        nextStack,
      ),
    );
  }
  return out;
}

function isKeyframesPropValue(
  value: unknown,
): value is {
  kind: "keyframes";
  keys: Array<{ t: number; value: unknown; easing?: unknown }>;
  interpolation?: string;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "keyframes" &&
    Array.isArray((value as { keys?: unknown }).keys)
  );
}

function resolveComponentPropValues(
  component: V1.ComponentDefinitionV1,
  payload: V1.ComponentLayerV1["payload"],
  extras?: {
    bindingValues?: Record<string, unknown>;
    trackValues?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const prop of component.props) {
    resolved[prop.id] = prop.default;
  }
  const variant = payload.variantId
    ? component.variants.find((v) => v.id === payload.variantId)
    : undefined;
  if (variant) {
    Object.assign(resolved, variant.props);
  }
  Object.assign(resolved, payload.props ?? {});
  if (extras?.bindingValues) {
    Object.assign(resolved, extras.bindingValues);
  }
  if (extras?.trackValues) {
    Object.assign(resolved, extras.trackValues);
  }
  return resolved;
}

type ScenePropSources = {
  authoringSceneId: string;
  bindings: V1.MotionProjectV1["bindings"];
  variables: Map<string, unknown>;
  trackValuesByInstance: Map<string, Record<string, unknown>>;
};

function collectBindingValuesForInstance(
  bindings: V1.MotionProjectV1["bindings"],
  variables: Map<string, unknown>,
  authoringSceneId: string,
  instance: V1.ComponentLayerV1,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const binding of bindings) {
    const target = binding.target;
    let propId: string | undefined;
    if (
      target.kind === "component" &&
      target.componentId === instance.payload.componentId
    ) {
      propId = target.propId;
    } else if (
      target.kind === "componentLayer" &&
      target.sceneId === authoringSceneId &&
      target.layerId === instance.id
    ) {
      propId = target.propId;
    }
    if (!propId || !variables.has(binding.source.variableId)) continue;
    out[propId] = variables.get(binding.source.variableId);
  }
  return out;
}

function collectScenePropTrackSources(
  scene: V1.SceneDefinitionV1,
): Map<string, Record<string, unknown>> {
  const byInstance = new Map<string, Record<string, unknown>>();
  for (const clip of scene.clips ?? []) {
    if (clip.source.kind !== "tracks") continue;
    for (const track of clip.source.tracks) {
      if (typeof track.property !== "string") continue;
      const match = /^payload\.props\.(.+)$/.exec(track.property);
      if (!match) continue;
      const instanceId =
        typeof track.layerId === "string"
          ? track.layerId
          : typeof clip.layerId === "string"
            ? clip.layerId
            : undefined;
      if (!instanceId) continue;
      const keys: Array<{ t: number; value: unknown; easing?: unknown }> = [];
      for (const key of track.keys) {
        if (typeof key.t !== "number") continue;
        keys.push({
          t: key.t,
          value: key.v,
          ...(key.easing !== undefined ? { easing: key.easing } : {}),
        });
      }
      if (keys.length === 0) continue;
      const props = byInstance.get(instanceId) ?? {};
      props[match[1]!] = { kind: "keyframes", keys };
      byInstance.set(instanceId, props);
    }
  }
  return byInstance;
}

function applyComponentPropForwards(
  component: V1.ComponentDefinitionV1,
  internalLayers: V1.LayerV1[],
  resolvedProps: Record<string, unknown>,
): V1.LayerV1[] {
  return internalLayers.map((node) => {
    if (node.type !== "component") return node;
    const forwarded: Record<string, unknown> = {
      ...(node.payload.props ?? {}),
    };
    for (const binding of component.propBindings) {
      if (
        binding.target.kind === "childProp" &&
        binding.target.childLayerId === node.id &&
        binding.propId in resolvedProps
      ) {
        forwarded[binding.target.propId] = resolvedProps[binding.propId];
      }
    }
    return {
      ...node,
      payload: {
        ...node.payload,
        props: forwarded as V1.ComponentLayerV1["payload"]["props"],
      },
    };
  });
}

function buildPropKeyframeClip(
  instanceId: string,
  propId: string,
  layer: Extract<
    V1.ComponentPropBindingV1["target"],
    { kind: "layerProperty" }
  >,
  keyframes: {
    keys: Array<{ t: number; value: unknown; easing?: unknown }>;
    interpolation?: string;
  },
  propKind: string,
): JsonRecord {
  const targetId = `${instanceId}__${layer.layerId}`;
  const valueKind =
    propKind === "number"
      ? "number"
      : propKind === "color"
        ? "color"
        : propKind === "boolean"
          ? "boolean"
          : "string";
  return {
    id: `${instanceId}__prop__${propId}__${layer.layerId}`,
    layerId: targetId,
    schedule: { kind: "absolute", at: 0 },
    duration: Math.max(...keyframes.keys.map((k) => k.t), 0),
    playback: { rate: 1, iterations: 1, direction: "normal" },
    source: {
      kind: "tracks",
      tracks: [
        {
          layerId: targetId,
          property: layer.property,
          valueKind,
          keys: keyframes.keys.map((k) => ({
            t: k.t,
            v: k.value,
            ...(k.easing !== undefined ? { easing: k.easing } : {}),
          })),
        },
      ],
    },
  };
}

type ExpandComponentResult = {
  layers: V1.LayerV1[];
  wrapperId: string;
  propClips: JsonRecord[];
};

function expandOneComponentInstance(
  instanceNode: V1.ComponentLayerV1,
  instanceId: string,
  parentLayerId: string | null,
  components: Map<string, V1.ComponentDefinitionV1>,
  runtimeSceneId: string | null,
  componentInstances: Map<string, ComponentInstanceRef> | null,
  propSources: ScenePropSources | null,
): ExpandComponentResult {
  const component = components.get(instanceNode.payload.componentId);
  if (!component) {
    return { layers: [instanceNode], wrapperId: instanceId, propClips: [] };
  }

  if (componentInstances && runtimeSceneId) {
    componentInstances.set(instanceId, {
      componentLayerId: instanceId,
      componentId: instanceNode.payload.componentId,
      runtimeSceneId,
    });
  }

  const extras = propSources
    ? {
        bindingValues: collectBindingValuesForInstance(
          propSources.bindings,
          propSources.variables,
          propSources.authoringSceneId,
          instanceNode,
        ),
        trackValues: propSources.trackValuesByInstance.get(instanceId),
      }
    : undefined;
  const resolvedProps = resolveComponentPropValues(
    component,
    instanceNode.payload,
    extras,
  );
  const wrapperId = `${instanceId}__instance`;
  const processedInternals = applyComponentPropForwards(
    component,
    component.layers,
    resolvedProps,
  );

  const propClips: JsonRecord[] = [];
  const expandedInternals: V1.LayerV1[] = [];
  for (const internal of processedInternals) {
    if (internal.type === "component") {
      const nestedInstanceId = `${instanceId}__${internal.id}`;
      const nestedParentId =
        internal.parentLayerId === null || internal.parentLayerId === undefined
          ? wrapperId
          : `${instanceId}__${internal.parentLayerId}`;
      const nested = expandOneComponentInstance(
        internal,
        nestedInstanceId,
        nestedParentId,
        components,
        null,
        null, // nested instances are not scene-level; skip global bindings
        null,
      );
      const nestedWrapper = nested.layers.find((n) => n.id === nested.wrapperId);
      if (nestedWrapper && nestedWrapper.type === "group") {
        nestedWrapper.parentLayerId = nestedParentId;
      }
      expandedInternals.push(...nested.layers);
      propClips.push(...nested.propClips);
      continue;
    }

    const cloned = clone(internal) as V1.LayerV1;
    cloned.id = `${instanceId}__${internal.id}`;
    cloned.parentLayerId =
      internal.parentLayerId === null || internal.parentLayerId === undefined
        ? wrapperId
        : `${instanceId}__${internal.parentLayerId}`;
    for (const binding of component.propBindings) {
      if (
        binding.target.kind !== "layerProperty" ||
        binding.target.layerId !== internal.id ||
        !(binding.propId in resolvedProps)
      ) {
        continue;
      }
      const value = resolvedProps[binding.propId];
      if (isKeyframesPropValue(value)) {
        const prop = component.props.find((p) => p.id === binding.propId);
        propClips.push(
          buildPropKeyframeClip(
            instanceId,
            binding.propId,
            binding.target,
            value,
            prop?.kind ?? "number",
          ),
        );
        // Apply first key value as initial static so frame 0 is defined.
        const first = value.keys[0];
        if (first) {
          setPropertyPath(
            cloned as unknown as Record<string, unknown>,
            binding.target.property,
            first.value,
          );
        }
      } else {
        setPropertyPath(
          cloned as unknown as Record<string, unknown>,
          binding.target.property,
          value,
        );
      }
    }
    expandedInternals.push(cloned);
  }

  const wrapper = {
    id: wrapperId,
    type: "group" as const,
    parentLayerId,
    transform: clone(instanceNode.transform),
    visible: instanceNode.visible,
    payload: { compositing: { mode: "pass-through" as const } },
    ...(instanceNode.name ? { name: instanceNode.name } : {}),
    ...(instanceNode.zIndex !== undefined ? { zIndex: instanceNode.zIndex } : {}),
    ...(instanceNode.timing ? { timing: clone(instanceNode.timing) } : {}),
    ...(instanceNode.semantic ? { semantic: clone(instanceNode.semantic) } : {}),
    ...(instanceNode.effects ? { effects: clone(instanceNode.effects) } : {}),
    ...(instanceNode.blendMode ? { blendMode: instanceNode.blendMode } : {}),
    ...(instanceNode.mask ? { mask: clone(instanceNode.mask) } : {}),
    ...(instanceNode.inheritFlags
      ? { inheritFlags: clone(instanceNode.inheritFlags) }
      : {}),
    ...(instanceNode.modifiers ? { modifiers: clone(instanceNode.modifiers) } : {}),
  } as V1.LayerV1;

  return { layers: [wrapper, ...expandedInternals], wrapperId, propClips };
}

/**
 * Drop scene tracks that animate `payload.props.<propId>` — those become
 * prop sources and fan out at apply time, not leaf remaps.
 */
function stripPayloadPropTracks(clip: V1SceneClip): JsonRecord | null {
  const cloned = clone(clip) as JsonRecord;
  const source = cloned.source as
    | { kind: string; tracks?: Array<Record<string, unknown>> }
    | undefined;
  if (!source || source.kind !== "tracks" || !Array.isArray(source.tracks)) {
    return cloned;
  }
  const kept = source.tracks.filter((track) => {
    if (typeof track.property !== "string") return true;
    return !/^payload\.props\.(.+)$/.test(track.property);
  });
  if (kept.length === 0) return null;
  source.tracks = kept;
  return cloned;
}

/**
 * Expand `type: "component"` scene layers into a wrapper group plus the
 * component's internal layers, with deterministic ids:
 *   - wrapper:          `<componentLayerId>__instance`
 *   - internal node n:  `<componentLayerId>__<n.id>`
 * Prop sources merge (default → variant → payload → parent forward →
 * project binding → scene prop track), then apply via owner propBindings.
 */
function expandComponentLayersV1(
  layers: V1.LayerV1[],
  components: Map<string, V1.ComponentDefinitionV1>,
  runtimeSceneId: string,
  componentInstances: Map<string, ComponentInstanceRef>,
  propSources: ScenePropSources,
): {
  layers: V1.LayerV1[];
  wrapperByLayerId: Map<string, string>;
  propClips: JsonRecord[];
} {
  const out: V1.LayerV1[] = [];
  const wrapperByLayerId = new Map<string, string>();
  const propClips: JsonRecord[] = [];
  for (const node of layers) {
    if (node.type !== "component") {
      out.push(node);
      continue;
    }
    const expanded = expandOneComponentInstance(
      node,
      node.id,
      node.parentLayerId,
      components,
      runtimeSceneId,
      componentInstances,
      propSources,
    );
    wrapperByLayerId.set(node.id, expanded.wrapperId);
    out.push(...expanded.layers);
    propClips.push(...expanded.propClips);
  }
  return { layers: out, wrapperByLayerId, propClips };
}

/** Remap component-node ids to wrapper ids in a scene-local motion clip. */
function remapSceneClipTargets(
  clip: V1SceneClip,
  wrapperByLayerId: Map<string, string>,
): JsonRecord {
  const cloned = clone(clip) as JsonRecord;
  if (
    typeof cloned.layerId === "string" &&
    wrapperByLayerId.has(cloned.layerId)
  ) {
    cloned.layerId = wrapperByLayerId.get(cloned.layerId)!;
  }
  const source = cloned.source as
    | { kind: string; tracks?: Array<Record<string, unknown>> }
    | undefined;
  if (source && source.kind === "tracks" && Array.isArray(source.tracks)) {
    for (const track of source.tracks) {
      if (
        typeof track.layerId === "string" &&
        wrapperByLayerId.has(track.layerId)
      ) {
        track.layerId = wrapperByLayerId.get(track.layerId)!;
      }
    }
  }
  return cloned;
}

export function prepareRuntimeScene(
  scene: V1.SceneDefinitionV1,
  components: Map<string, V1.ComponentDefinitionV1>,
  componentInstances: Map<string, ComponentInstanceRef>,
  runtimeSceneId: string,
  propSourcesBase: Omit<ScenePropSources, "trackValuesByInstance">,
): JsonRecord {
  const propSources: ScenePropSources = {
    ...propSourcesBase,
    trackValuesByInstance: collectScenePropTrackSources(scene),
  };
  const {
    layers: expandedLayers,
    wrapperByLayerId,
    propClips,
  } = expandComponentLayersV1(
    scene.layers,
    components,
    runtimeSceneId,
    componentInstances,
    propSources,
  );
  const remappedClips = (scene.clips ?? [])
    .map((clip) => stripPayloadPropTracks(clip))
    .filter((clip): clip is JsonRecord => clip !== null)
    .map((clip) =>
      remapSceneClipTargets(clip as V1SceneClip, wrapperByLayerId),
    );
  const result: JsonRecord = {
    id: runtimeSceneId,
    duration: scene.duration,
    layers: expandedLayers.map((node) => {
      const prepared = prepareRuntimeLayer(node);
      // Remap mask sources that reference a component layer to its wrapper.
      const mask = (prepared as { mask?: { sourceLayerId?: string } }).mask;
      if (
        mask &&
        typeof mask.sourceLayerId === "string" &&
        wrapperByLayerId.has(mask.sourceLayerId)
      ) {
        mask.sourceLayerId = wrapperByLayerId.get(mask.sourceLayerId)!;
      }
      return prepared;
    }),
    clips: [...remappedClips, ...propClips],
  };
  if (scene.name) result.name = scene.name;
  if (scene.semantic) result.semantic = scene.semantic;
  if (scene.space) result.space = scene.space;
  if (scene.markers) result.markers = clone(scene.markers);
  if (scene.motionBlur) result.motionBlur = clone(scene.motionBlur);
  if (scene.drivers && scene.drivers.length > 0) {
    result.drivers = scene.drivers.map((driver) => {
      const cloned = clone(driver) as JsonRecord;
      if (
        typeof cloned.targetLayerId === "string" &&
        wrapperByLayerId.has(cloned.targetLayerId)
      ) {
        cloned.targetLayerId = wrapperByLayerId.get(cloned.targetLayerId)!;
      }
      if (
        typeof cloned.sourceLayerId === "string" &&
        wrapperByLayerId.has(cloned.sourceLayerId)
      ) {
        cloned.sourceLayerId = wrapperByLayerId.get(cloned.sourceLayerId)!;
      }
      return cloned;
    });
  }
  if (scene.activeCameraLayerId)
    result.activeCameraLayerId = scene.activeCameraLayerId;
  return result;
}
