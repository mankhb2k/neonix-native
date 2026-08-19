/**
 * MCP V1 contract moved out of motion-protocol.
 *
 * This package owns automation/tooling-facing schemas and helpers.
 * motion-protocol stays focused on JSON schema, parse, validate.
 */

import { z } from "zod";
import {
  MotionProjectV1Schema,
  type MotionProjectV1,
  V1,
} from "@motionvideo/motion-protocol";
import { MotionProjectV1PatchSchema } from "./patch";
import {
  computeProjectHash,
  computeProjectHashShort,
} from "@motionvideo/render-contracts";

export const MOTION_MCP_PROTOCOL_VERSION = 1 as const;

export interface MCPCapabilityCheck {
  available: string[];
  missing: string[];
  recommended: string[];
  experimental: string[];
  allowed: boolean;
}

export interface MCPBaseResult {
  projectHash?: string;
  projectHashShort?: string;
  warnings: string[];
}

export const MCPCreateProjectInputSchema = z
  .object({
    metadata: V1.ProjectMetadataV1Schema,
    composition: V1.CompositionSettingsSchema,
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
  imageDataUri: string;
  frameTime: number;
  width: number;
  height: number;
  format: "png" | "jpeg";
}

export const MCPListCapabilitiesInputSchema = z
  .object({
    filter: z.string().optional(),
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

export const MCPInspectTimelineInputSchema = z
  .object({
    project: MotionProjectV1Schema,
    layerId: z.string().optional(),
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
    zIndex: number;
    start: number;
    duration: number;
  }>;
}

export const MCPExplainDiagnosticsInputSchema = z
  .object({
    diagnostics: z.array(
      z
        .object({
          path: z.string(),
          message: z.string(),
          severity: z.enum(["error", "warning", "info"]),
        })
        .strict(),
    ),
    suggestFixes: z.boolean().default(true),
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

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "project" | "compile" | "render" | "inspect";
  requiredCapabilities: string[];
}

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
      "Inspect a project's timeline - root layers, required zIndex lanes, required timings, property keyframes",
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

export function preflightCapabilities(
  _project: MotionProjectV1,
  _availableCapabilityIds: string[],
): MCPCapabilityCheck {
  return {
    available: [],
    missing: [],
    recommended: [],
    experimental: [],
    allowed: true,
  };
}

export function canExecuteTool(
  toolName: string,
  _project: MotionProjectV1,
  _availableCapabilityIds: string[],
): { allowed: boolean; missing: string[] } {
  const descriptor = MCP_TOOLS.find((tool) => tool.name === toolName);
  if (!descriptor) return { allowed: false, missing: ["unknown_tool"] };
  return { allowed: true, missing: [] };
}

export function computeMCPProjectHash(project: MotionProjectV1): {
  projectHash: string;
  projectHashShort: string;
} {
  const projectHash = computeProjectHash(
    project as unknown as Record<string, unknown>,
  );
  return {
    projectHash,
    projectHashShort: computeProjectHashShort(
      project as unknown as Record<string, unknown>,
    ),
  };
}

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
    description: "Isotropic content blur (radius only)",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.shadow",
    name: "Drop Shadow",
    description: "Outer drop shadow (offset, blur, color, opacity)",
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
    id: "effect.inner-glow",
    name: "Inner Glow Effect",
    description: "Inward glow along the layer silhouette",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.noise",
    name: "Noise Effect",
    description:
      "Grain overlay on the layer's opaque pixels - not a default full-screen grain",
    category: "effect",
    experimental: false,
  },
  {
    id: "effect.color-adjust",
    name: "Color Adjustment",
    description: "Brightness, contrast, saturation, hue-rotate adjustment",
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
    description: "One box, one string, one style",
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
    description: "Bezier path geometry",
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

export function listCapabilities(
  filter?: string,
  includeExperimental = false,
): MCPListCapabilitiesResult {
  let capabilities = KNOWN_CAPABILITIES;
  if (!includeExperimental) {
    capabilities = capabilities.filter(
      (capability) => !capability.experimental,
    );
  }
  if (filter) {
    capabilities = capabilities.filter((capability) =>
      capability.id.startsWith(filter),
    );
  }

  return {
    warnings: [],
    capabilities: capabilities.map((capability) => ({ ...capability })),
    total: capabilities.length,
  };
}

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
    start: layer.timing.start,
    duration: layer.timing.duration,
  }));

  const totalDuration = layers.reduce((max, layer) => {
    return Math.max(max, layer.start + layer.duration);
  }, 0);

  return {
    warnings: [],
    totalDuration,
    rootLayerCount: layers.length,
    layers,
  };
}

export function explainDiagnostics(
  input: MCPExplainDiagnosticsInput,
): MCPExplainDiagnosticsResult {
  const explanations = input.diagnostics.map((diagnostic) => {
    const { explanation, suggestedAction, suggestedPatch } =
      explainSingle(diagnostic);
    return {
      original: {
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
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

function explainSingle(diagnostic: {
  path: string;
  message: string;
  severity: string;
}): {
  explanation: string;
  suggestedAction?: string;
  suggestedPatch?: Record<string, unknown>;
} {
  if (diagnostic.message.includes("Unknown layer")) {
    return {
      explanation:
        "A binding or patch references a layer that doesn't exist in project.layers.",
      suggestedAction:
        "Remove the binding or add the missing layer to project.layers.",
    };
  }

  if (diagnostic.message.includes("Unknown scene")) {
    return {
      explanation:
        "V1 has no scenes. Visual content lives on project.layers (root zIndex is the timeline lane). The referenced id is not a layer in project.layers.",
      suggestedAction:
        "Use a layer id from project.layers, or add the missing layer.",
    };
  }

  if (diagnostic.message.includes("Required")) {
    return {
      explanation: `A required field is missing at "${diagnostic.path}". Every MotionProjectV1 document must include this field.`,
      suggestedAction: `Provide a value for the missing field at "${diagnostic.path}".`,
    };
  }

  if (diagnostic.message.includes("Post-patch validation")) {
    return {
      explanation:
        "Applying the patch produced a project that doesn't pass V1 schema validation. The patch operations may have introduced invalid state (e.g., negative durations, missing required fields, orphaned references).",
      suggestedAction:
        "Review the patch operations that modified the failing paths. Consider splitting the patch into smaller, incremental patches.",
    };
  }

  if (diagnostic.message.includes("sceneOrder")) {
    return {
      explanation:
        "The project contains 'sceneOrder', which is not a V1 field. V1 uses project.layers with unique root zIndex as timeline lanes.",
      suggestedAction:
        "Remove the 'sceneOrder' field and express ordering via root layer zIndex.",
    };
  }

  if (
    diagnostic.message.includes("scene.transition") ||
    diagnostic.message.includes("transition")
  ) {
    return {
      explanation:
        "Transition is not a V1 timeline primitive. Visual timing is a layer stack sorted by zIndex. Express motion/effects as layer or component animation (opacity, transform, blend, mask), not transitionIn/Out fields.",
      suggestedAction:
        "Remove transition fields. Express motion as layer transform/timing on project.layers.",
    };
  }

  if (
    diagnostic.message.includes("formatVersion") ||
    diagnostic.path.includes("formatVersion")
  ) {
    return {
      explanation:
        "Authoring only accepts formatVersion 1 (project.layers). V1 has no tracks in authoring/runtime animation.",
      suggestedAction:
        "Set formatVersion to 1 and use V1 conventions (root layers with type and zIndex).",
    };
  }

  return {
    explanation: `A "${diagnostic.severity}" diagnostic occurred at "${diagnostic.path}": ${diagnostic.message}. This is a schema or reference integrity issue in the motion project.`,
    suggestedAction:
      "Check the path for invalid values, missing references, or type mismatches.",
  };
}
