import { MOTION_PROTOCOL_LIMITS } from "@motionvideo/motion-protocol";
import type { EvaluatedNode, RuntimeScene, RuntimeNode } from "./evaluator";
import type { Bounds2D } from "./spatial";
import { calculateMotionBlurTimestamps, type MotionBlurSettings } from "./motion-blur";
import {
  hierarchyRenderOrder,
  type OrderableNode,
} from "./composition/render-order";

export type IsolationMode = "pass-through" | "isolate";

export type RenderPass = {
  id: string;
  layerId: string;
  type: RuntimeNode["type"];
  zIndex: number;
  isolation: IsolationMode;
  bounds: Bounds2D;
  worldOpacity: number;
  visible: boolean;
  needsOffscreen: boolean;
  mask?: {
    sourceLayerId: string;
    mode: "clip" | "alpha" | "inverse-alpha" | "luma" | "inverse-luma";
    sourceVisibility: "mask-only" | "content-and-mask";
  };
  effects: NonNullable<RuntimeNode["effects"]>;
  isAdjustment: boolean;
  groupCompositing?: IsolationMode;
};

export type RenderPlanDiagnostic = {
  kind: "budget_exceeded" | "cycle_detected" | "invalid_isolation";
  message: string;
  allocatedPixels?: number;
};

export type RenderPlan = {
  graphId: string;
  passes: RenderPass[];
  totalAllocatedPixels: number;
  diagnostics: RenderPlanDiagnostic[];
  motionBlur?: MotionBlurSettings & { sampleTimes: number[] };
};

export function inflateBoundsForEffects(bounds: Bounds2D, effects: NonNullable<RuntimeNode["effects"]>): Bounds2D {
  let inflation = 0;
  for (const effect of effects) {
    if (effect.type === "blur") inflation += effect.radius;
    if (effect.type === "shadow") inflation += effect.blur + Math.abs(effect.offset.x) + Math.abs(effect.offset.y);
    if (effect.type === "glow")
      inflation += effect.radius * (effect.opacity / 100);
  }
  if (inflation === 0) return bounds;
  return {
    x: bounds.x - inflation,
    y: bounds.y - inflation,
    width: bounds.width + inflation * 2,
    height: bounds.height + inflation * 2,
  };
}

export function buildRenderPlan(
  scene: RuntimeScene,
  evaluatedNodes: EvaluatedNode[],
  options: { time?: number; fps?: number } = {},
): RenderPlan {
  const diagnostics: RenderPlanDiagnostic[] = [];
  let totalAllocatedPixels = 0;

  const sorted = hierarchyRenderOrder(evaluatedNodes as OrderableNode[]) as EvaluatedNode[];

  const passes: RenderPass[] = [];

  for (const evaluated of sorted) {
    const node = evaluated.layer;
    if (!evaluated.visible) continue;

    const effects = node.effects ?? [];
    const inflatedBounds = inflateBoundsForEffects(evaluated.worldBounds, effects);
    const isAdjustment = node.type === "adjustment";
    const compositingIsolation =
      node.compositing?.isolation === "isolate" ? "isolate" : "pass-through";
    const needsOffscreen =
      Boolean(node.compositing?.mask) ||
      effects.length > 0 ||
      isAdjustment ||
      compositingIsolation === "isolate";
    const isolation: IsolationMode =
      needsOffscreen || compositingIsolation === "isolate"
        ? "isolate"
        : "pass-through";

    if (needsOffscreen) {
      const area = Math.ceil(inflatedBounds.width) * Math.ceil(inflatedBounds.height);
      totalAllocatedPixels += area;
      if (totalAllocatedPixels > MOTION_PROTOCOL_LIMITS.offscreenPixels) {
        diagnostics.push({
          kind: "budget_exceeded",
          message: `Offscreen pixel budget exceeded: ${totalAllocatedPixels} > ${MOTION_PROTOCOL_LIMITS.offscreenPixels}`,
          allocatedPixels: totalAllocatedPixels,
        });
      }
    }

    passes.push({
      id: `pass_${node.id}`,
      layerId: node.id,
      type: node.type,
      zIndex: node.zIndex ?? 0,
      isolation,
      bounds: inflatedBounds,
      worldOpacity: evaluated.worldOpacity,
      visible: evaluated.visible,
      needsOffscreen,
      mask: node.compositing?.mask
        ? {
            sourceLayerId: node.compositing.mask.sourceLayerId,
            mode: node.compositing.mask.mode,
            sourceVisibility: node.compositing.mask["source-visibility"],
          }
        : undefined,
      effects,
      isAdjustment,
      ...(node.type === "group"
        ? { groupCompositing: compositingIsolation }
        : {}),
    });
  }

  const motionBlurConfig = scene.motionBlur;
  const motionBlur =
    motionBlurConfig && options.time !== undefined && options.fps !== undefined
      ? {
          enabled: motionBlurConfig.enabled,
          shutterAngle: motionBlurConfig.shutterAngle ?? 180,
          sampleCount: motionBlurConfig.sampleCount ?? 4,
          sampleTimes: calculateMotionBlurTimestamps(options.time, options.fps, {
            enabled: motionBlurConfig.enabled,
            shutterAngle: motionBlurConfig.shutterAngle ?? 180,
            sampleCount: motionBlurConfig.sampleCount ?? 4,
          }),
        }
      : undefined;

  return {
    graphId: scene.id,
    passes,
    totalAllocatedPixels,
    diagnostics,
    ...(motionBlur ? { motionBlur } : {}),
  };
}
