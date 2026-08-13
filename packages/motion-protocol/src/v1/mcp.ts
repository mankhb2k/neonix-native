/**
 * V1 MCP Tool Contract — server-agnostic automation surface.
 *
 * Defines typed operation schemas (inputs) and result types (outputs) for
 * the 8 standard MCP-facing operations. Framework-agnostic — any MCP server,
 * HTTP handler, or CLI tool can implement against this contract.
 *
 * Design principles:
 *  1. All inputs accept only V1 authoring JSON (no V2 compat).
 *  2. All diagnostics use V1 source paths only.
 *  3. Every operation includes capability preflight.
 *  4. Results include canonical V1 project hash and runtime hash for
 *     deterministic reproducibility.
 *  5. No editor UI state is exposed — this is a pure document contract.
 */

import { z } from "zod";
import { CapabilityIdSchema } from "./capabilities";
import { CompositionSettingsSchema } from "./composition";
import { DesignTokensSchema } from "./variables";
import { ProjectMetadataV1Schema } from "./metadata";
import { MotionProjectV1Schema, type MotionProjectV1 } from "./project";
import { MotionProjectV1PatchSchema } from "./patch";
import { computeProjectHash, computeProjectHashShort } from "./canonical-hash";

// ── MCP format constants ──────────────────────────────────────────────

export const MOTION_MCP_PROTOCOL_VERSION = 1 as const;

// ── Common types ──────────────────────────────────────────────────────

export interface MCPCapabilityCheck {
  /** All capability IDs found in the project. */
  available: string[];
  /** Missing required capabilities that gate execution. */
  missing: string[];
  /** Optional capabilities that would enhance output. */
  recommended: string[];
  /** Experimental capabilities that require opt-in. */
  experimental: string[];
  /** Whether the operation can proceed (no missing required capabilities). */
  allowed: boolean;
}

export interface MCPBaseResult {
  /** Stable V1 project hash (excludes timestamps, provenance, extensions). */
  projectHash?: string;
  /** Short hash for display. */
  projectHashShort?: string;
  /** Warnings (non-fatal). */
  warnings: string[];
}

// ── create_project ────────────────────────────────────────────────────

export const MCPCreateProjectInputSchema = z
  .object({
    metadata: ProjectMetadataV1Schema,
    composition: CompositionSettingsSchema,
    tokens: DesignTokensSchema.optional(),
    capabilities: z.array(CapabilityIdSchema).max(256).optional(),
    skillId: z
      .string()
      .optional()
      .describe("Built-in skill to use as template"),
  })
  .strict();

export type MCPCreateProjectInput = z.infer<typeof MCPCreateProjectInputSchema>;

export interface MCPCreateProjectResult extends MCPBaseResult {
  project: MotionProjectV1;
  skillApplied?: string;
}

// ── validate_project ──────────────────────────────────────────────────

export const MCPValidateProjectInputSchema = z
  .object({
    project: MotionProjectV1Schema,
  })
  .strict();

export type MCPValidateProjectInput = z.infer<
  typeof MCPValidateProjectInputSchema
>;

export interface MCPValidateProjectResult extends MCPBaseResult {
  valid: boolean;
  diagnostics: Array<{
    path: string;
    message: string;
    severity: "error" | "warning";
  }>;
  capabilityCheck: MCPCapabilityCheck;
}

// ── apply_patch ───────────────────────────────────────────────────────

export const MCPApplyPatchInputSchema = z
  .object({
    project: MotionProjectV1Schema,
    patch: MotionProjectV1PatchSchema,
  })
  .strict();

export type MCPApplyPatchInput = z.infer<typeof MCPApplyPatchInputSchema>;

export interface MCPApplyPatchResult extends MCPBaseResult {
  project: MotionProjectV1 | null;
  applied: boolean;
  diagnostics: Array<{
    path: string;
    message: string;
    severity: "error" | "warning";
  }>;
}

// ── compile_project ───────────────────────────────────────────────────

export const MCPCompileProjectInputSchema = z
  .object({
    project: MotionProjectV1Schema,
    targetFps: z.number().int().positive().max(120).optional(),
    includeSourceRefs: z.boolean().default(true),
  })
  .strict();

export type MCPCompileProjectInput = z.infer<
  typeof MCPCompileProjectInputSchema
>;

export interface MCPCompileProjectResult extends MCPBaseResult {
  /** Runtime IR JSON (may be large — consider streaming). */
  runtimeProject: Record<string, unknown>;
  runtimeHash?: string;
  runtimeHashShort?: string;
  compilerVersion?: string;
  diagnostics: Array<{
    path: string;
    message: string;
    severity: "error" | "warning" | "info";
  }>;
}

// ── render_preview_frame ──────────────────────────────────────────────

export const MCPRenderPreviewFrameInputSchema = z
  .object({
    project: MotionProjectV1Schema,
    time: z.number().nonnegative().finite(),
    width: z.number().int().positive().max(4096).optional(),
    height: z.number().int().positive().max(4096).optional(),
    format: z.enum(["png", "jpeg"]).default("png"),
    quality: z.number().int().min(1).max(100).default(90),
  })
  .strict();

export type MCPRenderPreviewFrameInput = z.infer<
  typeof MCPRenderPreviewFrameInputSchema
>;

export interface MCPRenderPreviewFrameResult extends MCPBaseResult {
  /** Base64-encoded image data with data URI prefix. */
  imageDataUri: string;
  frameTime: number;
  width: number;
  height: number;
  format: "png" | "jpeg";
}

// ── list_capabilities ─────────────────────────────────────────────────

export const MCPListCapabilitiesInputSchema = z
  .object({
    /** Filter to capabilities matching this prefix (e.g. "primitive."). */
    filter: z.string().optional(),
    /** If true, include experimental capabilities. */
    includeExperimental: z.boolean().default(false),
  })
  .strict();

export type MCPListCapabilitiesInput = z.infer<
  typeof MCPListCapabilitiesInputSchema
>;

export interface MCPListCapabilitiesResult extends MCPBaseResult {
  capabilities: Array<{
    id: string;
    name: string;
    description?: string;
    category: string;
    experimental: boolean;
  }>;
  total: number;
}

// ── inspect_timeline ──────────────────────────────────────────────────

export const MCPInspectTimelineInputSchema = z
  .object({
    project: MotionProjectV1Schema,
    /** If provided, filter to specific track id. */
    trackId: z.string().optional(),
    /** If true, include full clip and scene detail. */
    verbose: z.boolean().default(false),
  })
  .strict();

export type MCPInspectTimelineInput = z.infer<
  typeof MCPInspectTimelineInputSchema
>;

export interface MCPInspectTimelineResult extends MCPBaseResult {
  totalDuration: number;
  trackCount: number;
  totalClipCount: number;
  tracks: Array<{
    id: string;
    order: number;
    clipCount: number;
    clips: Array<{
      id: string;
      source: { kind: string; refId: string };
      start: number;
      duration: number;
      opacity: number;
    }>;
  }>;
  audioTracks: Array<{
    id: string;
    order?: number;
    clipCount: number;
    clips: Array<{
      id: string;
      assetId: string;
      start: number;
      duration: number;
      volume: number;
      fadeIn: number;
      fadeOut: number;
    }>;
  }>;
  captionTracks: Array<{
    id: string;
    locale: string;
    tokenCount: number;
    firstToken?: string;
    lastToken?: string;
  }>;
}

// ── explain_diagnostics ───────────────────────────────────────────────

export const MCPExplainDiagnosticsInputSchema = z
  .object({
    /** Raw diagnostics from another MCP operation. */
    diagnostics: z.array(
      z
        .object({
          path: z.string(),
          message: z.string(),
          severity: z.enum(["error", "warning", "info"]),
        })
        .strict(),
    ),
    /** If true, include suggested fixes / patch operations. */
    suggestFixes: z.boolean().default(true),
    /** Context language for explanations (e.g. "vi", "en"). */
    locale: z.string().default("en"),
  })
  .strict();

export type MCPExplainDiagnosticsInput = z.infer<
  typeof MCPExplainDiagnosticsInputSchema
>;

export interface MCPExplainDiagnosticsResult extends MCPBaseResult {
  explanations: Array<{
    original: { path: string; message: string; severity: string };
    explanation: string;
    suggestedAction?: string;
    suggestedPatchOperation?: Record<string, unknown>;
  }>;
}

// ── Discriminated tool union ──────────────────────────────────────────

/** All 8 MCP tool operations as a discriminated union. */
export type MCPToolOperation =
  | {
      tool: "create_project";
      input: MCPCreateProjectInput;
    }
  | {
      tool: "validate_project";
      input: MCPValidateProjectInput;
    }
  | {
      tool: "apply_patch";
      input: MCPApplyPatchInput;
    }
  | {
      tool: "compile_project";
      input: MCPCompileProjectInput;
    }
  | {
      tool: "render_preview_frame";
      input: MCPRenderPreviewFrameInput;
    }
  | {
      tool: "list_capabilities";
      input: MCPListCapabilitiesInput;
    }
  | {
      tool: "inspect_timeline";
      input: MCPInspectTimelineInput;
    }
  | {
      tool: "explain_diagnostics";
      input: MCPExplainDiagnosticsInput;
    };

/** All 8 MCP tool results as a discriminated union. */
export type MCPToolResult =
  | {
      tool: "create_project";
      result: MCPCreateProjectResult;
    }
  | {
      tool: "validate_project";
      result: MCPValidateProjectResult;
    }
  | {
      tool: "apply_patch";
      result: MCPApplyPatchResult;
    }
  | {
      tool: "compile_project";
      result: MCPCompileProjectResult;
    }
  | {
      tool: "render_preview_frame";
      result: MCPRenderPreviewFrameResult;
    }
  | {
      tool: "list_capabilities";
      result: MCPListCapabilitiesResult;
    }
  | {
      tool: "inspect_timeline";
      result: MCPInspectTimelineResult;
    }
  | {
      tool: "explain_diagnostics";
      result: MCPExplainDiagnosticsResult;
    };

// ── Tool registry (runtime discovery) ─────────────────────────────────

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "project" | "compile" | "render" | "inspect";
  requiredCapabilities: string[];
}

/** Registry of all 8 MCP tools with metadata for runtime discovery. */
export const MCP_TOOLS: MCPToolDescriptor[] = [
  {
    name: "create_project",
    description:
      "Create a new MotionProject V1 from metadata, composition, and optional skill template",
    inputSchema: { $ref: "#/definitions/MCPCreateProjectInput" },
    category: "project",
    requiredCapabilities: [],
  },
  {
    name: "validate_project",
    description:
      "Validate a MotionProject V1 and return structured diagnostics with capability checks",
    inputSchema: { $ref: "#/definitions/MCPValidateProjectInput" },
    category: "project",
    requiredCapabilities: [],
  },
  {
    name: "apply_patch",
    description:
      "Apply a MotionProjectV1Patch to a project with re-validation and diagnostics",
    inputSchema: { $ref: "#/definitions/MCPApplyPatchInput" },
    category: "project",
    requiredCapabilities: [],
  },
  {
    name: "compile_project",
    description:
      "Compile a MotionProject V1 to runtime IR for rendering or export",
    inputSchema: { $ref: "#/definitions/MCPCompileProjectInput" },
    category: "compile",
    requiredCapabilities: [],
  },
  {
    name: "render_preview_frame",
    description:
      "Render a single preview frame at a given time as a base64-encoded image",
    inputSchema: { $ref: "#/definitions/MCPRenderPreviewFrameInput" },
    category: "render",
    requiredCapabilities: [],
  },
  {
    name: "list_capabilities",
    description:
      "List all known motion capabilities with descriptions and categories",
    inputSchema: { $ref: "#/definitions/MCPListCapabilitiesInput" },
    category: "inspect",
    requiredCapabilities: [],
  },
  {
    name: "inspect_timeline",
    description:
      "Inspect a project's timeline structure — tracks, clips, durations, transitions",
    inputSchema: { $ref: "#/definitions/MCPInspectTimelineInput" },
    category: "inspect",
    requiredCapabilities: [],
  },
  {
    name: "explain_diagnostics",
    description:
      "Explain validation/compile diagnostics in plain language with suggested fixes",
    inputSchema: { $ref: "#/definitions/MCPExplainDiagnosticsInput" },
    category: "inspect",
    requiredCapabilities: [],
  },
];

// ── Preflight helpers ─────────────────────────────────────────────────

/**
 * Run capability preflight on a project.
 *
 * Compares the project's required capabilities against a set of available
 * capability IDs (from the runtime environment).
 */
export function preflightCapabilities(
  project: MotionProjectV1,
  availableCapabilityIds: string[],
): MCPCapabilityCheck {
  const available = new Set(availableCapabilityIds);
  const required = new Set(project.capabilities.required);
  const optional = new Set(project.capabilities.optional ?? []);
  const experimental = new Set(project.capabilities.experimental ?? []);

  const missing = [...required].filter((id) => !available.has(id));
  const recommended = [...optional].filter((id) => !available.has(id));
  const exp = [...experimental].filter((id) => available.has(id));

  return {
    available: [...required].filter((id) => available.has(id)),
    missing,
    recommended,
    experimental: exp,
    allowed: missing.length === 0,
  };
}

/**
 * Check whether an MCP tool can execute against a project, given available
 * capabilities. Returns false if any tool-required capability is missing.
 */
export function canExecuteTool(
  toolName: string,
  project: MotionProjectV1,
  availableCapabilityIds: string[],
): { allowed: boolean; missing: string[] } {
  const descriptor = MCP_TOOLS.find((t) => t.name === toolName);
  if (!descriptor) return { allowed: false, missing: ["unknown_tool"] };

  const available = new Set(availableCapabilityIds);
  const toolReqs = new Set(descriptor.requiredCapabilities);
  const projectReqs = new Set(project.capabilities.required);

  const missing = [...toolReqs, ...projectReqs].filter(
    (id) => !available.has(id),
  );
  return { allowed: missing.length === 0, missing };
}

/**
 * Compute the project hash for MCP results, excluding non-deterministic
 * fields (timestamps, provenance, extensions).
 */
export function computeMCPProjectHash(project: MotionProjectV1): {
  projectHash: string;
  projectHashShort: string;
} {
  const projectHash = computeProjectHash(project);
  return {
    projectHash,
    projectHashShort: computeProjectHashShort(project),
  };
}

// ── Built-in capability catalog ───────────────────────────────────────

const KNOWN_CAPABILITIES: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  experimental: boolean;
}> = [
  {
    id: "projection.orthographic-2d",
    name: "Orthographic 2D",
    description: "Flat 2D coordinate system",
    category: "projection",
    experimental: false,
  },
  {
    id: "projection.layered-2.5d",
    name: "Layered 2.5D",
    description: "Layered rendering with depth sorting",
    category: "projection",
    experimental: false,
  },
  {
    id: "projection.perspective-3d",
    name: "Perspective 3D",
    description: "Full 3D perspective projection",
    category: "projection",
    experimental: true,
  },
  {
    id: "effect.blur",
    name: "Blur Effect",
    description: "Gaussian blur filter",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.shadow",
    name: "Drop Shadow",
    description: "Drop shadow effect",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.glow",
    name: "Glow Effect",
    description: "Outer glow effect",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.color-adjust",
    name: "Color Adjustment",
    description: "Brightness, contrast, saturation adjustment",
    category: "effect",
    experimental: false,
  },
  {
    id: "primitive.group",
    name: "Group",
    description: "Container node for grouping children",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.text",
    name: "Text",
    description: "Rich text with font, color, alignment",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.shape",
    name: "Shape",
    description: "Rectangle, ellipse, polygon primitives",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.image",
    name: "Image",
    description: "Raster image display",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.svg",
    name: "SVG",
    description: "Vector SVG rendering",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.video",
    name: "Video",
    description: "Video playback primitive",
    category: "primitive",
    experimental: false,
  },
  {
    id: "primitive.path",
    name: "Path",
    description: "Bézier path geometry",
    category: "primitive",
    experimental: false,
  },
  {
    id: "anim.transform",
    name: "Transform Animation",
    description: "Animate position, rotation, scale",
    category: "animation",
    experimental: false,
  },
  {
    id: "anim.opacity",
    name: "Opacity Animation",
    description: "Animate opacity/visibility",
    category: "animation",
    experimental: false,
  },
  {
    id: "style.gradient",
    name: "Gradient Fill",
    description: "Linear and radial gradients",
    category: "style",
    experimental: false,
  },
  {
    id: "style.blend",
    name: "Blend Mode",
    description: "Layer blending (multiply, screen, overlay, etc.)",
    category: "style",
    experimental: false,
  },
  {
    id: "camera.orthographic",
    name: "Orthographic Camera",
    description: "Orthographic camera with pan/zoom",
    category: "camera",
    experimental: false,
  },
  {
    id: "camera.parallax",
    name: "Parallax Camera",
    description: "Layered parallax scrolling camera",
    category: "camera",
    experimental: true,
  },
  {
    id: "audio.render-plan",
    name: "Audio Render Plan",
    description: "Mixed audio output with BGM, voiceover, SFX",
    category: "audio",
    experimental: false,
  },
];

/**
 * List capabilities, optionally filtered by prefix.
 */
export function listCapabilities(
  filter?: string,
  includeExperimental = false,
): MCPListCapabilitiesResult {
  let caps = KNOWN_CAPABILITIES;
  if (!includeExperimental) caps = caps.filter((c) => !c.experimental);
  if (filter) caps = caps.filter((c) => c.id.startsWith(filter));

  return {
    warnings: [],
    capabilities: caps.map((c) => ({ ...c })),
    total: caps.length,
  };
}

/**
 * Inspect a project timeline and return a structured summary.
 */
export function inspectTimeline(
  project: MotionProjectV1,
  trackId?: string,
): MCPInspectTimelineResult {
  const visualTracks = trackId
    ? project.timeline.visualTracks.filter((t) => t.id === trackId)
    : project.timeline.visualTracks;

  const tracks = visualTracks.map((track) => ({
    id: track.id,
    order: track.order,
    clipCount: track.clips.length,
    clips: track.clips.map((clip) => ({
      id: clip.id,
      source: {
        kind: clip.source.kind,
        refId: clip.source.sceneId,
      },
      start: clip.start,
      duration: clip.duration,
      opacity: clip.opacity,
    })),
  }));

  const audioTracks = project.timeline.audioTracks.map((track) => ({
    id: track.id,
    order: track.order,
    clipCount: track.clips.length,
    clips: track.clips.map((clip) => ({
      id: clip.id,
      assetId: clip.assetId,
      start: clip.start,
      duration: clip.duration,
      volume: clip.volume,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
    })),
  }));

  const captionTracks = project.timeline.captionTracks.map((track) => {
    const tokens = track.tokens;
    return {
      id: track.id,
      locale: track.locale,
      tokenCount: tokens.length,
      firstToken: tokens[0]?.text,
      lastToken: tokens[tokens.length - 1]?.text,
    };
  });

  const allClips = tracks.flatMap((t) => t.clips);
  const totalDuration = allClips.reduce(
    (max, clip) => Math.max(max, clip.start + clip.duration),
    0,
  );

  return {
    warnings: [],
    totalDuration,
    trackCount: tracks.length,
    totalClipCount: allClips.length,
    tracks,
    audioTracks,
    captionTracks,
  };
}

/**
 * Explain diagnostics in plain language with optional suggested fixes.
 */
export function explainDiagnostics(
  input: MCPExplainDiagnosticsInput,
): MCPExplainDiagnosticsResult {
  const explanations = input.diagnostics.map((diag) => {
    const { explanation, suggestedAction, suggestedPatch } =
      explainSingle(diag);
    return {
      original: {
        path: diag.path,
        message: diag.message,
        severity: diag.severity,
      },
      explanation,
      ...(suggestedAction ? { suggestedAction } : {}),
      ...(input.suggestFixes && suggestedPatch
        ? { suggestedPatchOperation: suggestedPatch }
        : {}),
    };
  });

  return { warnings: [], explanations };
}

function explainSingle(diag: {
  path: string;
  message: string;
  severity: string;
}): {
  explanation: string;
  suggestedAction?: string;
  suggestedPatch?: Record<string, unknown>;
} {
  // Unknown scene reference
  if (diag.message.includes("Unknown scene")) {
    return {
      explanation: `A visual clip or binding references a scene that doesn't exist in the project. This usually happens when a scene was removed but references to it weren't cleaned up.`,
      suggestedAction:
        "Remove clips or bindings referencing this scene, or add the missing scene definition.",
    };
  }

  // Missing required field
  if (diag.message.includes("Required")) {
    return {
      explanation: `A required field is missing at "${diag.path}". Every MotionProjectV1 document must include this field.`,
      suggestedAction: `Provide a value for the missing field at "${diag.path}".`,
    };
  }

  // Validation error (post-patch)
  if (diag.message.includes("Post-patch validation")) {
    return {
      explanation: `Applying the patch produced a project that doesn't pass V1 schema validation. The patch operations may have introduced invalid state (e.g., negative durations, missing required fields, orphaned references).`,
      suggestedAction:
        "Review the patch operations that modified the failing paths. Consider splitting the patch into smaller, incremental patches.",
    };
  }

  // Scene order / V2 leak
  if (diag.message.includes("sceneOrder")) {
    return {
      explanation: `The project contains 'sceneOrder', which is a V2 field. V1 uses 'visualTracks' with clips that reference scenes directly. This field should not appear in any V1 output.`,
      suggestedAction:
        "Remove the 'sceneOrder' field and ensure all scene ordering is expressed via 'timeline.visualTracks' clips.",
    };
  }

  // Scene transition / V2 leak — transitions are not V1 timeline primitives
  if (diag.message.includes("scene.transition") || diag.message.includes("transition")) {
    return {
      explanation: `Transition is not a V1 timeline primitive. Visual timing is an AE-style layer stack: active scene clips sorted by track.order. Express motion/effects as scene or component layer animation (opacity, transform, blend, mask), not transitionIn/Out fields.`,
      suggestedAction:
        "Remove transition fields. Place the effect as a component/layer inside a scene on a visual track with the desired order.",
    };
  }

  // formatVersion must be 3
  if (diag.message.includes("formatVersion") || diag.path.includes("formatVersion")) {
    return {
      explanation: `Authoring only accepts formatVersion 1 (V1 visualTracks, scene-only clips, no scene/clip transition primitives).`,
      suggestedAction:
        "Set formatVersion to 1 and use V1 conventions (visualTracks with scene sources, no scene.transition).",
    };
  }

  // Generic fallback
  return {
    explanation: `A "${diag.severity}" diagnostic occurred at "${diag.path}": ${diag.message}. This is a schema or reference integrity issue in the motion project.`,
    suggestedAction:
      "Check the path for invalid values, missing references, or type mismatches.",
  };
}
