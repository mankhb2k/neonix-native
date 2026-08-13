import { V1 } from "@motionvideo/motion-protocol";
import type { DiagnosticCollector } from "../compile-result";
import { clone, type JsonRecord } from "./helpers";
import {
  prepareRuntimeLayerGraph,
  type ComponentInstanceRef,
} from "./components";

export type LayerPlan = {
  duration: number;
  graph: JsonRecord;
  componentInstances: Map<string, ComponentInstanceRef>;
  audioLayers: V1.AudioLayerV1[];
};

function flattenVisualLayers(layers: V1.LayerV1[]): V1.LayerV1[] {
  const out: V1.LayerV1[] = [];
  const walk = (nodes: V1.LayerV1[]): void => {
    for (const node of nodes) {
      if (node.type === "audio") continue;
      if (node.type === "group") {
        const { children, ...rest } = node;
        out.push({ ...rest, children: [] } as V1.GroupLayerV1);
        walk(children);
      } else {
        out.push(node);
      }
    }
  };
  walk(layers);
  return out;
}

/**
 * Build a compiler layer plan: one in-memory layer graph (internal compile
 * bridge) rooted at `root`, plus root audio layers.
 * Nested `group.children` flatten to parentLayerId.
 */
export function buildLayerPlan(
  project: V1.MotionProjectV1,
  collector: DiagnosticCollector,
): LayerPlan {
  void collector;
  const components = new Map(
    project.components.map((component) => [component.id, component] as const),
  );
  const projectVariables = new Map<string, unknown>(
    project.variables.map((v) => [v.id, clone(v.value)] as const),
  );
  const componentInstances = new Map<string, ComponentInstanceRef>();
  const visualLayers = flattenVisualLayers(project.layers);
  const audioLayers = project.layers.filter(
    (layer): layer is V1.AudioLayerV1 => layer.type === "audio",
  );
  const duration = project.timeline.duration ?? 0;

  const graph = prepareRuntimeLayerGraph(
    {
      id: "root",
      duration,
      layers: visualLayers,
    },
    components,
    componentInstances,
    "root",
    {
      bindings: project.bindings,
      variables: projectVariables,
    },
  );

  return { duration, graph, componentInstances, audioLayers };
}
