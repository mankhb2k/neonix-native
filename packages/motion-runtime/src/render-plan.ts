import { MOTION_V2_LIMITS } from "@motionvideo/motion-schema";
import type { EvaluatedNode, RuntimeScene, RuntimeNode } from "./evaluator";
import type { Bounds2D } from "./spatial";

export type IsolationMode = "pass-through" | "isolate";

export type RenderPass = {
  id: string;
  nodeId: string;
  type: RuntimeNode["type"];
  zIndex: number;
  isolation: IsolationMode;
  bounds: Bounds2D;
  worldOpacity: number;
  visible: boolean;
  needsOffscreen: boolean;
  mask?: {
    sourceNodeId: string;
    mode: "clip" | "alpha" | "inverse-alpha" | "luma" | "inverse-luma";
    sourceVisibility: "mask-only" | "content-and-mask";
  };
  effects: NonNullable<RuntimeNode["effects"]>;
  /** Always false until R5 AdjustmentNode ships. */
  isAdjustment: boolean;
};

export type RenderPlanDiagnostic = {
  kind: "budget_exceeded" | "cycle_detected" | "invalid_isolation";
  message: string;
  allocatedPixels?: number;
};

export type RenderPlan = {
  sceneId: string;
  passes: RenderPass[];
  totalAllocatedPixels: number;
  diagnostics: RenderPlanDiagnostic[];
};

export function inflateBoundsForEffects(bounds: Bounds2D, effects: NonNullable<RuntimeNode["effects"]>): Bounds2D {
  let inflation = 0;
  for (const effect of effects) {
    if (effect.type === "blur") inflation += effect.radius;
    if (effect.type === "shadow") inflation += effect.blur + Math.abs(effect.offsetX) + Math.abs(effect.offsetY);
    if (effect.type === "glow") inflation += effect.radius * effect.intensity;
  }
  if (inflation === 0) return bounds;
  return {
    x: bounds.x - inflation,
    y: bounds.y - inflation,
    width: bounds.width + inflation * 2,
    height: bounds.height + inflation * 2,
  };
}

export function buildRenderPlan(scene: RuntimeScene, evaluatedNodes: EvaluatedNode[]): RenderPlan {
  const diagnostics: RenderPlanDiagnostic[] = [];
  let totalAllocatedPixels = 0;

  const nodeMap = new Map(evaluatedNodes.map((item) => [item.node.id, item]));
  const sorted = evaluatedNodes.slice().sort((a, b) => (a.node.zIndex ?? 0) - (b.node.zIndex ?? 0));

  const passes: RenderPass[] = [];

  for (const evaluated of sorted) {
    const node = evaluated.node;
    if (!evaluated.visible) continue;

    const effects = node.effects ?? [];
    const inflatedBounds = inflateBoundsForEffects(evaluated.worldBounds, effects);
    // R5: AdjustmentNode isolation — deferred until schema ships
    const needsOffscreen = Boolean(node.mask) || effects.length > 0;
    const isolation: IsolationMode = needsOffscreen ? "isolate" : "pass-through";

    if (needsOffscreen) {
      const area = Math.ceil(inflatedBounds.width) * Math.ceil(inflatedBounds.height);
      totalAllocatedPixels += area;
      if (totalAllocatedPixels > MOTION_V2_LIMITS.offscreenPixels) {
        diagnostics.push({
          kind: "budget_exceeded",
          message: `Offscreen pixel budget exceeded: ${totalAllocatedPixels} > ${MOTION_V2_LIMITS.offscreenPixels}`,
          allocatedPixels: totalAllocatedPixels,
        });
      }
    }

    passes.push({
      id: `pass_${node.id}`,
      nodeId: node.id,
      type: node.type,
      zIndex: node.zIndex ?? 0,
      isolation,
      bounds: inflatedBounds,
      worldOpacity: evaluated.worldOpacity,
      visible: evaluated.visible,
      needsOffscreen,
      mask: node.mask,
      effects,
      isAdjustment: false,
    });
  }

  return {
    sceneId: scene.id,
    passes,
    totalAllocatedPixels,
    diagnostics,
  };
}
