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
    /** If provided, filter to a specific root layer id. */
    layerId: z.string().optional(),
    /** If true, include full layer timing and animation detail. */
    verbose: z.boolean().default(false),
  })
  .strict();

export type MCPInspectTimelineInput = z.infer<
  typeof MCPInspectTimelineInputSchema
>;

export interface MCPInspectTimelineResult extends MCPBaseResult {
  totalDuration: number;
  rootLayerCount: number;
  layers: Array<{
    id: string;
    type: string;
    zIndex: number | undefined;
    start?: number;
    duration?: number;
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
      "Inspect a project's timeline — root layers, zIndex lanes, timings, markers",
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
    description: "Group layer that nests children",
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
    description: "Root audio layers (BGM, voiceover, SFX)",
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
  layerId?: string,
): MCPInspectTimelineResult {
  const roots = layerId
    ? project.layers.filter((layer) => layer.id === layerId)
    : project.layers;

  const layers = roots.map((layer) => ({
    id: layer.id,
    type: layer.type,
    zIndex: layer.zIndex,
    start: layer.timing?.start,
    duration: layer.timing?.duration,
  }));

  const totalDuration = layers.reduce((max, layer) => {
    if (layer.start === undefined || layer.duration === undefined) return max;
    return Math.max(max, layer.start + layer.duration);
  }, 0);

  return {
    warnings: [],
    totalDuration,
    rootLayerCount: layers.length,
    layers,
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
  // Unknown layer reference
  if (diag.message.includes("Unknown layer")) {
    return {
      explanation: `A binding or patch references a layer that doesn't exist in project.layers.`,
      suggestedAction:
        "Remove the binding or add the missing layer to project.layers.",
    };
  }

  // Legacy "Unknown scene" — V1 has no scenes; explain via project.layers
  if (diag.message.includes("Unknown scene")) {
    return {
      explanation: `V1 has no scenes. Visual content lives on project.layers (root zIndex is the timeline lane). The referenced id is not a layer in project.layers.`,
      suggestedAction:
        "Use a layer id from project.layers, or add the missing layer.",
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

  // sceneOrder / legacy leak
  if (diag.message.includes("sceneOrder")) {
    return {
      explanation: `The project contains 'sceneOrder', which is not a V1 field. V1 uses project.layers with unique root zIndex as timeline lanes.`,
      suggestedAction:
        "Remove the 'sceneOrder' field and express ordering via root layer zIndex.",
    };
  }

  // Transition / legacy leak — transitions are not V1 timeline primitives
  if (diag.message.includes("scene.transition") || diag.message.includes("transition")) {
    return {
      explanation: `Transition is not a V1 timeline primitive. Visual timing is a layer stack sorted by zIndex. Express motion/effects as layer or component animation (opacity, transform, blend, mask), not transitionIn/Out fields.`,
      suggestedAction:
        "Remove transition fields. Express motion as layer transform/timing on project.layers.",
    };
  }

  // formatVersion must be 1
  if (diag.message.includes("formatVersion") || diag.path.includes("formatVersion")) {
    return {
      explanation: `Authoring only accepts formatVersion 1 (project.layers, no scenes or timeline tracks).`,
      suggestedAction:
        "Set formatVersion to 1 and use V1 conventions (root layers with type and zIndex).",
    };
  }

  // Generic fallback
  return {
    explanation: `A "${diag.severity}" diagnostic occurred at "${diag.path}": ${diag.message}. This is a schema or reference integrity issue in the motion project.`,
    suggestedAction:
      "Check the path for invalid values, missing references, or type mismatches.",
  };
}
