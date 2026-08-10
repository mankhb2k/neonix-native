export {
  MOTION_PROJECT_FORMAT_VERSION,
  MOTION_COMPONENT_FORMAT_VERSION,
  MOTION_PATCH_FORMAT_VERSION,
  AspectRatioSchema,
  SemanticSchema,
  type AspectRatio,
} from "./common";

export {
  SourceRefSchema,
  SourceRefKindSchema,
  sourceRefKey,
  type SourceRef,
  type SourceRefKind,
} from "./source-ref";

export {
  JsonValueSchema,
  VariableReferenceSchema,
  ResolvableValueSchema,
  LiteralValueSchema,
  ValueKindSchema,
} from "./values";

export { EffectV2Schema, type MotionEffect } from "./effects";

export { TransformV2Schema, type MotionTransform } from "./transform";

export {
  ImageAssetV2Schema,
  SvgAssetV2Schema,
  VideoAssetV2Schema,
  AudioAssetV2Schema,
  AudioAnalysisSchema,
  FontAssetV2Schema,
  AssetV2Schema,
} from "./assets";

export {
  CaptionTrackSchema,
  type CaptionTrack,
  type CaptionToken,
} from "./captions";

export {
  VariableV2Schema,
  ComponentBindingSchema,
  ProjectBindingSchema,
  PublicParamV2Schema,
  PublicParamSchema,
} from "./variables";

export {
  LayoutConstraintSchema,
  EdgeInsetsSchema,
  LayoutItemPolicySchema,
  type EdgeInsets,
  type LayoutItemPolicy,
} from "./layout";

export {
  NodeTimingV2Schema,
  type NodeTimingV2,
  PaintStyleSchema,
  type MotionPaintStyle,
  PointV2Schema,
  type MotionPoint,
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  segmentTextUnits,
  TextNodeV2Schema,
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
  ShapeNodeV2Schema,
  PathSegmentV2Schema,
  PathContourV2Schema,
  PathMorphTargetV2Schema,
  PathNodeV2Schema,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
  ImageNodeV2Schema,
  SvgNodeV2Schema,
  VideoNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  SolidNodeV2Schema,
  AdjustmentNodeV2Schema,
  MotionBlurSettingsSchema,
  NodeV2Schema,
  type MotionNode,
} from "./nodes";

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
  ClipV2Schema,
  type MotionClip,
} from "./animation";

export {
  LipSyncCueSchema,
  LipSyncSchema,
  MotionComponentV2Schema,
  type MotionComponentV2,
} from "./component";

export {
  DesignTokensSchema,
  PlatformSafeAreaSchema,
  SceneTransitionSchema,
  BrandV2Schema,
  ProjectMetadataV2Schema,
  MotionProjectV2Schema,
  type MotionProjectV2,
  type MotionScene,
} from "./project";

export { MotionPatchSchema, type MotionPatch, applyMotionPatch } from "./patch";

export {
  NormalizedMotionProjectV2Schema,
  type NormalizedMotionProjectV2,
} from "./runtime";

export {
  type PreparedRuntimeProject,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type RuntimeScene,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./prepared-runtime";

export type { ReferenceIssue } from "./references/types";
export { MotionV2ReferenceError } from "./references/types";
export { validateMotionComponentV2References } from "./references/component";
export { validateMotionProjectV2References } from "./references/project";

export {
  parseMotionComponentV2,
  parseMotionProjectV2,
  serializeMotionProjectV2,
} from "./parse";
