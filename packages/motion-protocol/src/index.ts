/**
 * Public API — V1 layers-only authoring.
 *
 * `.` = JSON project (parse, layers, AssetV1, bindings, patch, MCP).
 * `./runtime` = compiler IR (`MotionRuntimeProject`, runtime assets, prepared types).
 */

export * from "./capabilities";
export {
  CAPABILITY_MANIFEST_VERSION_V1,
  preflightProjectCapabilities,
  inspectProjectCapabilities,
  type CapabilityPreflightResult,
} from "./v1/capabilities";
export * from "./ai-schema-capability";

export * as V1 from "./v1";

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

export { EffectSchema, type MotionEffect } from "./v1/effects";
export { TransformSchema, type MotionTransform } from "./v1/transform";

export {
  AssetV1Schema,
  AssetRetentionModeV1Schema,
  AssetStorageV1Schema,
  AssetSourceV1Schema,
  AssetSourceKindV1Schema,
  type AssetV1,
  type AssetRetentionModeV1,
  type AssetStorageV1,
  type AssetSourceV1,
  type AssetSourceKindV1,
} from "./v1/assets";
export {
  assetValidationIssue,
  type AssetValidationIssue,
  type AssetValidationCode,
  type AssetValidationLayer,
} from "./v1/asset-validation";

export {
  VariableSchema,
  ProjectBindingV1Schema,
  type ProjectBindingV1,
} from "./v1/variables";

export {
  LayoutConstraintSchema,
  EdgeInsetsSchema,
  LayoutItemPolicySchema,
  type EdgeInsets,
  type LayoutItemPolicy,
} from "./v1/layout";

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

export { MotionBlurSettingsSchema } from "./v1/layers/structural";

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

export {
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

export type { MotionClipV1 } from "./v1/animation/clips";

export { DesignTokensSchema, type DesignTokens } from "./v1/variables";
