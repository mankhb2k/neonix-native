/**
 * Public API surface — V3 authoring + runtime IR.
 *
 * Phase 1 (Legacy Removal): `export * from "./legacy"` has been replaced
 * with explicit re-exports. Only shared infrastructure types (nodes,
 * animation, primitives) are re-exported. V2 authoring types
 * (MotionProjectV2, MotionComponentV2, parseMotionProjectV2, …) are
 * no longer available from the public root.
 *
 * Consumers that still need V2 authoring types during the transition
 * should import from `@motionvideo/motion-protocol/src/legacy/*` directly.
 */

// ── Capabilities / Registry / AI matrix ───────────────────────────────
export * from "./capabilities";
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
      "V2 motion projects are no longer supported. " +
        "Please migrate your project to V3 format.",
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
// Phase 2: schemas that V3 now owns are exported from v3/ paths.
// Legacy re-exports remain for animation, nodes, project, runtime, and
// prepared-runtime (pending Phases 3–5).
//
// V2 AUTHORING TYPES INTENTIONALLY EXCLUDED:
//   MotionProjectV2, MotionComponentV2, parseMotionProjectV2,
//   parseMotionComponentV2, serializeMotionProjectV2,
//   NormalizedMotionProjectV2, MotionRuntimeIR,
//   LipSyncSchema, LipSyncCueSchema

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

// Effects / Transform — owned by V3 (Phase 2)
export { EffectV2Schema, type MotionEffect } from "./v3/effects";
export { TransformV2Schema, type MotionTransform } from "./v3/transform";

// Assets — still in legacy (owned by V3 as AssetV3, re-exported for compat)
export {
  ImageAssetV2Schema,
  SvgAssetV2Schema,
  VideoAssetV2Schema,
  AudioAssetV2Schema,
  AudioAnalysisSchema,
  FontAssetV2Schema,
  AssetV2Schema,
} from "./runtime/assets";

// Captions — owned by V3 (Phase 2)
export {
  CaptionTrackSchema,
  type CaptionTrack,
  type CaptionToken,
} from "./v3/captions";

// Variables / Bindings — owned by V3 (Phase 6)
export {
  VariableV2Schema,
  ComponentBindingSchema,
  ProjectBindingSchema,
  PublicParamV2Schema,
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

// Nodes — geometry primitives owned by V3 (Phase 5)
export {
  PointV2Schema,
  type MotionPoint,
  PathSegmentV2Schema,
  type MotionPathSegment,
  PathContourV2Schema,
  type MotionPathContour,
  PathMorphTargetV2Schema,
  type MotionPathMorphTarget,
} from "./v3/nodes/geometry";

// Nodes — timing, paint, text owned by V3 (Phase 2)
export {
  NodeTimingV2Schema,
  type NodeTimingV2,
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

// Nodes — V2-specific schemas still in legacy
export {
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  TextNodeV2Schema,
  ShapeNodeV2Schema,
  PathNodeV2Schema,
  ImageNodeV2Schema,
  SvgNodeV2Schema,
  VideoNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  SolidNodeV2Schema,
  AdjustmentNodeV2Schema,
  NodeV2Schema,
  type MotionNode,
} from "./runtime/nodes";

// Animation
export {
  ClipScheduleSchema,
  PlaybackSchema,
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingV2Schema,
  ExtrapolationBehaviorSchema,
  ProceduralDriverSchema,
  type ProceduralDriverV2,
  SceneMarkerSchema,
  TrackTimeSchema,
} from "./v3/animation";

// V2-specific clip types (component-action, not in V3)
export { ClipV2Schema, type MotionClip } from "./runtime/animation/clips";

// Project scene type — V3 canonical
export type { SceneDefinitionV3 as MotionScene } from "./v3/scenes";

// Design tokens — V3 canonical (extends compat with radii, motion)
export { DesignTokensSchema, type DesignTokens } from "./v3/variables";

// Runtime IR schemas/types (also available via ./runtime, re-exported for compat)
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
