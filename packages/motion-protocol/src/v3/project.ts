/**
 * V3 project root schema — leaf module (no barrel cycle).
 *
 * Extracted from v3/index.ts to break circular imports: mcp.ts, patch.ts,
 * parse.ts, and skills.ts import MotionProjectV3Schema from here instead
 * of from ./index, which re-exports those same modules.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { MOTION_PROJECT_V3_FORMAT_VERSION } from "./common";
import { ProjectMetadataV3Schema } from "./metadata";
import { CompositionSettingsSchema } from "./composition";
import { ProjectCapabilityRequirementsSchema } from "./capabilities";
import { ProjectDependenciesV3Schema } from "./components";
import {
  DesignTokensSchema,
  ProjectBindingV3Schema,
  ProjectVariableV3Schema,
} from "./variables";
import { AssetV3Schema } from "./assets";
import { EmbeddedComponentV3Schema } from "./components";
import { SceneDefinitionV3Schema } from "./scenes";
import { ProjectTimelineV3Schema } from "./timeline/schema";
import { collectTimelineIntegrityIssues } from "./timeline/validation";
import { collectFrameGridIssues } from "./timeline/frame-grid";
import type { MotionProjectV3 } from "./types";
import { NamespacedExtensionsSchema } from "./extensions";
import { ProjectProvenanceSchema } from "./provenance";

function makeMotionProjectV3ObjectSchema(): z.ZodType<MotionProjectV3> {
  return z
    .object({
      format: z.literal("motion-project"),
      formatVersion: z.literal(MOTION_PROJECT_V3_FORMAT_VERSION),
      metadata: ProjectMetadataV3Schema,
      composition: CompositionSettingsSchema,
      capabilities: ProjectCapabilityRequirementsSchema.default({}),
      dependencies: ProjectDependenciesV3Schema,
      tokens: DesignTokensSchema.default({}),
      variables: z
        .array(ProjectVariableV3Schema)
        .max(MOTION_PROTOCOL_LIMITS.variablesPerArtifact)
        .default([]),
      assets: z
        .array(AssetV3Schema)
        .max(MOTION_PROTOCOL_LIMITS.assetsPerArtifact)
        .default([]),
      components: z
        .array(EmbeddedComponentV3Schema)
        .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
        .default([]),
      scenes: z
        .array(SceneDefinitionV3Schema)
        .max(MOTION_PROTOCOL_LIMITS.scenesPerProject)
        .default([]),
      timeline: ProjectTimelineV3Schema,
      bindings: z
        .array(ProjectBindingV3Schema)
        .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
        .default([]),
      provenance: ProjectProvenanceSchema.optional(),
      extensions: NamespacedExtensionsSchema,
    })
    .strict() as z.ZodType<MotionProjectV3>;
}

export type { MotionProjectV3 } from "./types";

export const MotionProjectV3Schema =
  makeMotionProjectV3ObjectSchema().superRefine((project, ctx) => {
    // ── Duplicate id checks (structural integrity) ──
    // Full cross-reference validation (scene refs, asset types, etc.) is
    // handled by `validateMotionProjectV3References()` in `parse.ts`.
    // These lightweight checks catch the most common mistakes at parse time.
    const seen = new Set<string>();

    // Scene ids
    for (const scene of project.scenes) {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate scene id: "${scene.id}"`,
          path: ["scenes"],
        });
      }
      seen.add(scene.id);
    }
    seen.clear();

    // Variable ids
    for (const v of project.variables) {
      if (seen.has(v.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable id: "${v.id}"`,
          path: ["variables"],
        });
      }
      seen.add(v.id);
    }
    seen.clear();

    // Asset ids
    for (const asset of project.assets) {
      if (seen.has(asset.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate asset id: "${asset.id}"`,
          path: ["assets"],
        });
      }
      seen.add(asset.id);
    }
    seen.clear();

    // Binding ids
    for (const binding of project.bindings) {
      if (seen.has(binding.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate binding id: "${binding.id}"`,
          path: ["bindings"],
        });
      }
      seen.add(binding.id);
    }
    seen.clear();

    // Component ids
    for (const component of project.components) {
      if (seen.has(component.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate component id: "${component.id}"`,
          path: ["components"],
        });
      }
      seen.add(component.id);
    }
    seen.clear();

    // Visual track ids
    for (const track of project.timeline.visualTracks) {
      if (seen.has(track.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate visual track id: "${track.id}"`,
          path: ["timeline", "visualTracks"],
        });
      }
      seen.add(track.id);
    }

    // Timeline integrity (duplicate clip ids, duplicate track order,
    // main-track overlap) — delegated to the shared validation helper.
    for (const issue of collectTimelineIntegrityIssues(project.timeline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: ["timeline", ...issue.path],
      });
    }
  });

/**
 * Canonical motion project schema — `timeline.duration` is required.
 *
 * Authoring input may omit `duration`; export/save boundaries must use this
 * schema so the final MP4 length is always explicit.
 */
export const CanonicalMotionProjectV3Schema = MotionProjectV3Schema.superRefine(
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
    for (const issue of collectFrameGridIssues(project.timeline, fps)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeline", ...issue.path],
        message: issue.message,
      });
    }
  },
);

export type CanonicalMotionProjectV3 = MotionProjectV3 & {
  timeline: MotionProjectV3["timeline"] & { duration: number };
};
