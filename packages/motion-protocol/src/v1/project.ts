/**
 * V1 project root schema — leaf module (no barrel cycle).
 *
 * Extracted from v1/index.ts to break circular imports: mcp.ts, patch.ts,
 * parse.ts, and skills.ts import MotionProjectV1Schema from here instead
 * of from ./index, which re-exports those same modules.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { MOTION_PROJECT_V1_FORMAT_VERSION } from "./common";
import { ProjectMetadataV1Schema } from "./metadata";
import { CompositionSettingsSchema } from "./composition";
import { ProjectCapabilityRequirementsSchema } from "./capabilities";
import { ProjectDependenciesV1Schema } from "./components";
import {
  DesignTokensSchema,
  ProjectBindingV1Schema,
  ProjectVariableV1Schema,
} from "./variables";
import { AssetV1Schema } from "./assets";
import { ComponentDefinitionV1Schema } from "./components";
import { flattenLayerTree, LayerV1Schema, type LayerV1 } from "./layers";
import { collectAudioLayerTimingIssues } from "./layers/audio";
import { ProjectTimelineV1Schema } from "./timeline/schema";
import { collectFrameGridIssues } from "./timeline/frame-grid";
import type { MotionProjectV1 } from "./types";
import { NamespacedExtensionsSchema } from "./extensions";
import { ProjectProvenanceSchema } from "./provenance";

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

function collectRootLayerSchemaIssues(
  layers: LayerV1[],
  duration: number | undefined,
  ctx: z.RefinementCtx,
): void {
  const seenRootZ = new Map<number, string>();

  const walk = (
    nodes: LayerV1[],
    parentId: string | null,
    path: (string | number)[],
  ): void => {
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
        if (layer.zIndex === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Root layer "${layer.id}" requires zIndex`,
            path: [...layerPath, "zIndex"],
          });
        } else {
          const prev = seenRootZ.get(layer.zIndex);
          if (prev !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate root zIndex ${layer.zIndex} (also used by "${prev}")`,
              path: [...layerPath, "zIndex"],
            });
          } else {
            seenRootZ.set(layer.zIndex, layer.id);
          }
        }
        if (!layer.timing) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Root layer "${layer.id}" requires timing`,
            path: [...layerPath, "timing"],
          });
        } else if (
          duration !== undefined &&
          layer.timing.start + layer.timing.duration > duration + 1e-9
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Root layer "${layer.id}" ends at ${layer.timing.start + layer.timing.duration} beyond timeline.duration (${duration})`,
            path: [...layerPath, "timing"],
          });
        }
        if (layer.type === "audio") {
          if (layer.zIndex !== undefined && layer.zIndex >= 0) {
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
        } else if (layer.zIndex !== undefined && layer.zIndex < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Visual root layer "${layer.id}" must have zIndex >= 0`,
            path: [...layerPath, "zIndex"],
          });
        }
      } else if (layer.parentLayerId !== parentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Layer "${layer.id}" parentLayerId must be "${parentId}"`,
          path: [...layerPath, "parentLayerId"],
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
        walk(layer.children, layer.id, [...layerPath, "children"]);
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

  walk(layers, null, ["layers"]);
}

function makeMotionProjectV1ObjectSchema(): z.ZodType<MotionProjectV1> {
  return z
    .object({
      format: z.literal("motion-project"),
      formatVersion: z.literal(MOTION_PROJECT_V1_FORMAT_VERSION),
      metadata: ProjectMetadataV1Schema,
      composition: CompositionSettingsSchema,
      capabilities: ProjectCapabilityRequirementsSchema.default({}),
      dependencies: ProjectDependenciesV1Schema,
      tokens: DesignTokensSchema.default({}),
      variables: z
        .array(ProjectVariableV1Schema)
        .max(MOTION_PROTOCOL_LIMITS.variablesPerArtifact)
        .default([]),
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
      timeline: ProjectTimelineV1Schema,
      bindings: z
        .array(ProjectBindingV1Schema)
        .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
        .default([]),
      provenance: ProjectProvenanceSchema.optional(),
      extensions: NamespacedExtensionsSchema,
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
      project.variables.map((item) => item.id),
      ["variables"],
      "variable",
      ctx,
    );
    addDuplicateIdIssues(
      project.assets.map((item) => item.id),
      ["assets"],
      "asset",
      ctx,
    );
    addDuplicateIdIssues(
      project.bindings.map((item) => item.id),
      ["bindings"],
      "binding",
      ctx,
    );
    addDuplicateIdIssues(
      project.components.map((item) => item.id),
      ["components"],
      "component",
      ctx,
    );

    collectRootLayerSchemaIssues(
      project.layers,
      project.timeline.duration,
      ctx,
    );
  });

/**
 * Canonical motion project schema — `timeline.duration` is required.
 *
 * Authoring input may omit `duration`; export/save boundaries must use this
 * schema so the final MP4 length is always explicit.
 */
export const CanonicalMotionProjectV1Schema = MotionProjectV1Schema.superRefine(
  (project, ctx) => {
    if (project.timeline.duration === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeline", "duration"],
        message:
          "Canonical motion project requires an explicit timeline.duration",
      });
    }

    const fps = Math.max(1, project.composition.fps);
    for (const issue of collectFrameGridIssues(
      project.timeline,
      fps,
      project.layers,
    )) {
      const path = issue.path[0] === "layers" ? issue.path : ["timeline", ...issue.path];
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: issue.message,
      });
    }
  },
);

export type CanonicalMotionProjectV1 = MotionProjectV1 & {
  timeline: MotionProjectV1["timeline"] & { duration: number };
};
