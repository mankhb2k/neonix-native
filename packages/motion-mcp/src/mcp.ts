import { z } from "zod";
import {
  MotionProtocolV2Schema,
  V2CompositionSchema,
  V2AssetListSchema,
  V2AudioDomainSchema,
  V2IdSchema,
  V2LayerSchema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import { computeProjectHash, computeProjectHashShort } from "@motionvideo/render-contracts";
import { MotionProtocolV2PatchSchema } from "./patch";

export const MOTION_MCP_PROTOCOL_VERSION = 2 as const;

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

export const MCPCreateProjectInputSchema = z.object({
  id: V2IdSchema,
  composition: V2CompositionSchema,
  assets: V2AssetListSchema.default([]),
  layers: z.array(V2LayerSchema).default([]),
  audio: V2AudioDomainSchema.default({ sampleRate: 48000, tracks: [] }),
  skillId: z.string().optional(),
}).strict();
export type MCPCreateProjectInput = z.infer<typeof MCPCreateProjectInputSchema>;

export interface MCPCreateProjectResult extends MCPBaseResult {
  project: MotionProtocolV2;
  skillApplied?: string;
}

export const MCPValidateProjectInputSchema = z.object({ project: MotionProtocolV2Schema }).strict();
export type MCPValidateProjectInput = z.infer<typeof MCPValidateProjectInputSchema>;

export interface MCPValidateProjectResult extends MCPBaseResult {
  valid: boolean;
  diagnostics: Array<{ path: string; message: string; severity: "error" | "warning" }>;
  capabilityCheck: MCPCapabilityCheck;
}

export const MCPApplyPatchInputSchema = z.object({
  project: MotionProtocolV2Schema,
  patch: MotionProtocolV2PatchSchema,
}).strict();
export type MCPApplyPatchInput = z.infer<typeof MCPApplyPatchInputSchema>;

export interface MCPApplyPatchResult extends MCPBaseResult {
  project: MotionProtocolV2 | null;
  applied: boolean;
  diagnostics: Array<{ path: string; message: string; severity: "error" | "warning" }>;
}

export const MCPCompileProjectInputSchema = z.object({
  project: MotionProtocolV2Schema,
  targetFps: z.number().int().positive().max(120).optional(),
  includeSourceRefs: z.boolean().default(true),
}).strict();
export type MCPCompileProjectInput = z.infer<typeof MCPCompileProjectInputSchema>;

export interface MCPCompileProjectResult extends MCPBaseResult {
  runtimeProject: Record<string, unknown>;
  runtimeHash?: string;
  runtimeHashShort?: string;
  compilerVersion?: string;
  diagnostics: Array<{ path: string; message: string; severity: "error" | "warning" | "info" }>;
}

export const MCPRenderPreviewFrameInputSchema = z.object({
  project: MotionProtocolV2Schema,
  time: z.number().nonnegative().finite(),
  width: z.number().int().positive().max(4096).optional(),
  height: z.number().int().positive().max(4096).optional(),
  format: z.enum(["png", "jpeg"]).default("png"),
  quality: z.number().int().min(1).max(100).default(90),
}).strict();
export type MCPRenderPreviewFrameInput = z.infer<typeof MCPRenderPreviewFrameInputSchema>;

export interface MCPRenderPreviewFrameResult extends MCPBaseResult {
  imageDataUri: string;
  frameTime: number;
  width: number;
  height: number;
  format: "png" | "jpeg";
}

export const MCPListCapabilitiesInputSchema = z.object({
  filter: z.string().optional(),
  includeExperimental: z.boolean().default(false),
}).strict();
export type MCPListCapabilitiesInput = z.infer<typeof MCPListCapabilitiesInputSchema>;

export const MCPInspectTimelineInputSchema = z.object({
  project: MotionProtocolV2Schema,
  layerId: z.string().optional(),
  verbose: z.boolean().default(false),
}).strict();
export type MCPInspectTimelineInput = z.infer<typeof MCPInspectTimelineInputSchema>;

export interface MCPInspectTimelineResult extends MCPBaseResult {
  totalDuration: number;
  rootLayerCount: number;
  layers: Array<{ id: string; type: string; zIndex: number; start: number; duration: number }>;
}

export const MCPExplainDiagnosticsInputSchema = z.object({
  diagnostics: z.array(z.object({
    path: z.string(),
    message: z.string(),
    severity: z.enum(["error", "warning", "info"]),
  }).strict()),
  suggestFixes: z.boolean().default(true),
  locale: z.string().default("en"),
}).strict();
export type MCPExplainDiagnosticsInput = z.infer<typeof MCPExplainDiagnosticsInputSchema>;

export interface MCPExplainDiagnosticsResult extends MCPBaseResult {
  explanations: Array<{
    original: { path: string; message: string; severity: string };
    explanation: string;
    suggestedAction?: string;
    suggestedPatchOperation?: Record<string, unknown>;
  }>;
}

export type MCPToolOperation =
  | { tool: "create_project"; input: MCPCreateProjectInput }
  | { tool: "validate_project"; input: MCPValidateProjectInput }
  | { tool: "apply_patch"; input: MCPApplyPatchInput }
  | { tool: "compile_project"; input: MCPCompileProjectInput }
  | { tool: "render_preview_frame"; input: MCPRenderPreviewFrameInput }
  | { tool: "list_capabilities"; input: MCPListCapabilitiesInput }
  | { tool: "inspect_timeline"; input: MCPInspectTimelineInput }
  | { tool: "explain_diagnostics"; input: MCPExplainDiagnosticsInput };

export type MCPToolResult =
  | { tool: "create_project"; result: MCPCreateProjectResult }
  | { tool: "validate_project"; result: MCPValidateProjectResult }
  | { tool: "apply_patch"; result: MCPApplyPatchResult }
  | { tool: "compile_project"; result: MCPCompileProjectResult }
  | { tool: "render_preview_frame"; result: MCPRenderPreviewFrameResult }
  | { tool: "list_capabilities"; result: MCPListCapabilitiesResult }
  | { tool: "inspect_timeline"; result: MCPInspectTimelineResult }
  | { tool: "explain_diagnostics"; result: MCPExplainDiagnosticsResult };

export interface MCPListCapabilitiesResult extends MCPBaseResult {
  capabilities: Array<{ id: string; name: string; description?: string; category: string; experimental: boolean }>;
  total: number;
}

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "project" | "compile" | "render" | "inspect";
  requiredCapabilities: string[];
}

export const MCP_TOOLS: MCPToolDescriptor[] = [
  { name: "create_project", description: "Create an Atomic Protocol V2 project", inputSchema: { $ref: "#/definitions/MCPCreateProjectInput" }, category: "project", requiredCapabilities: [] },
  { name: "validate_project", description: "Validate an Atomic Protocol V2 project", inputSchema: { $ref: "#/definitions/MCPValidateProjectInput" }, category: "project", requiredCapabilities: [] },
  { name: "apply_patch", description: "Apply an Atomic Protocol V2 patch", inputSchema: { $ref: "#/definitions/MCPApplyPatchInput" }, category: "project", requiredCapabilities: [] },
  { name: "compile_project", description: "Compile Protocol V2 into Runtime IR V2", inputSchema: { $ref: "#/definitions/MCPCompileProjectInput" }, category: "compile", requiredCapabilities: [] },
  { name: "render_preview_frame", description: "Render one V2 preview frame", inputSchema: { $ref: "#/definitions/MCPRenderPreviewFrameInput" }, category: "render", requiredCapabilities: [] },
  { name: "list_capabilities", description: "List certified V2 capabilities", inputSchema: { $ref: "#/definitions/MCPListCapabilitiesInput" }, category: "inspect", requiredCapabilities: [] },
  { name: "inspect_timeline", description: "Inspect V2 layer timings and order", inputSchema: { $ref: "#/definitions/MCPInspectTimelineInput" }, category: "inspect", requiredCapabilities: [] },
  { name: "explain_diagnostics", description: "Explain V2 diagnostics", inputSchema: { $ref: "#/definitions/MCPExplainDiagnosticsInput" }, category: "inspect", requiredCapabilities: [] },
];

const KNOWN_CAPABILITIES = [
  ["primitive.shape.rectangle", "Rectangle", "primitive", false],
  ["primitive.shape.ellipse", "Ellipse", "primitive", false],
  ["shape.rectangle.fill", "Rectangle fill", "style", false],
  ["shape.ellipse.fill", "Ellipse fill", "style", false],
  ["shape.rectangle.stroke", "Rectangle stroke", "style", false],
  ["shape.ellipse.stroke", "Ellipse stroke", "style", false],
  ["shape.rectangle.gradient", "Rectangle gradient", "style", false],
  ["shape.ellipse.gradient", "Ellipse gradient", "style", false],
  ["projection.orthographic-2d", "Orthographic projection", "projection", false],
  ["projection.perspective-3d", "Perspective projection", "projection", false],
  ["transform.matrix4", "Matrix4 transform", "transform", false],
] as const;

function emptyCapabilityCheck(): MCPCapabilityCheck {
  return { available: [], missing: [], recommended: [], experimental: [], allowed: true };
}

export function preflightCapabilities(_project: MotionProtocolV2, _available: string[]): MCPCapabilityCheck {
  return emptyCapabilityCheck();
}

export function canExecuteTool(toolName: string, _project: MotionProtocolV2, _available: string[]) {
  return { allowed: MCP_TOOLS.some((tool) => tool.name === toolName), missing: [] };
}

export function computeMCPProjectHash(project: MotionProtocolV2): { projectHash: string; projectHashShort: string } {
  const input = project as unknown as Record<string, unknown>;
  return { projectHash: computeProjectHash(input), projectHashShort: computeProjectHashShort(input) };
}

export function listCapabilities(filter?: string, includeExperimental = false): MCPListCapabilitiesResult {
  const capabilities = KNOWN_CAPABILITIES
    .filter(([id, , , experimental]) => (!filter || id.startsWith(filter)) && (includeExperimental || !experimental))
    .map(([id, name, category, experimental]) => ({ id, name, category, experimental }));
  return { warnings: [], capabilities, total: capabilities.length };
}

export function inspectTimeline(project: MotionProtocolV2, layerId?: string): MCPInspectTimelineResult {
  const layers = project.layers
    .filter((layer) => !layerId || layer.id === layerId)
    .map((layer) => ({ id: layer.id, type: layer.type, zIndex: layer.zIndex, start: layer.timing.start, duration: layer.timing.duration }));
  return {
    warnings: [],
    totalDuration: layers.reduce((max, layer) => Math.max(max, layer.start + layer.duration), 0),
    rootLayerCount: layers.length,
    layers,
  };
}

export function explainDiagnostics(input: MCPExplainDiagnosticsInput): MCPExplainDiagnosticsResult {
  return {
    warnings: [],
    explanations: input.diagnostics.map((diagnostic) => ({
      original: diagnostic,
      explanation: `A ${diagnostic.severity} diagnostic occurred at "${diagnostic.path}": ${diagnostic.message}.`,
      ...(input.suggestFixes ? { suggestedAction: "Correct the V2 JSON at the reported path and validate it again." } : {}),
    })),
  };
}
