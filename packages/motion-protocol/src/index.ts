/**
 * Public API — V1 layers-only authoring.
 *
 * `.` = JSON project (parse, layers, AssetV1, bindings, patch).
 * `./runtime` = compiler IR (`MotionRuntimeProject`, runtime assets, prepared types).
 */

export * from "./capabilities";
export * from "./ai-schema-capability";

export * as V1 from "./v1";

import {
  parseMotionProjectV1,
  MotionProjectV1Schema,
  CanonicalMotionProjectV1Schema,
  serializeMotionProjectV1,
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
};
export type { MotionProjectV1, CanonicalMotionProjectV1 } from "./v1";

export {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
  PropertyPathSchema,
  SemverSchema,
  AspectRatioSchema,
  SemanticSchema,
  PercentSchema,
  ColorAdjustPercentSchema,
  HueRotateSchema,
  ratioFromPercent,
  type AspectRatio,
} from "./v1/common";

export {
  JsonValueSchema,
  LiteralValueSchema,
  ValueKindSchema,
} from "./v1/values";

export { EffectSchema, type MotionEffect } from "./v1/effects";
export { TransformSchema, type MotionTransform } from "./v1/transform";
export { FrameSchema, type MotionFrame } from "./v1/frame";
export { OpacitySchema, type Opacity } from "./v1/opacity";
export {
  CompositingSchema,
  LayerMaskSchema,
  type MotionCompositing,
  type LayerMask,
} from "./v1/compositing";
export {
  EdgeInsetsSchema,
  LayoutSizeModeSchema,
  LayoutJustifySchema,
  LayoutAlignSchema,
  LayoutItemPolicySchema,
  LayoutConstraintSchema,
  GroupLayoutSchema,
  GroupLayoutItemSchema,
  RepeatSourceSchema,
  RepeatLayoutSchema,
  RepeaterSchema,
  GroupRepeaterSchema,
  type EdgeInsets,
  type LayoutConstraint,
  type LayoutItemPolicy,
  type RepeatSource,
  type RepeatLayout,
  type Repeater,
} from "./v1/group";

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
} from "./v1/assets/validation";

export {
  PointSchema,
  type MotionPoint,
  NormalizedPointSchema,
  type NormalizedPoint,
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
  LayerPropertyAnimationV1Schema,
  getLayerAnimations,
  type LayerPropertyAnimationV1,
  PaintStyleSchema,
  type MotionPaintStyle,
  segmentTextUnits,
  TextPayloadSchema,
  getTextPayloadPlain,
  setTextPayloadPlain,
  normalizeTextPayloadInput,
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
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  ProceduralDriverSchema,
  type ProceduralDriver,
  type KeyframeEasingV1,
} from "./v1/animation";
