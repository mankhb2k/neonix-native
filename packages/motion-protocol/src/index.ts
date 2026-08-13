/**
 * Public API surface — V1 is the only authoring protocol.
 *
 * `parseMotionProject` is `parseMotionProjectV1`. Non-1 payloads fail Zod.
 */

// ── Capabilities / Registry / AI matrix ───────────────────────────────
export * from "./capabilities";
export {
  CAPABILITY_MANIFEST_VERSION_V1,
  preflightProjectCapabilities,
  inspectProjectCapabilities,
  type CapabilityPreflightResult,
} from "./v1/capabilities";
export * from "./scene-registry";
export * from "./ai-schema-capability";

// ── V1 namespace ──────────────────────────────────────────────────────
export * as V1 from "./v1";

// ── Canonical V1 Authoring API ────────────────────────────────────────

import {
  parseMotionProjectV1,
  MotionProjectV1Schema,
  CanonicalMotionProjectV1Schema,
  serializeMotionProjectV1,
  deriveTimelineDurationV1,
  hasTimelineContentV1,
  getRootLayerTimelineEndV1,
  canonicalizeTimelineDurationV1,
  type MotionProjectV1,
  type CanonicalMotionProjectV1,
} from "./v1";

export type MotionProject = MotionProjectV1;
export const MotionProjectSchema = MotionProjectV1Schema;
export const MOTION_FORMAT_VERSION = 1 as const;

/** Parse a motion project JSON payload. Only formatVersion 1 is accepted. */
export function parseMotionProject(input: unknown): MotionProject {
  return parseMotionProjectV1(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV1(project);
}

// Explicit V1 parse/serialize so consumers can import directly.
export {
  parseMotionProjectV1,
  MotionProjectV1Schema,
  CanonicalMotionProjectV1Schema,
  serializeMotionProjectV1,
  deriveTimelineDurationV1,
  hasTimelineContentV1,
  getRootLayerTimelineEndV1,
  canonicalizeTimelineDurationV1,
};
export type {
  MotionProjectV1,
  CanonicalMotionProjectV1,
  CanonicalizeTimelineDurationIssue,
  CanonicalizeTimelineDurationResult,
} from "./v1";

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
} from "./v1/canonical-hash";
// V1 Patch (AI / MCP editing surface)
export {
  MotionProjectV1PatchSchema,
  applyMotionProjectV1Patch,
} from "./v1/patch";
export type {
  MotionProjectV1Patch,
  V1PatchOp,
  V1PatchDiagnostic,
  V1PatchResult,
} from "./v1/patch";

// V1 Skills (AI Agent / MCP instruction layer)
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
} from "./v1/skills";
export type {
  MotionSkillManifest,
  SkillOutputContract,
  SkillExecutionResult,
  SkillValidationResult,
} from "./v1/skills";

// V1 MCP Tool Contract (server-agnostic automation surface)
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
} from "./v1/mcp";
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
} from "./v1/mcp";

// ── Runtime IR (canonical path) ──────────────────────────────────────
export {
  MotionRuntimeProjectSchema,
  type MotionRuntimeProject,
  type MotionRuntimeScene,
  type MotionRuntimeTrack,
} from "./runtime";

// ── Shared Infrastructure (explicit re-exports from V1-owned modules) ──
//
// All schemas are V1-owned and exported from v1/ paths.

// Common / Primitives — owned by V1 (Phase 2)
export {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
  PropertyPathSchema,
  SemverSchema,
  AspectRatioSchema,
  SemanticSchema,
  type AspectRatio,
} from "./v1/common";

export {
  SourceRefSchema,
  SourceRefKindSchema,
  sourceRefKey,
  type SourceRef,
  type SourceRefKind,
} from "./v1/source-ref";

export {
  JsonValueSchema,
  VariableReferenceSchema,
  ResolvableValueSchema,
  LiteralValueSchema,
  ValueKindSchema,
} from "./v1/values";

// Effects / Transform — V1 canonical (Phase 7 neutral names)
export { EffectSchema, type MotionEffect } from "./v1/effects";
export { TransformSchema, type MotionTransform } from "./v1/transform";

// Assets — V1 canonical (Phase 7 neutral names)
export {
  ImageAssetSchema,
  SvgAssetSchema,
  VideoAssetSchema,
  AudioAssetSchema,
  AudioAnalysisSchema,
  FontAssetSchema,
  AssetSchema,
} from "./runtime/assets";
// V1 authoring asset schemas (compile-time)
export { AssetV1Schema, type AssetV1 } from "./v1/assets";

// Captions — owned by V1 (Phase 2)
export {
  CaptionTrackSchema,
  type CaptionTrack,
  type CaptionToken,
} from "./v1/captions";

// Variables / Bindings — V1 canonical (Phase 7 neutral names)
export {
  VariableSchema,
  ComponentBindingSchema,
  ProjectBindingV1Schema,
  type ProjectBindingV1,
} from "./v1/variables";

// Layout — owned by V1 (Phase 2)
export {
  LayoutConstraintSchema,
  EdgeInsetsSchema,
  LayoutItemPolicySchema,
  type EdgeInsets,
  type LayoutItemPolicy,
} from "./v1/layout";

// Layers — geometry primitives (Phase 7 neutral names)
export {
  PointSchema,
  type MotionPoint,
  PathSegmentSchema,
  type MotionPathSegment,
  PathContourSchema,
  type MotionPathContour,
  PathMorphTargetSchema,
  type MotionPathMorphTarget,
} from "./v1/layers/geometry";

// Layers — timing, paint, text (Phase 7 neutral names)
export {
  LayerTimingSchema,
  type LayerTiming,
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
  type TextLayerPayload,
} from "./v1/layers";

// Layers — structural: MotionBlur owned by V1 (Phase 5)
export { MotionBlurSettingsSchema } from "./v1/layers/structural";

// Layers — V1 authoring layer union (Phase 1: canonical neutral names)
export {
  GroupLayerV1Schema as GroupLayerSchema,
  BoneLayerV1Schema as BoneLayerSchema,
  TextLayerV1Schema as TextLayerSchema,
  ShapeLayerV1Schema as ShapeLayerSchema,
  PathLayerV1Schema as PathLayerSchema,
  ImageLayerV1Schema as ImageLayerSchema,
  SvgLayerV1Schema as SvgLayerSchema,
  VideoLayerV1Schema as VideoLayerSchema,
  CameraLayerV1Schema as CameraLayerSchema,
  SolidLayerV1Schema as SolidLayerSchema,
  AdjustmentLayerV1Schema as AdjustmentLayerSchema,
  ComponentLayerV1Schema as ComponentLayerSchema,
  LayerV1Schema as LayerSchema,
  type LayerV1 as MotionLayer,
} from "./v1/layers";

// Animation — V1 canonical (Phase 7 neutral names)
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
  TimelineMarkerSchema,
  TrackTimeSchema,
} from "./v1/animation";

export { type MotionClipV1 } from "./v1/animation/clips";

/** Canonical clip type — re-exported from the V1 animation module. */
export type { MotionClipV1 as MotionClip } from "./v1/animation/clips";

// Design tokens — V1 canonical
export { DesignTokensSchema, type DesignTokens } from "./v1/variables";

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
