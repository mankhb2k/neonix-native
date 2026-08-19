/**
 * Schema gốc project V1 — core render atoms only.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { MOTION_PROJECT_V1_FORMAT_VERSION } from "./common";
import { ProjectMetadataV1Schema } from "./metadata";
import { CompositionSettingsSchema } from "./composition";
import { AssetV1Schema } from "./assets";
import { ComponentDefinitionV1Schema } from "./components";
import { flattenLayerTree, LayerV1Schema, type LayerV1 } from "./layers";
import { collectAudioLayerTimingIssues } from "./layers/audio";
import { getLayerAnimations } from "./layers/animations";
import { collectFrameGridIssues } from "./layers/frame-grid";
import type { MotionProjectV1 } from "./types";

function addDuplicateIdIssues(
  ids: string[],
  path: (string | number)[],
  label: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ${label} id: "${id}"`,
        path,
      });
    }
    seen.add(id);
  }
}

function collectLayerSchemaIssues(
  layers: LayerV1[],
  ctx: z.RefinementCtx,
): void {
  const walk = (
    nodes: LayerV1[],
    parentId: string | null,
    parentTiming: LayerV1["timing"] | null,
    path: (string | number)[],
  ): void => {
    const seenZ = new Map<number, string>();
    for (const [index, layer] of nodes.entries()) {
      const layerPath = [...path, index];
      if (parentId === null) {
        if (layer.parentLayerId !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Root layer "${layer.id}" must have parentLayerId: null`,
            path: [...layerPath, "parentLayerId"],
          });
        }
      } else if (layer.parentLayerId !== parentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Layer "${layer.id}" parentLayerId must be "${parentId}"`,
          path: [...layerPath, "parentLayerId"],
        });
      }

      const prevZ = seenZ.get(layer.zIndex);
      if (prevZ !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate zIndex ${layer.zIndex} among siblings of parent ${parentId ?? "null"} (also used by "${prevZ}")`,
          path: [...layerPath, "zIndex"],
        });
      } else {
        seenZ.set(layer.zIndex, layer.id);
      }

      if (parentId === null) {
        if (layer.type === "audio") {
          if (layer.zIndex >= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Audio layer "${layer.id}" must have zIndex < 0`,
              path: [...layerPath, "zIndex"],
            });
          }
          for (const issue of collectAudioLayerTimingIssues(layer)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: issue.message,
              path: [...layerPath, ...issue.path],
            });
          }
        } else if (layer.zIndex < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Visual root layer "${layer.id}" must have zIndex >= 0`,
            path: [...layerPath, "zIndex"],
          });
        }
      } else if (
        parentTiming &&
        layer.timing.start + layer.timing.duration >
          parentTiming.duration + 1e-9
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Layer "${layer.id}" ends at ${layer.timing.start + layer.timing.duration} beyond parent duration (${parentTiming.duration})`,
          path: [...layerPath, "timing"],
        });
      }

      if (layer.type === "audio" && parentId !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Audio layer "${layer.id}" must be a project root`,
          path: [...layerPath, "parentLayerId"],
        });
      }

      if (layer.type === "group") {
        walk(layer.children, layer.id, layer.timing, [
          ...layerPath,
          "children",
        ]);
      } else if (
        "children" in layer &&
        Array.isArray((layer as { children?: unknown }).children) &&
        ((layer as { children: unknown[] }).children?.length ?? 0) > 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Layer "${layer.id}" of type "${layer.type}" cannot have children`,
          path: [...layerPath, "children"],
        });
      }
    }
  };

  walk(layers, null, null, ["layers"]);
}

function makeMotionProjectV1ObjectSchema(): z.ZodType<MotionProjectV1> {
  return z
    .object({
      format: z.literal("motion-project"),
      formatVersion: z.literal(MOTION_PROJECT_V1_FORMAT_VERSION),
      metadata: ProjectMetadataV1Schema,
      composition: CompositionSettingsSchema,
      assets: z
        .array(AssetV1Schema)
        .max(MOTION_PROTOCOL_LIMITS.assetsPerArtifact)
        .default([]),
      components: z
        .array(ComponentDefinitionV1Schema)
        .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
        .default([]),
      layers: z
        .array(LayerV1Schema)
        .max(MOTION_PROTOCOL_LIMITS.layersPerProject)
        .default([]),
    })
    .strict() as z.ZodType<MotionProjectV1>;
}

export type { MotionProjectV1 } from "./types";

export const MotionProjectV1Schema =
  makeMotionProjectV1ObjectSchema().superRefine((project, ctx) => {
    addDuplicateIdIssues(
      flattenLayerTree(project.layers).map((layer) => layer.id),
      ["layers"],
      "layer",
      ctx,
    );
    addDuplicateIdIssues(
      project.assets.map((item) => item.id),
      ["assets"],
      "asset",
      ctx,
    );
    addDuplicateIdIssues(
      project.components.map((item) => item.id),
      ["components"],
      "component",
      ctx,
    );
    const flattened = flattenLayerTree(project.layers);
    const animationCount = flattened.reduce(
      (sum, layer) => sum + getLayerAnimations(layer).length,
      0,
    );
    if (animationCount > MOTION_PROTOCOL_LIMITS.animationsPerProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Project has ${animationCount} layer animations; max is ${MOTION_PROTOCOL_LIMITS.animationsPerProject}`,
        path: ["layers"],
      });
    }

    collectLayerSchemaIssues(project.layers, ctx);
  });

export const CanonicalMotionProjectV1Schema = MotionProjectV1Schema.superRefine(
  (project, ctx) => {
    const fps = Math.max(1, project.composition.fps);
    for (const issue of collectFrameGridIssues(fps, project.layers)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: issue.path,
        message: issue.message,
      });
    }
  },
);

export type CanonicalMotionProjectV1 = MotionProjectV1;
