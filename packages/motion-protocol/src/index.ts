/**
 * Public API surface — V3 is the only authoring protocol.
 *
 * Legacy authoring types (formatVersion 1 / 2) and their companion
 * directories have been permanently removed. All exports are canonical V3.
 */

// ── Capabilities / Registry / AI matrix ───────────────────────────────
export * from "./capabilities";
export {
  CAPABILITY_MANIFEST_VERSION_V3,
  preflightProjectCapabilities,
  inspectProjectCapabilities,
  type CapabilityPreflightResult,
} from "./v3/capabilities";
export * from "./scene-registry";
export * from "./ai-schema-capability";

// ── V3 namespace ──────────────────────────────────────────────────────
export * as V3 from "./v3";

// ── Canonical V3 Authoring API ────────────────────────────────────────

import {
  parseMotionProjectV3,
  MotionProjectV3Schema,
  serializeMotionProjectV3,
  type MotionProjectV3,
} from "./v3";

export type MotionProject = MotionProjectV3;
export const MotionProjectSchema = MotionProjectV3Schema;
export const MOTION_FORMAT_VERSION = 3 as const;

/** Parse a motion project JSON payload. Only formatVersion 3 is accepted. */
export function parseMotionProject(input: unknown): MotionProject {
  if (
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as Record<string, unknown>).formatVersion === 2
  ) {
    throw new Error(
      "Format version 2 motion projects are no longer supported. " +
        "Please migrate your project to format version 3.",
    );
  }
  return parseMotionProjectV3(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV3(project);
}

// Explicit V3 parse/serialize so consumers can import directly.
export {
  parseMotionProjectV3,
  MotionProjectV3Schema,
  serializeMotionProjectV3,
};
export type {
  MotionProjectV3,
  VisualClipV3,
  VisualTrackV3,
  AudioTrackV3,
} from "./v3";

// ── Canonical hash utilities ──────────────────────────────────────────
export {
  canonicalJson,
  computeProjectHash,
  computeProjectHashShort,
  computeRuntimeHash,
  computeContentHash,
  deepSortKeys,
  shortHash,
  hashesMatch,
  buildCapabilityFingerprint,
  RENDER_MANIFEST_VERSION,
} from "./v3/canonical-hash";
// V3 Patch (AI / MCP editing surface)
export {
  MotionProjectV3PatchSchema,
  applyMotionProjectV3Patch,
} from "./v3/patch";
export type {
  MotionProjectV3Patch,
  V3PatchOp,
  V3PatchDiagnostic,
  V3PatchResult,
} from "./v3/patch";

// V3 Skills (AI Agent / MCP instruction layer)
export {
  MotionSkillManifestSchema,
  validateSkillManifest,
  validateMotionSkillOutput,
  getBuiltinSkill,
  BUILTIN_SKILLS,
  BRAND_INTRO_SKILL,
  SOCIAL_AD_SKILL,
  SUBTITLE_STYLING_SKILL,
  PRODUCT_DEMO_SKILL,
  CORPORATE_TEMPLATE_SKILL,
} from "./v3/skills";
export type {
  MotionSkillManifest,
  SkillOutputContract,
  SkillExecutionResult,
  SkillValidationResult,
} from "./v3/skills";

// V3 MCP Tool Contract (server-agnostic automation surface)
export {
  MCPCreateProjectInputSchema,
  MCPValidateProjectInputSchema,
  MCPApplyPatchInputSchema,
  MCPCompileProjectInputSchema,
  MCPRenderPreviewFrameInputSchema,
  MCPListCapabilitiesInputSchema,
  MCPInspectTimelineInputSchema,
  MCPExplainDiagnosticsInputSchema,
  MCP_TOOLS,
  preflightCapabilities,
  canExecuteTool,
  computeMCPProjectHash,
  listCapabilities,
  inspectTimeline,
  explainDiagnostics,
} from "./v3/mcp";
export type {
  MCPCapabilityCheck,
  MCPBaseResult,
  MCPCreateProjectInput,
  MCPCreateProjectResult,
  MCPValidateProjectInput,
  MCPValidateProjectResult,
  MCPApplyPatchInput,
  MCPApplyPatchResult,
  MCPCompileProjectInput,
  MCPCompileProjectResult,
  MCPRenderPreviewFrameInput,
  MCPRenderPreviewFrameResult,
  MCPListCapabilitiesInput,
  MCPListCapabilitiesResult,
  MCPInspectTimelineInput,
  MCPInspectTimelineResult,
  MCPExplainDiagnosticsInput,
  MCPExplainDiagnosticsResult,
  MCPToolOperation,
  MCPToolResult,
  MCPToolDescriptor,
} from "./v3/mcp";

// ── Runtime IR (canonical path) ──────────────────────────────────────
export {
  MotionRuntimeProjectSchema,
  type MotionRuntimeProject,
  type MotionRuntimeScene,
  type MotionRuntimeTrack,
} from "./runtime";

// ── Shared Infrastructure (explicit re-exports from V3-owned modules) ──
//
// All schemas are V3-owned and exported from v3/ paths.
//
// LEGACY AUTHORING TYPES INTENTIONALLY EXCLUDED:
//   Format version 1/2 project, component, and parser types. These were
//   permanently removed — use the V3 authoring API instead.

// Common / Primitives — owned by V3 (Phase 2)
export {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
  PropertyPathSchema,
  SemverSchema,
  AspectRatioSchema,
  SemanticSchema,
  type AspectRatio,
} from "./v3/common";

export {
  SourceRefSchema,
  SourceRefKindSchema,
  sourceRefKey,
  type SourceRef,
  type SourceRefKind,
} from "./v3/source-ref";

export {
  JsonValueSchema,
  VariableReferenceSchema,
  ResolvableValueSchema,
  LiteralValueSchema,
  ValueKindSchema,
} from "./v3/values";

// Effects / Transform — V3 canonical (Phase 7 neutral names)
export { EffectSchema, type MotionEffect } from "./v3/effects";
export { TransformSchema, type MotionTransform } from "./v3/transform";

// Assets — V3 canonical (Phase 7 neutral names)
export {
  ImageAssetSchema,
  SvgAssetSchema,
  VideoAssetSchema,
  AudioAssetSchema,
  AudioAnalysisSchema,
  FontAssetSchema,
  AssetSchema,
} from "./runtime/assets";

// Captions — owned by V3 (Phase 2)
export {
  CaptionTrackSchema,
  type CaptionTrack,
  type CaptionToken,
} from "./v3/captions";

// Variables / Bindings — V3 canonical (Phase 7 neutral names)
export {
  VariableSchema,
  ComponentBindingSchema,
  ProjectBindingSchema,
  PublicParamSchema,
} from "./v3/variables";

// Layout — owned by V3 (Phase 2)
export {
  LayoutConstraintSchema,
  EdgeInsetsSchema,
  LayoutItemPolicySchema,
  type EdgeInsets,
  type LayoutItemPolicy,
} from "./v3/layout";

// Nodes — geometry primitives (Phase 7 neutral names)
export {
  PointSchema,
  type MotionPoint,
  PathSegmentSchema,
  type MotionPathSegment,
  PathContourSchema,
  type MotionPathContour,
  PathMorphTargetSchema,
  type MotionPathMorphTarget,
} from "./v3/nodes/geometry";

// Nodes — timing, paint, text (Phase 7 neutral names)
export {
  NodeTimingSchema,
  type NodeTiming,
  PaintStyleSchema,
  type MotionPaintStyle,
  segmentTextUnits,
  TextContentSchema,
  RichTextRunSchema,
  TextPayloadSchema,
  textContentPlain,
  getTextPayloadPlain,
  setTextPayloadPlain,
  normalizeTextPayloadInput,
  type TextContent,
  type RichTextRun,
  type TextNodePayload,
} from "./v3/nodes";

// Nodes — structural: MotionBlur owned by V3 (Phase 5)
export { MotionBlurSettingsSchema } from "./v3/nodes/structural";

// Nodes — V3 authoring node union (Phase 1: canonical neutral names)
export {
  GroupNodeV3Schema as GroupNodeSchema,
  BoneNodeV3Schema as BoneNodeSchema,
  TextNodeV3Schema as TextNodeSchema,
  ShapeNodeV3Schema as ShapeNodeSchema,
  PathNodeV3Schema as PathNodeSchema,
  ImageNodeV3Schema as ImageNodeSchema,
  SvgNodeV3Schema as SvgNodeSchema,
  VideoNodeV3Schema as VideoNodeSchema,
  CameraNodeV3Schema as CameraNodeSchema,
  SolidNodeV3Schema as SolidNodeSchema,
  AdjustmentNodeV3Schema as AdjustmentNodeSchema,
  NodeV3Schema as NodeSchema,
  type NodeV3 as MotionNode,
} from "./v3/nodes";

// Animation — V3 canonical (Phase 7 neutral names)
export {
  ClipScheduleSchema,
  PlaybackSchema,
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  ExtrapolationBehaviorSchema,
  ProceduralDriverSchema,
  type ProceduralDriver,
  SceneMarkerSchema,
  TrackTimeSchema,
} from "./v3/animation";

export { type MotionClipV3 } from "./v3/animation/clips";

/** Canonical clip type — re-exported from the V3 animation module. */
export type { MotionClipV3 as MotionClip } from "./v3/animation/clips";

// Project scene type — V3 canonical
export type { SceneDefinitionV3 as MotionScene } from "./v3/scenes";

// Design tokens — V3 canonical
export { DesignTokensSchema, type DesignTokens } from "./v3/variables";

// Runtime IR schemas/types (also available via ./runtime)
export {
  RuntimeCompositionMetadataSchema,
  RuntimeClipSourceSchema,
  RuntimeVisualClipSchema,
  RuntimeVisualTrackSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  MOTION_RUNTIME_VERSION,
  type RuntimeCompositionMetadata,
  type RuntimeClipSource,
  type RuntimeVisualClip,
  type RuntimeVisualTrack,
  type RuntimeSourceRef,
  type RuntimeSourceRefMap,
} from "./runtime/project";

// Prepared Runtime types
export {
  type PreparedRuntimeProject,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type RuntimeScene,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./runtime/prepared";
