import { V1 } from "@motionvideo/motion-protocol";
import { isCompiledPreset } from "../preset-registry";
import type { DiagnosticCollector } from "../compile-result";
import type { JsonRecord } from "./helpers";

/**
 * Detect cycles in clip schedules (after/with chains).
 * Returns the ids of clips participating in a cycle.
 */
export function detectScheduleCycles(
  clips: Array<{ id: string; schedule: { kind: string; clipId?: string } }>,
): string[] {
  const graph = new Map<string, string[]>();
  for (const clip of clips) {
    const deps: string[] = [];
    if (
      (clip.schedule.kind === "after" || clip.schedule.kind === "with") &&
      clip.schedule.clipId
    ) {
      deps.push(clip.schedule.clipId);
    }
    graph.set(clip.id, deps);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];
  const dfs = (id: string): void => {
    if (visiting.has(id)) {
      cycles.push(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) {
      if (graph.has(dep)) dfs(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) dfs(id);
  return [...new Set(cycles)];
}

export function validateV1Semantics(
  project: V1.MotionProjectV1,
  collector: DiagnosticCollector,
): void {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const componentById = new Map(
    project.components.map((component) => [component.id, component] as const),
  );

  const layers = V1.flattenLayerTree(project.layers);
  const assetRefs: Array<{ layerId: string; assetId: string }> = [];
  for (const node of layers) {
    const payload =
      node.type === "audio" || "payload" in node
        ? ((node as { payload?: Record<string, unknown> }).payload ?? {})
        : {};
    if (
      (node.type === "image" ||
        node.type === "svg" ||
        node.type === "video") &&
      typeof payload.assetId === "string"
    ) {
      assetRefs.push({ layerId: node.id, assetId: payload.assetId });
    }
    if (node.type === "text" && node.payload.fontAssetId) {
      assetRefs.push({ layerId: node.id, assetId: node.payload.fontAssetId });
    }
    if (node.type === "audio") {
      assetRefs.push({ layerId: node.id, assetId: node.payload.assetId });
    }
    if (node.type === "component") {
      const component = componentById.get(node.payload.componentId);
      if (!component) {
        collector.error(
          "CMP_UNRESOLVED_COMPONENT",
          `Layer "${node.id}" references unknown component "${node.payload.componentId}"`,
          {
            path: ["layers", node.id],
            details: {
              layerId: node.id,
              componentId: node.payload.componentId,
            },
          },
        );
      } else if (
        node.payload.variantId &&
        !component.variants.some((v) => v.id === node.payload.variantId)
      ) {
        collector.error(
          "CMP_UNRESOLVED_COMPONENT_VARIANT",
          `Layer "${node.id}" references unknown variant "${node.payload.variantId}" on component "${component.id}"`,
          {
            path: ["layers", node.id],
            details: {
              layerId: node.id,
              componentId: component.id,
              variantId: node.payload.variantId,
            },
          },
        );
      }
    }
  }
  for (const ref of assetRefs) {
    if (!assetIds.has(ref.assetId)) {
      collector.error(
        "CMP_UNRESOLVED_ASSET",
        `Layer "${ref.layerId}" references unknown asset "${ref.assetId}"`,
        {
          path: ["layers", ref.layerId],
          details: {
            layerId: ref.layerId,
            assetId: ref.assetId,
          },
        },
      );
    }
  }

}
