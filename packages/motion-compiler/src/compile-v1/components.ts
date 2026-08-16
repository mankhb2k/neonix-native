import { V1 } from "@motionvideo/motion-protocol";
import type { RuntimePropertyAnimation } from "@motionvideo/motion-protocol/runtime";
import {
  clone,
  setPropertyPath,
  type JsonRecord,
} from "./helpers";
import { prepareRuntimeLayer } from "./prepare";
import { componentPropKeyframesToPropertyAnimations } from "./to-property-animations";

export type ComponentInstanceRef = {
  componentLayerId: string;
  componentId: string;
  /** In-memory layer graph id (internal compile bridge). */
  runtimeGraphId: string;
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
    const childNode = V1.flattenLayerTree(component.layers).find(
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
  return resolved;
}

type LayerGraphPropSources = {
  bindings: V1.MotionProjectV1["bindings"];
  variables: Map<string, unknown>;
};

function collectBindingValuesForInstance(
  bindings: V1.MotionProjectV1["bindings"],
  variables: Map<string, unknown>,
  instance: V1.ComponentLayerV1,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const binding of bindings) {
    const target = binding.target;
    let propId: string | undefined;
    if (
      target.type === "prop" &&
      target.layerId === instance.id
    ) {
      propId = target.propId;
    }
    if (!propId || !variables.has(binding.source.variableId)) continue;
    out[propId] = variables.get(binding.source.variableId);
  }
  return out;
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

type ExpandComponentResult = {
  layers: V1.LayerV1[];
  wrapperId: string;
  propertyAnimations: RuntimePropertyAnimation[];
};

function expandOneComponentInstance(
  instanceNode: V1.ComponentLayerV1,
  instanceId: string,
  parentLayerId: string | null,
  components: Map<string, V1.ComponentDefinitionV1>,
  runtimeGraphId: string | null,
  componentInstances: Map<string, ComponentInstanceRef> | null,
  propSources: LayerGraphPropSources | null,
): ExpandComponentResult {
  const component = components.get(instanceNode.payload.componentId);
  if (!component) {
    return { layers: [instanceNode], wrapperId: instanceId, propertyAnimations: [] };
  }

  if (componentInstances && runtimeGraphId) {
    componentInstances.set(instanceId, {
      componentLayerId: instanceId,
      componentId: instanceNode.payload.componentId,
      runtimeGraphId,
    });
  }

  const extras = propSources
    ? {
        bindingValues: collectBindingValuesForInstance(
          propSources.bindings,
          propSources.variables,
          instanceNode,
        ),
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
    V1.flattenLayerTree(component.layers).map((node) =>
      node.type === "group" ? ({ ...node, children: [] } as V1.GroupLayerV1) : node,
    ),
    resolvedProps,
  );

  const propertyAnimations: RuntimePropertyAnimation[] = [];
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
        null, // nested instances are not graph-root-level; skip global bindings
        null,
      );
      const nestedWrapper = nested.layers.find((n) => n.id === nested.wrapperId);
      if (nestedWrapper && nestedWrapper.type === "group") {
        nestedWrapper.parentLayerId = nestedParentId;
      }
      expandedInternals.push(...nested.layers);
      propertyAnimations.push(...nested.propertyAnimations);
      continue;
    }

    const cloned = clone(internal) as V1.LayerV1;
    cloned.id = `${instanceId}__${internal.id}`;
    cloned.parentLayerId =
      internal.parentLayerId === null || internal.parentLayerId === undefined
        ? wrapperId
        : `${instanceId}__${internal.parentLayerId}`;
    if ("compositing" in cloned && cloned.compositing?.mask) {
      const sourceId = cloned.compositing.mask.sourceLayerId;
      const isInternal = processedInternals.some((node) => node.id === sourceId);
      if (isInternal) {
        cloned.compositing = {
          ...cloned.compositing,
          mask: {
            ...cloned.compositing.mask,
            sourceLayerId: `${instanceId}__${sourceId}`,
          },
        };
      }
    }
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
        propertyAnimations.push(
          componentPropKeyframesToPropertyAnimations({
            instanceId,
            internalLayerId: binding.target.layerId,
            property: binding.target.property,
            keys: value.keys,
            propKind: prop?.kind ?? "number",
          }),
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
    appearance: clone(instanceNode.appearance),
    ...(instanceNode.frame ? { frame: clone(instanceNode.frame) } : {}),
    ...(instanceNode.name ? { name: instanceNode.name } : {}),
    ...(instanceNode.zIndex !== undefined ? { zIndex: instanceNode.zIndex } : {}),
    ...(instanceNode.timing ? { timing: clone(instanceNode.timing) } : {}),
    ...(instanceNode.semantic ? { semantic: clone(instanceNode.semantic) } : {}),
    ...(instanceNode.effects ? { effects: clone(instanceNode.effects) } : {}),
    ...(instanceNode.compositing
      ? {
          compositing: (() => {
            const compositing = clone(instanceNode.compositing);
            const mask = compositing.mask;
            if (mask) {
              const isInternal = processedInternals.some(
                (node) => node.id === mask.sourceLayerId,
              );
              if (isInternal) {
                mask.sourceLayerId = `${instanceId}__${mask.sourceLayerId}`;
              }
            }
            return compositing;
          })(),
        }
      : {}),
    ...(instanceNode.inheritFlags
      ? { inheritFlags: clone(instanceNode.inheritFlags) }
      : {}),
  } as V1.LayerV1;

  return { layers: [wrapper, ...expandedInternals], wrapperId, propertyAnimations };
}

/**
 * Expand `type: "component"` layers into a wrapper group plus the
 * component's internal layers, with deterministic ids:
 *   - wrapper:          `<componentLayerId>__instance`
 *   - internal node n:  `<componentLayerId>__<n.id>`
 * Prop sources merge (default → variant → payload → parent forward →
 * project binding), then apply via owner propBindings.
 */
function expandComponentLayersV1(
  layers: V1.LayerV1[],
  components: Map<string, V1.ComponentDefinitionV1>,
  runtimeGraphId: string,
  componentInstances: Map<string, ComponentInstanceRef>,
  propSources: LayerGraphPropSources,
): {
  layers: V1.LayerV1[];
  wrapperByLayerId: Map<string, string>;
  propertyAnimations: RuntimePropertyAnimation[];
} {
  const out: V1.LayerV1[] = [];
  const wrapperByLayerId = new Map<string, string>();
  const propertyAnimations: RuntimePropertyAnimation[] = [];
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
      runtimeGraphId,
      componentInstances,
      propSources,
    );
    wrapperByLayerId.set(node.id, expanded.wrapperId);
    out.push(...expanded.layers);
    propertyAnimations.push(...expanded.propertyAnimations);
  }
  return { layers: out, wrapperByLayerId, propertyAnimations };
}

/**
 * Build an in-memory layer graph (internal compile bridge) from authoring
 * layers with component expansion applied.
 */
export function prepareRuntimeLayerGraph(
  graph: {
    id: string;
    duration: number;
    layers: V1.LayerV1[];
    name?: string;
  },
  components: Map<string, V1.ComponentDefinitionV1>,
  componentInstances: Map<string, ComponentInstanceRef>,
  runtimeGraphId: string,
  propSourcesBase: LayerGraphPropSources,
): JsonRecord {
  const {
    layers: expandedLayers,
    wrapperByLayerId,
    propertyAnimations,
  } = expandComponentLayersV1(
    graph.layers.filter((layer) => layer.type !== "audio"),
    components,
    runtimeGraphId,
    componentInstances,
    propSourcesBase,
  );
  const result: JsonRecord = {
    id: runtimeGraphId,
    duration: graph.duration,
    layers: expandedLayers
      .filter((node) => node.type !== "audio")
      .map((node) => {
      const prepared = prepareRuntimeLayer(node);
      const compositing = (
        prepared as {
          compositing?: { mask?: { sourceLayerId?: string } };
        }
      ).compositing;
      const mask = compositing?.mask;
      if (
        mask &&
        typeof mask.sourceLayerId === "string" &&
        wrapperByLayerId.has(mask.sourceLayerId)
      ) {
        mask.sourceLayerId = wrapperByLayerId.get(mask.sourceLayerId)!;
      }
      return prepared;
    }),
    propertyAnimations,
  };
  if (graph.name) result.name = graph.name;
  return result;
}
