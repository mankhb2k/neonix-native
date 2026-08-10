/**
 * V3 capability requirements.
 *
 * IDs follow the dotted capability manifest used by motion-runtime
 * (e.g. `primitive.group`, `effect.blur`, `projection.perspective-3d`).
 * `required` capabilities gate hard errors at preflight; `optional` produce
 * warnings; `experimental` are blocked unless a feature flag opts in.
 */
import { z } from "zod";

const KNOWN_CAPABILITY_IDS = [
  "projection.orthographic-2d",
  "projection.layered-2.5d",
  "projection.perspective-3d",
  "effect.blur",
  "effect.shadow",
  "effect.glow",
  "effect.color-adjust",
  "primitive.group",
  "primitive.text",
  "primitive.shape",
  "primitive.image",
  "primitive.svg",
  "primitive.video",
  "primitive.path",
  "anim.transform",
  "anim.opacity",
  "style.gradient",
  "style.blend",
  "camera.orthographic",
  "camera.parallax",
  "audio.render-plan",
] as const;

export const CapabilityIdSchema = z.union([
  z.enum(KNOWN_CAPABILITY_IDS),
  z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/, {
    message: "Capability IDs must be dotted lowercase identifiers",
  }),
]);

export const ProjectCapabilityRequirementsSchema = z
  .object({
    required: z.array(CapabilityIdSchema).max(256).default([]),
    optional: z.array(CapabilityIdSchema).max(256).optional(),
    experimental: z.array(CapabilityIdSchema).max(256).optional(),
  })
  .strict();

export type ProjectCapabilityRequirements = z.infer<
  typeof ProjectCapabilityRequirementsSchema
>;
