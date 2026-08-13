/**
 * V3 capability requirements.
 *
 * IDs follow the dotted capability manifest used by motion-runtime
 * (e.g. `primitive.group`, `effect.blur`, `projection.perspective-3d`).
 * `required` capabilities gate hard errors at preflight; `optional` produce
 * warnings; `experimental` are blocked unless a feature flag opts in.
 *
 * Phase 11: extended with text.rich, video.trim, video.loop,
 * component.embedding, ai.patching, asset.external, caption.track,
 * and audio.export IDs. Timeline transitions are not capability primitives.
 */
import { z } from "zod";

const KNOWN_CAPABILITY_IDS = [
  // Projection spaces
  "projection.orthographic-2d",
  "projection.layered-2.5d",
  "projection.perspective-3d",
  // Effects
  "effect.blur",
  "effect.shadow",
  "effect.glow",
  "effect.color-adjust",
  // Primitives
  "primitive.group",
  "primitive.text",
  "primitive.shape",
  "primitive.image",
  "primitive.svg",
  "primitive.video",
  "primitive.path",
  // Text features
  "text.rich",
  // Video features
  "video.trim",
  "video.loop",
  // Animation
  "anim.transform",
  "anim.opacity",
  "anim.drivers",
  // Styling
  "style.gradient",
  "style.blend",
  // Camera
  "camera.orthographic",
  "camera.parallax",
  // Audio
  "audio.render-plan",
  "audio.export",
  // Composition features
  "component.embedding",
  // Integration
  "ai.patching",
  "asset.external",
  // Captions
  "caption.track",
] as const;

/** Capability manifest version used for fingerprinting. */
export const CAPABILITY_MANIFEST_VERSION_V3 = "v3.1" as const;

export const CapabilityIdSchema = z.union([
  z.enum(KNOWN_CAPABILITY_IDS),
  z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/, {
    message: "Capability IDs must be dotted lowercase identifiers",
  }),
]);

export type CapabilityId = z.infer<typeof CapabilityIdSchema>;

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

// ── Capability inspection (Phase 11) ──────────────────────────────────

/** Map of node type → required capability. */
const NODE_CAPABILITY: Record<string, string> = {
  text: "primitive.text",
  image: "primitive.image",
  svg: "primitive.svg",
  video: "primitive.video",
  shape: "primitive.shape",
  path: "primitive.path",
  group: "primitive.group",
  bone: "primitive.group",
  camera: "camera.orthographic",
  adjustment: "effect.color-adjust",
  solid: "primitive.shape",
};

/**
 * Inspect a V3 project and return the set of capabilities it actually
 * uses. This is derived from the project structure — node types, visual
 * clips, audio tracks, component references, etc.
 *
 * Timeline transitions are not protocol primitives (AE layer stack); do not
 * emit transition.* capabilities from visual clips.
 */
export function inspectProjectCapabilities(project: {
  scenes?: Array<{ layers?: Array<{ type: string }> }>;
  components?: Array<{ layers?: Array<{ type: string }> }>;
  timeline?: {
    visualTracks?: Array<{
      clips?: Array<{
        source?: { kind: string };
      }>;
    }>;
    audioTracks?: Array<{ clips?: unknown[] } | unknown>;
    captionTracks?: Array<unknown>;
  };
}): Set<string> {
  const caps = new Set<string>();

  // Scenes → node type capabilities
  for (const scene of project.scenes ?? []) {
    for (const node of scene.layers ?? []) {
      const cap = NODE_CAPABILITY[node.type];
      if (cap) caps.add(cap);
    }
  }

  // Components → node type capabilities + embedding
  if ((project.components ?? []).length > 0) {
    caps.add("component.embedding");
    for (const component of project.components ?? []) {
      for (const node of component.layers ?? []) {
        const cap = NODE_CAPABILITY[node.type];
        if (cap) caps.add(cap);
      }
    }
  }

  // Component layers in scenes also imply embedding.
  for (const scene of project.scenes ?? []) {
    if (scene.layers?.some((node) => node.type === "component")) {
      caps.add("component.embedding");
    }
  }

  // Audio tracks (volume/fade envelopes included in render-plan)
  if ((project.timeline?.audioTracks ?? []).length > 0) {
    caps.add("audio.render-plan");
  }

  // Caption tracks
  if ((project.timeline?.captionTracks ?? []).length > 0) {
    caps.add("caption.track");
  }

  return caps;
}

/**
 * Result of a capability preflight check.
 */
export interface CapabilityPreflightResult {
  /** Whether all required capabilities are covered. */
  ok: boolean;
  /** Capabilities actually used by the project. */
  used: string[];
  /** Declared required capabilities. */
  declared: string[];
  /** Used capabilities not declared in `required`. */
  undeclared: string[];
  /** Experimental capabilities in use. */
  experimentalInUse: string[];
  /** Missing required capabilities (declared but unavailable). */
  missing: string[];
}

/**
 * Run a capability preflight on a V3 project.
 *
 * Compares the capabilities actually used by the project against the
 * capabilities declared in `project.capabilities`. Returns structured
 * diagnostics instead of throwing.
 *
 * @param project       Parsed V3 project
 * @param _availableIds Available capability IDs in the current runtime (reserved)
 */
export function preflightProjectCapabilities(
  project: {
    capabilities?: ProjectCapabilityRequirements;
    scenes?: Array<{ layers?: Array<{ type: string }> }>;
    components?: Array<{ layers?: Array<{ type: string }> }>;
    timeline?: {
      visualTracks?: Array<{
        clips?: Array<{
          source?: { kind: string };
        }>;
      }>;
      audioTracks?: Array<unknown>;
      captionTracks?: Array<unknown>;
    };
  },
  _availableIds?: Set<string>,
): CapabilityPreflightResult {
  void _availableIds;
  const used = inspectProjectCapabilities(project);
  const required = new Set(project.capabilities?.required ?? []);
  const experimental = new Set(project.capabilities?.experimental ?? []);

  const usedArray = [...used].sort();
  const declaredArray = [...required].sort();
  const undeclared = usedArray.filter((id) => !required.has(id));
  const experimentalInUse = usedArray.filter((id) => experimental.has(id));
  const missing: string[] = [];

  return {
    ok: undeclared.length === 0 && experimentalInUse.length === 0,
    used: usedArray,
    declared: declaredArray,
    undeclared,
    experimentalInUse,
    missing,
  };
}
