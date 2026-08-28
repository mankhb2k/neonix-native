import { MATRIX4_PARITY_CASES } from "@motionvideo/motion-compiler/testing";
import {
  V2_AUDIO_FIXTURES,
  type MotionProtocolV2,
  type V2AudioFixture,
} from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type RectangleLayer = Extract<V2Layer, { type: "shape" }>;
type ShapeOptions = {
  id: string;
  order: number;
  fill: RectangleLayer["style"]["fill"];
  fillOpacity?: number;
  cornerRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  frame?: RectangleLayer["frame"];
  transform?: RectangleLayer["transform"];
  opacity?: number;
  timing?: RectangleLayer["timing"];
  effects?: RectangleLayer["effects"];
};

const IDENTITY_TRANSFORM: RectangleLayer["transform"] = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function shapeLayer(options: ShapeOptions, shape: "rectangle" | "ellipse"): RectangleLayer {
  return {
    id: options.id,
    type: "shape",
    parentLayerId: null,
    order: options.order,
    frame: options.frame ?? { width: 96, height: 64 },
    transform: options.transform ?? IDENTITY_TRANSFORM,
    opacity: options.opacity ?? 1,
    timing: options.timing ?? { start: 0, duration: 3 },
    ...(options.effects ? { effects: options.effects } : {}),
    payload: {
      shape,
      ...(options.cornerRadius != null ? { cornerRadius: options.cornerRadius } : {}),
    },
    style: {
      fill: options.fill,
      ...(options.fillOpacity != null ? { fillOpacity: options.fillOpacity } : {}),
      ...(options.stroke ? { stroke: options.stroke } : {}),
      ...(options.strokeWidth != null ? { strokeWidth: options.strokeWidth } : {}),
      ...(options.strokeOpacity != null
        ? { strokeOpacity: options.strokeOpacity }
        : {}),
    },
  };
}

function rectangle(options: ShapeOptions): RectangleLayer {
  return shapeLayer(options, "rectangle");
}

function ellipse(options: ShapeOptions): RectangleLayer {
  return shapeLayer(options, "ellipse");
}

const ORTHOGRAPHIC_VIEW: MotionProtocolV2["composition"]["view"] = {
  projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

function project(
  id: string,
  layers: V2Layer[],
  view: MotionProtocolV2["composition"]["view"] = ORTHOGRAPHIC_VIEW,
  assets: MotionProtocolV2["assets"] = [],
): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view,
    },
    assets,
    layers,
    audio: { sampleRate: 48000, tracks: [] },
  };
}

const PREVIEW_IMAGE_ASSET = {
  id: "preview-image-v2",
  kind: "image" as const,
  uri: "/docs/example1-1.jpg",
  mimeType: "image/jpeg",
  width: 1920,
  height: 1920,
};

const PREVIEW_SNOW_ASSET = {
  id: "preview-snow-v2",
  kind: "image" as const,
  uri: "/docs/tuyet-roi.jpg",
  mimeType: "image/jpeg",
  width: 430,
  height: 296,
};

function imageProject(
  id: string,
  payload: { assetId: string; fit?: "contain" | "cover" | "fill" | "none"; crop?: { x: number; y: number; width: number; height: number } },
  frame: { width: number; height: number },
  translate: { x: number; y: number },
  assets: NonNullable<MotionProtocolV2["assets"]> = [PREVIEW_IMAGE_ASSET],
): MotionProtocolV2 {
  return project(
    id,
    [{
      id: "image",
      type: "image",
      parentLayerId: null,
      order: 0,
      frame,
      transform: { ...IDENTITY_TRANSFORM, translate: { ...translate, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload,
    }],
    ORTHOGRAPHIC_VIEW,
    assets,
  );
}

const IMAGE_CONTAIN_PROJECT = imageProject(
  "preview-image-contain-v2",
  { assetId: PREVIEW_IMAGE_ASSET.id, fit: "contain" },
  { width: 480, height: 360 },
  { x: 720, y: 360 },
);

const IMAGE_COVER_PROJECT = imageProject(
  "preview-image-cover-v2",
  { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
  { width: 480, height: 360 },
  { x: 720, y: 360 },
);

const IMAGE_CROP_PROJECT = imageProject(
  "preview-image-crop-v2",
  { assetId: PREVIEW_IMAGE_ASSET.id, fit: "fill", crop: { x: 0.5, y: 0, width: 0.5, height: 1 } },
  { width: 320, height: 240 },
  { x: 800, y: 420 },
);

const IMAGE_MISSING_ASSET_PROJECT = imageProject(
  "preview-image-missing-asset-v2",
  { assetId: "missing-image" },
  { width: 320, height: 240 },
  { x: 800, y: 420 },
  [],
);

function imageBlendProject(
  blendMode: "normal" | "multiply" | "screen" | "add",
): MotionProtocolV2 {
  return project(
    `preview-image-blend-${blendMode}-v2`,
    [
      {
        id: "blend-backdrop",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 860, height: 700 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 530, y: 190, z: 0 } },
        opacity: 1,
        timing: { start: 0, duration: 3 },
        payload: { shape: "rectangle" },
        style: {
          fill: {
            type: "linear-gradient",
            angle: 32,
            stops: [{ offset: 0, color: "#ff3366" }, { offset: 1, color: "#1b72ff" }],
          },
        },
      },
      {
        id: `blend-image-${blendMode}`,
        type: "image",
        parentLayerId: null,
        order: 1,
        frame: { width: 640, height: 640 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 670, y: 220, z: 0 } },
        opacity: 1,
        composite: { blendMode },
        timing: { start: 0, duration: 3 },
        payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
      },
    ],
    ORTHOGRAPHIC_VIEW,
    [PREVIEW_IMAGE_ASSET],
  );
}

const IMAGE_BLEND_NORMAL_PROJECT = imageBlendProject("normal");
const IMAGE_BLEND_MULTIPLY_PROJECT = imageBlendProject("multiply");
const IMAGE_BLEND_SCREEN_PROJECT = imageBlendProject("screen");
const IMAGE_BLEND_ADD_PROJECT = imageBlendProject("add");

function imageStackBlendProject(
  blendMode: "normal" | "multiply" | "screen" | "add",
): MotionProtocolV2 {
  return project(
    `preview-image-stack-blend-${blendMode}-v2`,
    [
      {
        id: "blend-stack-base-image",
        type: "image",
        parentLayerId: null,
        order: 0,
        frame: { width: 880, height: 880 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 520, y: 100, z: 0 } },
        opacity: 1,
        timing: { start: 0, duration: 3 },
        payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
      },
      {
        id: `blend-stack-snow-${blendMode}`,
        type: "image",
        parentLayerId: null,
        order: 1,
        frame: { width: 880, height: 880 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 520, y: 100, z: 0 } },
        opacity: 1,
        composite: { blendMode },
        timing: { start: 0, duration: 3 },
        payload: { assetId: PREVIEW_SNOW_ASSET.id, fit: "cover" },
      },
    ],
    ORTHOGRAPHIC_VIEW,
    [PREVIEW_IMAGE_ASSET, PREVIEW_SNOW_ASSET],
  );
}

const IMAGE_STACK_BLEND_NORMAL_PROJECT = imageStackBlendProject("normal");
const IMAGE_STACK_BLEND_MULTIPLY_PROJECT = imageStackBlendProject("multiply");
const IMAGE_STACK_BLEND_SCREEN_PROJECT = imageStackBlendProject("screen");
const IMAGE_STACK_BLEND_ADD_PROJECT = imageStackBlendProject("add");

const CLIP_MASK_PROJECT = project(
  "preview-clip-mask-v2",
  [
    {
      id: "clip-mask-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 1,
      composite: {
        blendMode: "normal",
        mask: { mode: "clip", sourceLayerId: "clip-mask-ellipse", sourceVisibility: "mask-only" },
      },
      timing: { start: 0, duration: 3 },
    },
    {
      id: "clip-mask-ellipse",
      type: "shape",
      parentLayerId: "clip-mask-group",
      order: 1,
      frame: { width: 660, height: 560 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 630, y: 260, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "ellipse" },
      style: { fill: "#ffffff" },
    },
    {
      id: "clip-mask-content",
      type: "image",
      parentLayerId: "clip-mask-group",
      order: 2,
      frame: { width: 960, height: 740 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 170, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_IMAGE_ASSET],
);

const ALPHA_MASK_PROJECT = project(
  "preview-alpha-mask-v2",
  [
    {
      id: "alpha-mask-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 1,
      composite: {
        blendMode: "normal",
        mask: { mode: "alpha", sourceLayerId: "alpha-mask-ellipse", sourceVisibility: "mask-only" },
      },
      timing: { start: 0, duration: 3 },
    },
    {
      id: "alpha-mask-ellipse",
      type: "shape",
      parentLayerId: "alpha-mask-group",
      order: 1,
      frame: { width: 660, height: 560 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 630, y: 260, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "ellipse" },
      style: { fill: "#ffffff", fillOpacity: 0.45 },
    },
    {
      id: "alpha-mask-content",
      type: "image",
      parentLayerId: "alpha-mask-group",
      order: 2,
      frame: { width: 960, height: 740 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 170, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_IMAGE_ASSET],
);

const INVERSE_ALPHA_MASK_PROJECT = project(
  "preview-inverse-alpha-mask-v2",
  [
    {
      id: "inverse-alpha-mask-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 1,
      composite: {
        blendMode: "normal",
        mask: { mode: "inverse-alpha", sourceLayerId: "inverse-alpha-mask-ellipse", sourceVisibility: "mask-only" },
      },
      timing: { start: 0, duration: 3 },
    },
    {
      id: "inverse-alpha-mask-ellipse",
      type: "shape",
      parentLayerId: "inverse-alpha-mask-group",
      order: 1,
      frame: { width: 660, height: 560 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 630, y: 260, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "ellipse" },
      style: { fill: "#ffffff" },
    },
    {
      id: "inverse-alpha-mask-content",
      type: "image",
      parentLayerId: "inverse-alpha-mask-group",
      order: 2,
      frame: { width: 960, height: 740 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 170, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_IMAGE_ASSET],
);

const LUMA_MASK_PROJECT = project(
  "preview-luma-mask-v2",
  [
    {
      id: "luma-mask-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 1,
      composite: {
        blendMode: "normal",
        mask: { mode: "luma", sourceLayerId: "luma-mask-ellipse", sourceVisibility: "mask-only" },
      },
      timing: { start: 0, duration: 3 },
    },
    {
      id: "luma-mask-ellipse",
      type: "shape",
      parentLayerId: "luma-mask-group",
      order: 1,
      frame: { width: 660, height: 560 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 630, y: 260, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "ellipse" },
      style: { fill: "#808080" },
    },
    {
      id: "luma-mask-content",
      type: "image",
      parentLayerId: "luma-mask-group",
      order: 2,
      frame: { width: 960, height: 740 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 170, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_IMAGE_ASSET],
);

const PREVIEW_VIDEO_ASSET = {
  id: "preview-video-v2",
  kind: "video" as const,
  uri: "/docs/example-video.mp4",
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 60.5,
  fps: 30,
};

const VIDEO_PROJECT = project(
  "preview-video-v2",
  [{
    id: "video",
    type: "video",
    parentLayerId: null,
    order: 0,
    frame: { width: 960, height: 540 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 270, z: 0 } },
    opacity: 1,
    timing: { start: 0, duration: 3 },
    payload: {
      assetId: PREVIEW_VIDEO_ASSET.id,
      fit: "cover",
      trimStart: 0,
      trimEnd: 3,
      framePolicy: "floor",
    },
  }],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_VIDEO_ASSET],
);

const RECTANGLE_PROJECT = project("preview-rectangle-v2", [
  rectangle({ id: "rectangle", order: 0, fill: "#00aa88" }),
]);

const ELLIPSE_PROJECT = project("preview-ellipse-v2", [
  ellipse({
    id: "ellipse",
    order: 0,
    fill: "#00aa88",
    frame: { width: 128, height: 80 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 48, y: 32, z: 0 } },
  }),
]);

const PATH_PENTAGON_PERSPECTIVE_PROJECT = project(
  "preview-path-pentagon-perspective-v2",
  [
    {
      id: "pentagon",
      type: "path",
      parentLayerId: null,
      order: 0,
      frame: { width: 320, height: 240 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 400, z: 180 },
        rotate: { x: 0, y: -24, z: 0 },
        anchor: { x: 160, y: 120, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: {
        contours: [{
          id: "pentagon-contour",
          start: { x: 28, y: 42 },
          segments: [
            { kind: "line", to: { x: 126, y: 18 } },
            { kind: "line", to: { x: 292, y: 72 } },
            { kind: "line", to: { x: 246, y: 214 } },
            { kind: "line", to: { x: 72, y: 232 } },
            { kind: "line", to: { x: 28, y: 42 } },
          ],
          closed: true,
        }],
        fillRule: "nonzero",
      },
      style: { fill: "#00aa88" },
    },
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const PATH_STROKE_PROJECT: MotionProtocolV2 = {
  ...PATH_PENTAGON_PERSPECTIVE_PROJECT,
  id: "preview-path-stroke-perspective-v2",
  layers: PATH_PENTAGON_PERSPECTIVE_PROJECT.layers.map((layer) => {
    if (layer.type !== "path") return layer;
    return {
      ...layer,
      id: "pentagon-stroke",
      style: {
        ...layer.style,
        stroke: "#ff3366",
        strokeWidth: 18,
        strokeOpacity: 0.9,
        strokeJoin: "round",
        strokeDash: { array: [72, 28], offset: 0 },
      },
    };
  }),
};

const PATH_OPEN_STROKE_PROJECT = project(
  "preview-path-open-stroke-v2",
  [
    {
      id: "open-stroke",
      type: "path",
      parentLayerId: null,
      order: 0,
      frame: { width: 1120, height: 320 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 400, y: 360, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: {
        contours: [{
          id: "open-line",
          start: { x: 60, y: 160 },
          segments: [{ kind: "line", to: { x: 1060, y: 160 } }],
          closed: false,
        }],
        fillRule: "nonzero",
      },
      style: {
        stroke: "#ff3366",
        strokeWidth: 34,
        strokeCap: "round",
        strokeDash: { array: [110, 44], offset: 0 },
      },
    },
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const PATH_MORPH_PROJECT = project(
  "preview-path-morph-v2",
  [
    {
      id: "morph-path",
      type: "path",
      parentLayerId: null,
      order: 0,
      frame: { width: 420, height: 320 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 760, y: 360, z: 0 },
        rotate: { x: 0, y: -12, z: 0 },
        anchor: { x: 210, y: 160, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: {
        contours: [{
          id: "morph-contour",
          start: { x: 40, y: 40 },
          segments: [
            { kind: "line", to: { x: 380, y: 40 } },
            { kind: "line", to: { x: 380, y: 280 } },
            { kind: "line", to: { x: 40, y: 280 } },
            { kind: "line", to: { x: 40, y: 40 } },
          ],
          closed: true,
        }],
        fillRule: "nonzero",
        morph: {
          progress: 0.5,
          targetContours: [{
            id: "morph-contour",
            start: { x: 210, y: 20 },
            segments: [
              { kind: "line", to: { x: 400, y: 160 } },
              { kind: "line", to: { x: 210, y: 300 } },
              { kind: "line", to: { x: 20, y: 160 } },
              { kind: "line", to: { x: 210, y: 20 } },
            ],
            closed: true,
          }],
        },
      },
      style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 10 },
    },
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const GROUP_PARENT_TRANSFORM_PROJECT = project(
  "preview-group-parent-transform-v2",
  [
    {
      id: "group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1000, height: 700 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 420, y: 220, z: 240 },
        rotate: { x: 12, y: -18, z: 0 },
        anchor: { x: 500, y: 350, z: 0 },
      },
      opacity: 0.7,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "group-back",
      type: "shape",
      parentLayerId: "group",
      order: 1,
      frame: { width: 620, height: 420 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 140, y: 140, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
    {
      id: "group-front",
      type: "shape",
      parentLayerId: "group",
      order: 2,
      frame: { width: 400, height: 280 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 320, y: 260, z: 120 },
        rotate: { x: 0, y: 0, z: 12 },
        anchor: { x: 200, y: 140, z: 0 },
      },
      opacity: 0.8,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#ff3366" },
    },
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const GROUP_ISOLATION_OPACITY_PROJECT = project(
  "preview-group-isolation-opacity-v2",
  [
    {
      id: "isolation-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 0.5,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "isolation-back",
      type: "shape",
      parentLayerId: "isolation-group",
      order: 1,
      frame: { width: 520, height: 340 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 460, y: 370, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
    {
      id: "isolation-front",
      type: "shape",
      parentLayerId: "isolation-group",
      order: 2,
      frame: { width: 520, height: 340 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 720, y: 370, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#ff3366" },
    },
  ],
  {
    projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const NESTED_ISOLATION_PROJECT = project(
  "preview-group-nested-isolation-v2",
  [
    {
      id: "nested-outer-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 0.75,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "nested-inner-group",
      type: "group",
      parentLayerId: "nested-outer-group",
      order: 1,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 0.5,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "nested-isolation-back",
      type: "shape",
      parentLayerId: "nested-inner-group",
      order: 2,
      frame: { width: 520, height: 340 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 460, y: 370, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
    {
      id: "nested-isolation-front",
      type: "shape",
      parentLayerId: "nested-inner-group",
      order: 3,
      frame: { width: 520, height: 340 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 720, y: 370, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#ff3366" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
);

const NESTED_MASK_ISOLATION_PROJECT = project(
  "preview-nested-mask-isolation-v2",
  [
    {
      id: "nested-mask-outer-group",
      type: "group",
      parentLayerId: null,
      order: 0,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 0.75,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "nested-mask-inner-group",
      type: "group",
      parentLayerId: "nested-mask-outer-group",
      order: 1,
      frame: { width: 1920, height: 1080 },
      transform: IDENTITY_TRANSFORM,
      opacity: 1,
      composite: {
        blendMode: "normal",
        mask: { mode: "alpha", sourceLayerId: "nested-mask-ellipse", sourceVisibility: "mask-only" },
      },
      timing: { start: 0, duration: 3 },
    },
    {
      id: "nested-mask-ellipse",
      type: "shape",
      parentLayerId: "nested-mask-inner-group",
      order: 2,
      frame: { width: 660, height: 560 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 630, y: 260, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "ellipse" },
      style: { fill: "#ffffff" },
    },
    {
      id: "nested-mask-content",
      type: "image",
      parentLayerId: "nested-mask-inner-group",
      order: 3,
      frame: { width: 960, height: 740 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 170, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { assetId: PREVIEW_IMAGE_ASSET.id, fit: "cover" },
    },
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_IMAGE_ASSET],
);

const PATH_DONUT_OUTER = {
  id: "donut-outer",
  start: { x: 0, y: 0 },
  segments: [
    { kind: "line" as const, to: { x: 600, y: 0 } },
    { kind: "line" as const, to: { x: 600, y: 400 } },
    { kind: "line" as const, to: { x: 0, y: 400 } },
    { kind: "line" as const, to: { x: 0, y: 0 } },
  ],
  closed: true as const,
};

const PATH_DONUT_INNER_NONZERO = {
  id: "donut-inner-nonzero",
  start: { x: 170, y: 110 },
  segments: [
    { kind: "line" as const, to: { x: 170, y: 290 } },
    { kind: "line" as const, to: { x: 430, y: 290 } },
    { kind: "line" as const, to: { x: 430, y: 110 } },
    { kind: "line" as const, to: { x: 170, y: 110 } },
  ],
  closed: true as const,
};

function pathDonutProject(
  id: string,
  fillRule: "nonzero" | "evenodd",
  inner: typeof PATH_DONUT_INNER_NONZERO,
): MotionProtocolV2 {
  return project(
    id,
    [{
      id: `donut-${fillRule}`,
      type: "path",
      parentLayerId: null,
      order: 0,
      frame: { width: 600, height: 400 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 650, y: 300, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: {
        contours: [PATH_DONUT_OUTER, inner],
        fillRule,
      },
      style: { fill: "#00aa88" },
    }],
    {
      projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  );
}

const PATH_NONZERO_DONUT_PROJECT = pathDonutProject(
  "preview-path-nonzero-donut-v2",
  "nonzero",
  PATH_DONUT_INNER_NONZERO,
);

const PATH_FIVE_POINT_STAR = {
  id: "five-point-star",
  start: { x: 300, y: 20 },
  segments: [
    { kind: "line" as const, to: { x: 555, y: 320 } },
    { kind: "line" as const, to: { x: 40, y: 130 } },
    { kind: "line" as const, to: { x: 560, y: 130 } },
    { kind: "line" as const, to: { x: 45, y: 320 } },
    { kind: "line" as const, to: { x: 300, y: 20 } },
  ],
  closed: true as const,
};

const PATH_SIX_POINT_POLYGON = {
  id: "six-point-polygon",
  start: { x: 300, y: 20 },
  segments: [
    { kind: "line" as const, to: { x: 540, y: 140 } },
    { kind: "line" as const, to: { x: 470, y: 340 } },
    { kind: "line" as const, to: { x: 300, y: 390 } },
    { kind: "line" as const, to: { x: 90, y: 300 } },
    { kind: "line" as const, to: { x: 50, y: 110 } },
    { kind: "line" as const, to: { x: 300, y: 20 } },
  ],
  closed: true as const,
};

function pathStarProject(
  id: string,
  fillRule: "nonzero" | "evenodd",
  contour = PATH_FIVE_POINT_STAR,
): MotionProtocolV2 {
  return project(
    id,
    [{
      id: `star-${fillRule}`,
      type: "path",
      parentLayerId: null,
      order: 0,
      frame: { width: 600, height: 400 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 650, y: 300, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: {
        contours: [contour],
        fillRule,
      },
      style: { fill: "#00aa88" },
    }],
    {
      projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  );
}

const PATH_NONZERO_STAR_PROJECT = pathStarProject(
  "preview-path-nonzero-star-v2",
  "nonzero",
);

const PATH_EVENODD_STAR_PROJECT = pathStarProject(
  "preview-path-evenodd-star-v2",
  "evenodd",
  PATH_SIX_POINT_POLYGON,
);

const RECTANGLE_STROKE_PROJECT = project("preview-rectangle-stroke-v2", [
  rectangle({
    id: "rectangle-stroke",
    order: 0,
    fill: "#00aa88",
    stroke: "#ff3366",
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const RECTANGLE_STROKE_PERSPECTIVE_PROJECT = project(
  "preview-rectangle-stroke-perspective-v2",
  [
    rectangle({
      id: "rectangle-stroke-perspective",
      order: 0,
      fill: "#00aa88",
      stroke: "#ff3366",
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const ELLIPSE_STROKE_PROJECT = project("preview-ellipse-stroke-v2", [
  ellipse({
    id: "ellipse-stroke",
    order: 0,
    fill: "#00aa88",
    stroke: "#ff3366",
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const ELLIPSE_STROKE_PERSPECTIVE_PROJECT = project(
  "preview-ellipse-stroke-perspective-v2",
  [
    ellipse({
      id: "ellipse-stroke-perspective",
      order: 0,
      fill: "#00aa88",
      stroke: "#ff3366",
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const RECTANGLE_STROKE_WIDTH_PROJECT = project(
  "preview-rectangle-stroke-width-v2",
  [
    rectangle({
      id: "rectangle-stroke-width",
      order: 0,
      fill: "#00aa88",
      stroke: "#ff3366",
      strokeWidth: 16,
      frame: { width: 320, height: 180 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
    }),
  ],
);

const RECTANGLE_STROKE_WIDTH_PERSPECTIVE_PROJECT = project(
  "preview-rectangle-stroke-width-perspective-v2",
  [
    rectangle({
      id: "rectangle-stroke-width-perspective",
      order: 0,
      fill: "#00aa88",
      stroke: "#ff3366",
      strokeWidth: 16,
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const RECTANGLE_PAINT_OPACITY_PROJECT = project(
  "preview-rectangle-paint-opacity-v2",
  [
    rectangle({
      id: "rectangle-paint-opacity",
      order: 0,
      fill: "#00aa88",
      fillOpacity: 0.5,
      stroke: "#ff3366",
      strokeWidth: 16,
      strokeOpacity: 0.25,
      frame: { width: 320, height: 180 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
    }),
  ],
);

const RECTANGLE_PAINT_OPACITY_PERSPECTIVE_PROJECT = project(
  "preview-rectangle-paint-opacity-perspective-v2",
  [
    rectangle({
      id: "rectangle-paint-opacity-perspective",
      order: 0,
      fill: "#00aa88",
      fillOpacity: 0.5,
      stroke: "#ff3366",
      strokeWidth: 16,
      strokeOpacity: 0.25,
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const ROUNDED_RECTANGLE_PROJECT = project("preview-rounded-rectangle-v2", [
  rectangle({
    id: "rounded-rectangle",
    order: 0,
    fill: "#00aa88",
    cornerRadius: 48,
    stroke: "#ff3366",
    strokeWidth: 16,
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const ROUNDED_RECTANGLE_PERSPECTIVE_PROJECT = project(
  "preview-rounded-rectangle-perspective-v2",
  [
    rectangle({
      id: "rounded-rectangle-perspective",
      order: 0,
      fill: "#00aa88",
      cornerRadius: 48,
      stroke: "#ff3366",
      strokeWidth: 16,
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const LINEAR_GRADIENT_FILL = {
  type: "linear-gradient" as const,
  angle: 0,
  stops: [
    { offset: 0, color: "#ff0000" },
    { offset: 1, color: "#0000ff" },
  ],
};

const RADIAL_GRADIENT_FILL = {
  type: "radial-gradient" as const,
  cx: 0.5,
  cy: 0.5,
  radius: 0.5,
  stops: [
    { offset: 0, color: "#ffffff" },
    { offset: 1, color: "#000000" },
  ],
};

const LINEAR_GRADIENT_PROJECT = project("preview-linear-gradient-v2", [
  rectangle({
    id: "linear-gradient",
    order: 0,
    fill: LINEAR_GRADIENT_FILL,
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const RADIAL_GRADIENT_PROJECT = project("preview-radial-gradient-v2", [
  ellipse({
    id: "radial-gradient",
    order: 0,
    fill: RADIAL_GRADIENT_FILL,
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const GRADIENT_PERSPECTIVE_PROJECT = project(
  "preview-gradient-perspective-v2",
  [
    rectangle({
      id: "gradient-perspective",
      order: 0,
      fill: LINEAR_GRADIENT_FILL,
      frame: { width: 320, height: 180 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 420, z: 180 },
        rotate: { x: 18, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      },
    }),
  ],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

type TextLayer = Extract<V2Layer, { type: "text" }>;

const PREVIEW_ROBOTO_REGULAR_FONT = {
  id: "preview-roboto-regular-v2",
  kind: "font" as const,
  uri: "/fonts/Roboto-Regular.ttf",
  mimeType: "font/ttf" as const,
  family: "Roboto",
  weight: 400,
  style: "normal" as const,
  integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
};

function textLayer(options: {
  id: string;
  order: number;
  text: string;
  align: TextLayer["payload"]["align"];
  verticalAlign: TextLayer["payload"]["verticalAlign"];
  transform: TextLayer["transform"];
  frame?: { width: number; height: number };
  fontSize?: number;
  lineHeight?: number;
}): TextLayer {
  return {
    id: options.id,
    type: "text",
    parentLayerId: null,
    order: options.order,
    frame: options.frame ?? { width: 1140, height: 220 },
    transform: options.transform,
    opacity: 1,
    timing: { start: 0, duration: 3 },
    payload: {
      text: options.text,
      fontAssetId: PREVIEW_ROBOTO_REGULAR_FONT.id,
      fontSize: options.fontSize ?? 96,
      lineHeight: options.lineHeight ?? 120,
      letterSpacing: 1,
      align: options.align,
      verticalAlign: options.verticalAlign,
      wrap: "none",
      overflow: "visible",
      direction: "ltr",
      language: "vi",
    },
    style: { fill: "#f8fafc" },
  };
}

const TEXT_ALIGNMENT_PROJECT = project(
  "preview-text-alignment-v2",
  [
    rectangle({
      id: "text-frame",
      order: 0,
      fill: "#173247",
      frame: { width: 1140, height: 220 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 390, y: 430, z: 0 } },
    }),
    textLayer({
      id: "text-center-middle",
      order: 1,
      text: "Neonix V2 - Xin chao",
      align: "center",
      verticalAlign: "middle",
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 390, y: 430, z: 0 } },
    }),
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_ROBOTO_REGULAR_FONT],
);

const TEXT_LEFT_PROJECT = project(
  "preview-text-left-v2",
  [
    rectangle({
      id: "text-left-frame",
      order: 0,
      fill: "#173247",
      frame: { width: 1280, height: 220 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 430, z: 0 } },
    }),
    textLayer({
      id: "text-left",
      order: 1,
      text: "Left aligned text",
      align: "left",
      verticalAlign: "middle",
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 430, z: 0 } },
      frame: { width: 1280, height: 220 },
    }),
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_ROBOTO_REGULAR_FONT],
);

const TEXT_RIGHT_PROJECT = project(
  "preview-text-right-v2",
  [
    rectangle({
      id: "text-right-frame",
      order: 0,
      fill: "#173247",
      frame: { width: 1280, height: 220 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 430, z: 0 } },
    }),
    textLayer({
      id: "text-right",
      order: 1,
      text: "Right aligned text",
      align: "right",
      verticalAlign: "middle",
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 430, z: 0 } },
      frame: { width: 1280, height: 220 },
    }),
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_ROBOTO_REGULAR_FONT],
);

const TEXT_PARAGRAPH_PROJECT = project(
  "preview-text-paragraph-v2",
  [
    rectangle({
      id: "text-paragraph-frame",
      order: 0,
      fill: "#173247",
      frame: { width: 1280, height: 420 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 330, z: 0 } },
    }),
    textLayer({
      id: "text-paragraph",
      order: 1,
      text: "Paragraph line one\nParagraph line two\nParagraph line three",
      align: "left",
      verticalAlign: "middle",
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 320, y: 330, z: 0 } },
      frame: { width: 1280, height: 420 },
      fontSize: 64,
      lineHeight: 84,
    }),
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_ROBOTO_REGULAR_FONT],
);

const COLOR_ADJUST_PROJECT = project("preview-effect-color-adjust-v2", [
  rectangle({
    id: "source-red",
    order: 0,
    fill: "#ff0000",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 360, z: 0 } },
  }),
  rectangle({
    id: "desaturated-red",
    order: 1,
    fill: "#ff0000",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 360, z: 0 } },
    effects: [{
      id: "desaturate",
      type: "color-adjust",
      brightness: 0,
      contrast: 1,
      saturation: 0,
      hueRotate: 0,
    }],
  }),
]);

const BLUR_PROJECT = project("preview-effect-blur-v2", [
  rectangle({
    id: "crisp-reference",
    order: 0,
    fill: "#ff3366",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 360, z: 0 } },
  }),
  rectangle({
    id: "blurred-rectangle",
    order: 1,
    fill: "#ff3366",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 360, z: 0 } },
    effects: [{ id: "soften", type: "blur", radius: 40 }],
  }),
]);

const BLUR_STROKE_PROJECT = project("preview-effect-blur-stroke-v2", [
  rectangle({
    id: "blurred-fill-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 360, z: 0 } },
    effects: [{ id: "soften-fill", type: "blur", radius: 24 }],
  }),
  rectangle({
    id: "blurred-stroke-rectangle",
    order: 1,
    fill: "#d9d9d9",
    stroke: "#ff3366",
    strokeWidth: 18,
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 360, z: 0 } },
    effects: [{ id: "soften-stroke", type: "blur", radius: 24 }],
  }),
]);

const DROP_SHADOW_PROJECT = project("preview-effect-drop-shadow-v2", [
  rectangle({
    id: "shadow-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
  }),
  rectangle({
    id: "drop-shadow-rectangle",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "pink-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 24,
      color: "#ff3366",
      opacity: 0.65,
    }],
  }),
]);

const DROP_SHADOW_NEGATIVE_PROJECT = project("preview-effect-drop-shadow-negative-v2", [
  rectangle({
    id: "negative-shadow-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
  }),
  rectangle({
    id: "negative-shadow-rectangle",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "blue-shadow-up-left",
      type: "drop-shadow",
      x: -24,
      y: -28,
      blur: 24,
      color: "#3366ff",
      opacity: 0.65,
    }],
  }),
]);

const DROP_SHADOW_ZERO_BLUR_PROJECT = project("preview-effect-drop-shadow-zero-blur-v2", [
  rectangle({
    id: "zero-blur-shadow-rectangle",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "crisp-pink-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 0,
      color: "#ff3366",
      opacity: 0.65,
    }],
  }),
]);

const DROP_SHADOW_ALPHA_COLOR_PROJECT = project("preview-effect-drop-shadow-alpha-color-v2", [
  rectangle({
    id: "alpha-color-shadow",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
    effects: [{
      id: "half-alpha-blue-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 0,
      color: "#3366ff80",
      opacity: 1,
    }],
  }),
  rectangle({
    id: "opaque-color-shadow",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "opaque-blue-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 0,
      color: "#3366ff",
      opacity: 1,
    }],
  }),
]);

const DROP_SHADOW_STROKE_PROJECT = project("preview-effect-drop-shadow-stroke-v2", [
  rectangle({
    id: "fill-only-shadow-source",
    order: 0,
    fill: "#d9d9d9",
    fillOpacity: 0.2,
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
    effects: [{
      id: "fill-only-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 0,
      color: "#ff3366",
      opacity: 0.75,
    }],
  }),
  rectangle({
    id: "fill-and-stroke-shadow-source",
    order: 1,
    fill: "#d9d9d9",
    fillOpacity: 0.2,
    stroke: "#d9d9d9",
    strokeWidth: 24,
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "fill-and-stroke-shadow",
      type: "drop-shadow",
      x: 24,
      y: 28,
      blur: 0,
      color: "#ff3366",
      opacity: 0.75,
    }],
  }),
]);

const OUTER_GLOW_PROJECT = project("preview-effect-outer-glow-v2", [
  rectangle({
    id: "glow-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
  }),
  rectangle({
    id: "outer-glow-rectangle",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "cyan-halo",
      type: "outer-glow",
      radius: 24,
      color: "#00e5ff",
      opacity: 0.7,
    }],
  }),
]);

const INNER_GLOW_PROJECT = project("preview-effect-inner-glow-v2", [
  rectangle({
    id: "inner-glow-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
  }),
  rectangle({
    id: "inner-glow-rectangle",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{
      id: "cyan-inner-edge",
      type: "inner-glow",
      radius: 24,
      color: "#00e5ff",
      opacity: 0.85,
    }],
  }),
]);

const OUTER_GLOW_STROKE_PROJECT = project("preview-effect-outer-glow-stroke-v2", [
  rectangle({
    id: "fill-only-glow-source",
    order: 0,
    fill: "#d9d9d9",
    fillOpacity: 0.2,
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 330, z: 0 } },
    effects: [{ id: "fill-only-halo", type: "outer-glow", radius: 24, color: "#ff3366", opacity: 0.75 }],
  }),
  rectangle({
    id: "fill-and-stroke-glow-source",
    order: 1,
    fill: "#d9d9d9",
    fillOpacity: 0.2,
    stroke: "#d9d9d9",
    strokeWidth: 24,
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 330, z: 0 } },
    effects: [{ id: "fill-and-stroke-halo", type: "outer-glow", radius: 24, color: "#ff3366", opacity: 0.75 }],
  }),
]);

const OUTER_GLOW_PERSPECTIVE_PROJECT = project(
  "preview-effect-outer-glow-perspective-v2",
  [rectangle({
    id: "outer-glow-perspective-rectangle",
    order: 0,
    fill: "#d9d9d9",
    stroke: "#ffffff",
    strokeWidth: 16,
    frame: { width: 440, height: 280 },
    transform: {
      ...IDENTITY_TRANSFORM,
      translate: { x: 740, y: 400, z: 180 },
      rotate: { x: 18, y: -24, z: 0 },
      anchor: { x: 220, y: 140, z: 0 },
    },
    effects: [{ id: "cyan-perspective-halo", type: "outer-glow", radius: 24, color: "#00e5ff", opacity: 0.7 }],
  })],
  {
    projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
    transform: {
      translate: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
    },
  },
);

const NOISE_PROJECT = project("preview-effect-noise-v2", [
  rectangle({
    id: "noise-reference",
    order: 0,
    fill: "#d9d9d9",
    frame: { width: 420, height: 420 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 220, y: 300, z: 0 } },
  }),
  rectangle({
    id: "noise-rectangle",
    order: 1,
    fill: "#d9d9d9",
    frame: { width: 420, height: 420 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1280, y: 300, z: 0 } },
    effects: [{
      id: "grain",
      type: "noise",
      scale: 4,
      amount: 0.45,
      opacity: 0.85,
      seed: 1337,
    }],
  }),
]);

const EFFECT_ORDER_GRADIENT_FILL = {
  type: "linear-gradient" as const,
  angle: 0,
  stops: [
    { offset: 0, color: "#000000" },
    { offset: 1, color: "#ffffff" },
  ],
};

const EFFECT_ORDER_PROJECT = project("preview-effect-order-v2", [
  rectangle({
    id: "color-then-blur",
    order: 0,
    fill: EFFECT_ORDER_GRADIENT_FILL,
    frame: { width: 600, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 180, y: 360, z: 0 } },
    effects: [
      { id: "contrast-first", type: "color-adjust", brightness: 0, contrast: 4, saturation: 1, hueRotate: 0 },
      { id: "blur-second", type: "blur", radius: 40 },
    ],
  }),
  rectangle({
    id: "blur-then-color",
    order: 1,
    fill: EFFECT_ORDER_GRADIENT_FILL,
    frame: { width: 600, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1140, y: 360, z: 0 } },
    effects: [
      { id: "blur-first", type: "blur", radius: 40 },
      { id: "contrast-second", type: "color-adjust", brightness: 0, contrast: 4, saturation: 1, hueRotate: 0 },
    ],
  }),
]);

const BLUR_CHAIN_PROJECT = project("preview-effect-blur-chain-v2", [
  rectangle({
    id: "single-blur",
    order: 0,
    fill: "#ff3366",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 360, z: 0 } },
    effects: [{ id: "single-soften", type: "blur", radius: 20 }],
  }),
  rectangle({
    id: "double-blur",
    order: 1,
    fill: "#ff3366",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 1260, y: 360, z: 0 } },
    effects: [
      { id: "first-soften", type: "blur", radius: 20 },
      { id: "second-soften", type: "blur", radius: 20 },
    ],
  }),
]);

function blurRadiusProject(id: string, radius: number): MotionProtocolV2 {
  return project(id, [rectangle({
    id: `blur-${radius}`,
    order: 0,
    fill: "#ff3366",
    frame: { width: 1200, height: 900 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 360, y: 90, z: 0 } },
    effects: [{ id: `soften-${radius}`, type: "blur", radius }],
  })]);
}

const BLUR_RADIUS_4_PROJECT = blurRadiusProject("preview-effect-blur-radius-4-v2", 4);
const BLUR_RADIUS_40_PROJECT = blurRadiusProject("preview-effect-blur-radius-40-v2", 40);
const BLUR_RADIUS_256_PROJECT = blurRadiusProject("preview-effect-blur-radius-256-v2", 256);

export type PreviewLabCase = {
  id: string;
  label: string;
  group: string;
  hint: string;
  project: MotionProtocolV2;
  previewTime?: number;
  audioFixture?: V2AudioFixture;
};

export const PREVIEW_LAB_CASES: PreviewLabCase[] = [
  {
    id: "primitive.shape.rectangle",
    label: "Shape / rectangle",
    group: "Certified atoms",
    hint: "Solid fill at the top-left frame origin.",
    project: RECTANGLE_PROJECT,
  },
  {
    id: "primitive.shape.ellipse",
    label: "Shape / ellipse",
    group: "Task 4 / Certified atoms",
    hint: "Parametric ellipse with antialiased coverage inside its frame.",
    project: ELLIPSE_PROJECT,
  },
  {
    id: "image.fit.contain",
    label: "Image / contain",
    group: "Task 8 / Image",
    hint: "A local 1:1 photo is contained inside a 4:3 frame, leaving deterministic side letterbox regions.",
    project: IMAGE_CONTAIN_PROJECT,
  },
  {
    id: "image.fit.cover",
    label: "Image / cover",
    group: "Task 8 / Image",
    hint: "The square photo covers the 4:3 frame and crops its vertical edges through the backend-neutral UV layout.",
    project: IMAGE_COVER_PROJECT,
  },
  {
    id: "image.crop",
    label: "Image / crop",
    group: "Task 8 / Image",
    hint: "A normalized crop selects the right half of the local photo through backend-neutral UV coordinates.",
    project: IMAGE_CROP_PROJECT,
  },
  {
    id: "image.missing-asset",
    label: "Image / missing asset",
    group: "Task 8 / Image",
    hint: "An unresolved asset remains a valid V2 command and reports a deterministic missing-asset diagnostic.",
    project: IMAGE_MISSING_ASSET_PROJECT,
  },
  {
    id: "composite.blend.normal",
    label: "Blend / normal",
    group: "Task 12 / Blend modes",
    hint: "The local example image uses ordinary source-over composition over a colored backdrop.",
    project: IMAGE_BLEND_NORMAL_PROJECT,
  },
  {
    id: "composite.blend.multiply",
    label: "Blend / multiply",
    group: "Task 12 / Blend modes",
    hint: "The local example image darkens against the same backdrop through portable GPU multiply blending.",
    project: IMAGE_BLEND_MULTIPLY_PROJECT,
  },
  {
    id: "composite.blend.screen",
    label: "Blend / screen",
    group: "Task 12 / Blend modes",
    hint: "The local example image lightens against the same backdrop through portable GPU screen blending.",
    project: IMAGE_BLEND_SCREEN_PROJECT,
  },
  {
    id: "composite.blend.add",
    label: "Blend / add",
    group: "Task 12 / Blend modes",
    hint: "The local example image adds its light to the same backdrop with clamped additive GPU compositing.",
    project: IMAGE_BLEND_ADD_PROJECT,
  },
  {
    id: "composite.blend.stack.normal",
    label: "Blend stack / normal",
    group: "Task 12 / Blend modes",
    hint: "The upper snow image is source-over at order 1; its opaque black pixels cover the lower example image.",
    project: IMAGE_STACK_BLEND_NORMAL_PROJECT,
  },
  {
    id: "composite.blend.stack.multiply",
    label: "Blend stack / multiply",
    group: "Task 12 / Blend modes",
    hint: "Only the upper snow image owns multiply; it darkens the lower example image already rendered at order 0.",
    project: IMAGE_STACK_BLEND_MULTIPLY_PROJECT,
  },
  {
    id: "composite.blend.stack.screen",
    label: "Blend stack / screen",
    group: "Task 12 / Blend modes",
    hint: "Only the upper snow image owns screen, so its black background is neutral and the bright snow remains over the lower image.",
    project: IMAGE_STACK_BLEND_SCREEN_PROJECT,
  },
  {
    id: "composite.blend.stack.add",
    label: "Blend stack / add",
    group: "Task 12 / Blend modes",
    hint: "Only the upper snow image owns add and contributes light over the lower image without changing layer ownership.",
    project: IMAGE_STACK_BLEND_ADD_PROJECT,
  },
  {
    id: "video.frame-seek",
    label: "Video / deterministic frame seek",
    group: "Task 9 / Video",
    hint: "The local MP4 is decoded at the requested composition frame; runtime emits source media time before the renderer uploads it.",
    project: VIDEO_PROJECT,
  },
  {
    id: "text.single-line.alignment",
    label: "Text / exact font alignment",
    group: "Task 10 / Text",
    hint: "Roboto Regular is hash-verified, shaped by Runtime, and aligned inside the immutable text frame before its glyph atlas reaches WebGPU or WebGL2.",
    project: TEXT_ALIGNMENT_PROJECT,
  },
  {
    id: "text.left.alignment",
    label: "Text / left alignment",
    group: "Task 10 / Text",
    hint: "The same immutable frame keeps the glyph run pinned to its left edge.",
    project: TEXT_LEFT_PROJECT,
  },
  {
    id: "text.right.alignment",
    label: "Text / right alignment",
    group: "Task 10 / Text",
    hint: "The same immutable frame keeps the glyph run pinned to its right edge.",
    project: TEXT_RIGHT_PROJECT,
  },
  {
    id: "text.paragraph.multiline",
    label: "Text / paragraph",
    group: "Task 10 / Text",
    hint: "Explicit newline characters create deterministic paragraph lines; each line uses the same alignment and line height inside the frame.",
    project: TEXT_PARAGRAPH_PROJECT,
  },
  {
    id: "effect.color-adjust",
    label: "Effect / color adjust",
    group: "Task 11 / Effects",
    hint: "The right red rectangle is desaturated after its layer has been rasterized.",
    project: COLOR_ADJUST_PROJECT,
  },
  {
    id: "effect.blur",
    label: "Effect / blur",
    group: "Task 11 / Effects",
    hint: "The right rectangle uses a 40 px screen-space Gaussian blur through a linear premultiplied pyramid, then composites back over the stage.",
    project: BLUR_PROJECT,
  },
  {
    id: "effect.blur.stroke",
    label: "Effect / blur with stroke",
    group: "Task 11 / Effects",
    hint: "A neutral gray fill and pink stroke make the blur contribution of each source region measurable before drop-shadow work begins.",
    project: BLUR_STROKE_PROJECT,
  },
  {
    id: "effect.drop-shadow",
    label: "Effect / drop shadow",
    group: "Task 11 / Effects",
    hint: "A pink alpha-derived shadow is blurred and offset behind the immutable gray source before source-over compositing.",
    project: DROP_SHADOW_PROJECT,
  },
  {
    id: "effect.drop-shadow.negative-offset",
    label: "Effect / shadow negative offset",
    group: "Task 11 / Effects",
    hint: "A blue shadow is displaced above and left of the immutable source, proving signed projected-pixel offsets.",
    project: DROP_SHADOW_NEGATIVE_PROJECT,
  },
  {
    id: "effect.drop-shadow.zero-blur",
    label: "Effect / shadow zero blur",
    group: "Task 11 / Effects",
    hint: "A zero-sigma shadow retains a crisp translated alpha silhouette before the source is composited over it.",
    project: DROP_SHADOW_ZERO_BLUR_PROJECT,
  },
  {
    id: "effect.drop-shadow.alpha-color",
    label: "Effect / shadow alpha color",
    group: "Task 11 / Effects",
    hint: "Half-alpha and opaque blue shadow colors share the same source and offset, making embedded color alpha measurable.",
    project: DROP_SHADOW_ALPHA_COLOR_PROJECT,
  },
  {
    id: "effect.drop-shadow.stroke-source",
    label: "Effect / shadow stroke source",
    group: "Task 11 / Effects",
    hint: "The right source adds an opaque stroke over a translucent fill; its stronger offset silhouette proves source capture includes paint coverage.",
    project: DROP_SHADOW_STROKE_PROJECT,
  },
  {
    id: "effect.outer-glow",
    label: "Effect / outer glow",
    group: "Task 11 / Effects",
    hint: "The cyan halo is derived from the immutable final alpha, blurred in screen pixels, then placed behind the unchanged gray source.",
    project: OUTER_GLOW_PROJECT,
  },
  {
    id: "effect.outer-glow.stroke-source",
    label: "Effect / outer glow stroke source",
    group: "Task 11 / Effects",
    hint: "The right halo is stronger because its immutable source includes opaque stroke coverage over the same translucent fill.",
    project: OUTER_GLOW_STROKE_PROJECT,
  },
  {
    id: "effect.inner-glow",
    label: "Effect / inner glow",
    group: "Task 11 / Effects",
    hint: "The cyan edge is the positive difference between the final source alpha and its blurred alpha, composited inside the unchanged gray source.",
    project: INNER_GLOW_PROJECT,
  },
  {
    id: "effect.outer-glow.perspective",
    label: "Effect / outer glow perspective",
    group: "Task 11 / Effects",
    hint: "Matrix4 projection is captured before the cyan halo, so glow follows the final projected silhouette instead of world-space geometry.",
    project: OUTER_GLOW_PERSPECTIVE_PROJECT,
  },
  {
    id: "effect.noise",
    label: "Effect / deterministic noise",
    group: "Task 11 / Effects",
    hint: "The right rectangle receives deterministic grain on its already-rasterized alpha surface; the left rectangle is the clean reference.",
    project: NOISE_PROJECT,
  },
  {
    id: "effect.order",
    label: "Effect / order",
    group: "Task 11.5 / Effect program",
    hint: "Contrast before blur and contrast after blur produce distinct projected surfaces; order is never normalized away.",
    project: EFFECT_ORDER_PROJECT,
  },
  {
    id: "effect.blur-chain",
    label: "Effect / two blurs",
    group: "Task 11.5 / Effect program",
    hint: "The right rectangle runs two ordered 20 px Gaussian operators and spreads further than the single-pass reference.",
    project: BLUR_CHAIN_PROJECT,
  },
  {
    id: "effect.blur.radius-4",
    label: "Effect / blur 4 px",
    group: "Task 11.5 / Blur radii",
    hint: "A 4 px Gaussian sigma stays crisp at the opaque center with a narrow antialiased edge.",
    project: BLUR_RADIUS_4_PROJECT,
  },
  {
    id: "effect.blur.radius-40",
    label: "Effect / blur 40 px",
    group: "Task 11.5 / Blur radii",
    hint: "A 40 px Gaussian sigma uses the shared linear premultiplied blur plan.",
    project: BLUR_RADIUS_40_PROJECT,
  },
  {
    id: "effect.blur.radius-256",
    label: "Effect / blur 256 px",
    group: "Task 11.5 / Blur radii",
    hint: "A 256 px Gaussian sigma exercises the blur pyramid while preserving a clean opaque core.",
    project: BLUR_RADIUS_256_PROJECT,
  },
  {
    id: "path.closed-fill.perspective",
    label: "Path / five-point fill",
    group: "Task 6 / Path embedded in 3D",
    hint: "Five arbitrary local-plane points are closed, tessellated, and rotated through the shared Matrix4 perspective path.",
    project: PATH_PENTAGON_PERSPECTIVE_PROJECT,
  },
  {
    id: "path.fill-rule.nonzero",
    label: "Path / nonzero five-point star",
    group: "Task 6 / Path fill rules",
    hint: "A self-intersecting five-point path fills its center because the winding count is nonzero.",
    project: PATH_NONZERO_STAR_PROJECT,
  },
  {
    id: "path.fill-rule.evenodd",
    label: "Path / evenodd six-point polygon",
    group: "Task 6 / Path fill rules",
    hint: "A six-point local path demonstrates a second contour geometry under even-odd fill semantics.",
    project: PATH_EVENODD_STAR_PROJECT,
  },
  {
    id: "path.multiple-contours.donut",
    label: "Path / multiple contours donut",
    group: "Task 6 / Multiple contours",
    hint: "Two nested contours form a hole before the path is transformed by the shared Matrix4 pipeline.",
    project: PATH_NONZERO_DONUT_PROJECT,
  },
  {
    id: "path.paint.stroke",
    label: "Path / stroke",
    group: "Task 6 / Path stroke",
    hint: "A Runtime-resolved local-plane stroke follows the five-point path through the shared Matrix4 perspective pipeline.",
    project: PATH_STROKE_PROJECT,
  },
  {
    id: "path.paint.stroke-cap-dash",
    label: "Path / cap and dash",
    group: "Task 6 / Path stroke",
    hint: "An open stroke uses round caps and a deterministic dash pattern on the local plane.",
    project: PATH_OPEN_STROKE_PROJECT,
  },
  {
    id: "path.morph",
    label: "Path / morph",
    group: "Task 6 / Path morph",
    hint: "Matching contour topology is interpolated at progress 0.5 before the shared Matrix4 tessellation path.",
    project: PATH_MORPH_PROJECT,
  },
  {
    id: "group.parent-transform",
    label: "Group / parent transform",
    group: "Task 7 / Group and Parent Transform",
    hint: "A non-rendering Group inherits Matrix4 translation, X/Y rotation, opacity, timing, and child ordering into two rectangle leaves.",
    project: GROUP_PARENT_TRANSFORM_PROJECT,
  },
  {
    id: "group.isolation.opacity",
    label: "Group / isolated opacity",
    group: "Task 12 / Isolation boundary",
    hint: "Two opaque children are flattened after Matrix4 projection; the front-only and overlap pixels receive the group opacity exactly once.",
    project: GROUP_ISOLATION_OPACITY_PROJECT,
  },
  {
    id: "group.isolation.nested",
    label: "Group / nested isolation",
    group: "Task 12 / Nested masks and isolation",
    hint: "Two isolated group surfaces are composited from the inner opacity boundary to the outer opacity boundary.",
    project: NESTED_ISOLATION_PROJECT,
  },
  {
    id: "composite.mask.nested",
    label: "Composite / nested mask",
    group: "Task 12 / Nested masks and isolation",
    hint: "An alpha-masked inner group is composited into an isolated outer group before the result reaches the stage.",
    project: NESTED_MASK_ISOLATION_PROJECT,
  },
  {
    id: "composite.mask.clip",
    label: "Composite / ellipse clip mask",
    group: "Task 12 / Clip mask",
    hint: "A mask-only ellipse contributes alpha coverage to its direct group sibling; the image remains visible only inside that projected shape.",
    project: CLIP_MASK_PROJECT,
  },
  {
    id: "composite.mask.alpha",
    label: "Composite / alpha mask",
    group: "Task 12 / Alpha mask",
    hint: "The mask-only ellipse preserves 45% source alpha, so the same image is partially composited instead of binary-clipped.",
    project: ALPHA_MASK_PROJECT,
  },
  {
    id: "composite.mask.inverse-alpha",
    label: "Composite / inverse alpha mask",
    group: "Task 12 / Inverse alpha mask",
    hint: "The opaque mask-only ellipse removes image coverage at its projected center while leaving the image visible outside the ellipse.",
    project: INVERSE_ALPHA_MASK_PROJECT,
  },
  {
    id: "composite.mask.luma",
    label: "Composite / luma mask",
    group: "Task 12 / Luma mask",
    hint: "An opaque gray ellipse contributes linear luminance as coverage, proving that the mask color affects image opacity.",
    project: LUMA_MASK_PROJECT,
  },
  {
    id: "rectangle.paint.stroke",
    label: "Paint / rectangle stroke",
    group: "Task 5 / rectangle stroke",
    hint: "Renders the certified rectangle fill with a fixed four-unit stroke.",
    project: RECTANGLE_STROKE_PROJECT,
  },
  {
    id: "rectangle.paint.stroke-perspective",
    label: "Paint / stroke perspective",
    group: "Task 5 / rectangle stroke",
    hint: "Keeps rectangle stroke paint attached to the shared Matrix4 perspective path.",
    project: RECTANGLE_STROKE_PERSPECTIVE_PROJECT,
  },
  {
    id: "ellipse.paint.stroke",
    label: "Paint / ellipse stroke",
    group: "Task 5 / ellipse stroke",
    hint: "Renders an antialiased four-unit stroke around the ellipse boundary.",
    project: ELLIPSE_STROKE_PROJECT,
  },
  {
    id: "ellipse.paint.stroke-perspective",
    label: "Paint / ellipse perspective",
    group: "Task 5 / ellipse stroke",
    hint: "Keeps ellipse stroke paint attached to the shared Matrix4 perspective path.",
    project: ELLIPSE_STROKE_PERSPECTIVE_PROJECT,
  },
  {
    id: "rectangle.paint.stroke-width",
    label: "Paint / stroke width",
    group: "Task 5 / stroke width",
    hint: "Uses a sixteen-unit local stroke width instead of the default width.",
    project: RECTANGLE_STROKE_WIDTH_PROJECT,
  },
  {
    id: "rectangle.paint.stroke-width-perspective",
    label: "Paint / width perspective",
    group: "Task 5 / stroke width",
    hint: "Keeps custom local stroke width attached to the Matrix4 perspective path.",
    project: RECTANGLE_STROKE_WIDTH_PERSPECTIVE_PROJECT,
  },
  {
    id: "rectangle.paint.opacity",
    label: "Paint / fill and stroke opacity",
    group: "Task 5 / paint opacity",
    hint: "Composites fill at 50% and stroke at 25% over the composition background.",
    project: RECTANGLE_PAINT_OPACITY_PROJECT,
  },
  {
    id: "rectangle.paint.opacity-perspective",
    label: "Paint / opacity perspective",
    group: "Task 5 / paint opacity",
    hint: "Keeps independent fill and stroke alpha through Matrix4 perspective.",
    project: RECTANGLE_PAINT_OPACITY_PERSPECTIVE_PROJECT,
  },
  {
    id: "rectangle.rounded",
    label: "Shape / rounded rectangle",
    group: "Task 5 / rounded rectangle",
    hint: "Uses a local 48-unit corner radius with fill and stroke.",
    project: ROUNDED_RECTANGLE_PROJECT,
  },
  {
    id: "rectangle.rounded-perspective",
    label: "Shape / rounded perspective",
    group: "Task 5 / rounded rectangle",
    hint: "Keeps rounded geometry and stroke attached to Matrix4 perspective.",
    project: ROUNDED_RECTANGLE_PERSPECTIVE_PROJECT,
  },
  {
    id: "rectangle.gradient.linear",
    label: "Paint / linear gradient",
    group: "Task 5 / gradients",
    hint: "Uses two semantic color stops from left to right.",
    project: LINEAR_GRADIENT_PROJECT,
  },
  {
    id: "ellipse.gradient.radial",
    label: "Paint / radial gradient",
    group: "Task 5 / gradients",
    hint: "Uses a centered radial gradient with two semantic color stops.",
    project: RADIAL_GRADIENT_PROJECT,
  },
  {
    id: "rectangle.gradient.perspective",
    label: "Paint / gradient perspective",
    group: "Task 5 / gradients",
    hint: "Keeps semantic gradient paint attached to Matrix4 perspective.",
    project: GRADIENT_PERSPECTIVE_PROJECT,
  },
  {
    id: "rectangle.transform.translate",
    label: "Transform / translate",
    group: "Rectangle properties (Task 3)",
    hint: "Moves the rectangle by composition pixels.",
    project: project("preview-rectangle-translate-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 48, y: 32, z: 0 } },
      }),
    ]),
  },
  {
    id: "rectangle.transform.scale",
    label: "Transform / scale",
    group: "Rectangle properties (Task 3)",
    hint: "Scales around the top-left origin.",
    project: project("preview-rectangle-scale-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        frame: { width: 64, height: 48 },
        transform: {
          ...IDENTITY_TRANSFORM,
          translate: { x: 32, y: 32, z: 0 },
          scale: { x: 2, y: 1.5, z: 1 },
        },
      }),
    ]),
  },
  {
    id: "rectangle.transform.anchor",
    label: "Transform / anchor",
    group: "Rectangle properties (Task 3)",
    hint: "Uses a local-unit center anchor before scaling.",
    project: project("preview-rectangle-anchor-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        frame: { width: 64, height: 48 },
        transform: {
          ...IDENTITY_TRANSFORM,
          translate: { x: 160, y: 90, z: 0 },
          scale: { x: 2, y: 2, z: 1 },
          anchor: { x: 32, y: 24, z: 0 },
        },
      }),
    ]),
  },
  {
    id: "rectangle.transform.rotate",
    label: "Transform / rotate",
    group: "Rectangle properties (Task 3)",
    hint: "Rotates 90 degrees around the normalized center pivot.",
    project: project("preview-rectangle-rotate-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        frame: { width: 80, height: 40 },
        transform: {
          ...IDENTITY_TRANSFORM,
          translate: { x: 160, y: 90, z: 0 },
          rotate: { x: 0, y: 0, z: 90 },
          anchor: { x: 40, y: 20, z: 0 },
        },
      }),
    ]),
  },
  {
    id: "rectangle.mat4.anchor-outside-rotate-z",
    label: "Matrix4 / outside anchor",
    group: "Task 3.5 / Matrix4 rectangle",
    hint: "Rotates around an anchor outside the rectangle bounds.",
    project: project("preview-rectangle-anchor-outside-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        frame: { width: 160, height: 96 },
        transform: {
          ...IDENTITY_TRANSFORM,
          translate: { x: 360, y: 260, z: 0 },
          rotate: { x: 0, y: 0, z: 28 },
          anchor: { x: 220, y: 120, z: 0 },
        },
      }),
    ]),
  },
  {
    id: "rectangle.mat4.anchor-z-rotate-y-perspective",
    label: "Matrix4 / perspective",
    group: "Task 3.5 / Matrix4 rectangle",
    hint: "Uses Z depth and Y rotation through the shared perspective projection.",
    project: project(
      "preview-rectangle-anchor-z-perspective-v2",
      [
        rectangle({
          id: "rectangle",
          order: 0,
          fill: "#00aa88",
          frame: { width: 320, height: 180 },
          transform: {
            ...IDENTITY_TRANSFORM,
            translate: { x: 800, y: 420, z: 220 },
            rotate: { x: 0, y: 28, z: 0 },
            anchor: { x: 160, y: 90, z: 0 },
          },
        }),
      ],
      {
        projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    ),
  },
  {
    id: "rectangle.transform.skew",
    label: "Transform / skew",
    group: "Rectangle properties (Task 3)",
    hint: "Skews the rectangle by 45 degrees on the X axis.",
    project: project("preview-rectangle-skew-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        frame: { width: 80, height: 40 },
        transform: {
          ...IDENTITY_TRANSFORM,
          translate: { x: 40, y: 50, z: 0 },
          skew: { x: 45, y: 0 },
        },
      }),
    ]),
  },
  {
    id: "rectangle.mat4.rotate-x-perspective",
    label: "Matrix4 / rotate X",
    group: "Task 3.5 / Matrix4 rectangle",
    hint: "Exercises X rotation under the shared perspective projection.",
    project: project(
      "preview-rectangle-rotate-x-perspective-v2",
      [
        rectangle({
          id: "rectangle",
          order: 0,
          fill: "#00aa88",
          frame: { width: 320, height: 180 },
          transform: {
            ...IDENTITY_TRANSFORM,
            translate: { x: 800, y: 420, z: 160 },
            rotate: { x: 24, y: 0, z: 0 },
            anchor: { x: 160, y: 90, z: 0 },
          },
        }),
      ],
      {
        projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    ),
  },
  {
    id: "rectangle.mat4.rotate-y-perspective",
    label: "Matrix4 / rotate Y",
    group: "Task 3.5 / Matrix4 rectangle",
    hint: "Exercises Y rotation with a perspective projection.",
    project: project(
      "preview-rectangle-rotate-y-perspective-v2",
      [
        rectangle({
          id: "rectangle",
          order: 0,
          fill: "#00aa88",
          frame: { width: 320, height: 180 },
          transform: {
            ...IDENTITY_TRANSFORM,
            translate: { x: 800, y: 420, z: 160 },
            rotate: { x: 0, y: -24, z: 0 },
            anchor: { x: 160, y: 90, z: 0 },
          },
        }),
      ],
      {
        projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    ),
  },
  {
    id: "rectangle.mat4.translate-z-perspective",
    label: "Matrix4 / translate Z",
    group: "Task 3.5 / Matrix4 rectangle",
    hint: "Moves the rectangle toward the perspective camera on Z.",
    project: project(
      "preview-rectangle-translate-z-perspective-v2",
      [
        rectangle({
          id: "rectangle",
          order: 0,
          fill: "#00aa88",
          frame: { width: 320, height: 180 },
          transform: {
            ...IDENTITY_TRANSFORM,
            translate: { x: 800, y: 420, z: 240 },
            anchor: { x: 160, y: 90, z: 0 },
          },
        }),
      ],
      {
        projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    ),
  },
  {
    id: "rectangle.timing",
    label: "Timing / active window",
    group: "Rectangle properties (Task 3)",
    hint: "Visible only in the half-open time window [1s, 2s).",
    previewTime: 1,
    project: project("preview-rectangle-timing-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 48, y: 32, z: 0 } },
        timing: { start: 1, duration: 1 },
      }),
    ]),
  },
  {
    id: "rectangle.opacity",
    label: "Opacity / composite",
    group: "Rectangle properties (Task 3)",
    hint: "Composites a 50% fill over the composition background.",
    project: project("preview-rectangle-opacity-v2", [
      rectangle({
        id: "rectangle",
        order: 0,
        fill: "#00aa88",
        opacity: 0.5,
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 48, y: 32, z: 0 } },
      }),
    ]),
  },
  {
    id: "rectangle.order",
    label: "Order",
    group: "Rectangle properties (Task 3)",
    hint: "The higher order paints last and covers the lower rectangle.",
    project: project("preview-rectangle-order-v2", [
      rectangle({
        id: "back",
        order: 0,
        fill: "#00aa88",
        frame: { width: 1200, height: 700 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 360, y: 190, z: 0 } },
      }),
      rectangle({
        id: "front",
        order: 1,
        fill: "#ff3366",
        frame: { width: 760, height: 420 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 580, y: 330, z: 0 } },
      }),
    ]),
  },
  ...V2_AUDIO_FIXTURES.map((fixture) => ({
    id: fixture.id,
    label: fixture.label,
    group: "Audio",
    hint: fixture.hint,
    project: fixture.project,
    previewTime: fixture.previewTime,
    audioFixture: fixture,
  })),
  ...MATRIX4_PARITY_CASES.map((item) => ({
    id: item.id,
    label: item.id.replace("matrix4.", "Matrix4 / ").replaceAll("-", " "),
    group: "Task 5.95 / Matrix4 parity",
    hint:
      item.id === "matrix4.camera-plane"
        ? "The behind-camera layer stays clipped while a valid reference and origin sentinel make the result visible."
        : "Shared Matrix4 fixture used by Preview and Remotion parity tests.",
    project: item.project,
  })),
];

export const PREVIEW_LAB_DEFAULT_CASE = "primitive.shape.rectangle";

const PREVIEW_LAB_GROUP_ORDER = [
  "Primitives",
  "Primitives / rounded",
  "Transforms & 3D",
  "Groups",
  "Paths",
  "Paint / strokes",
  "Paint / gradients",
  "Paint / opacity",
  "Images",
  "Video",
  "Audio",
  "Text",
  "Timing",
  "Effects",
  "Compositing / blend modes",
  "Compositing / masks & isolation",
  "Compositing",
] as const;

type PreviewLabGroupLabel = (typeof PREVIEW_LAB_GROUP_ORDER)[number];

function previewLabGroupLabel(item: PreviewLabCase): PreviewLabGroupLabel {
  if (item.id.startsWith("primitive.shape.")) return "Primitives";
  if (item.id.startsWith("rectangle.rounded")) return "Primitives / rounded";
  if (
    item.id.startsWith("rectangle.transform.") ||
    item.id.startsWith("rectangle.mat4.") ||
    item.id.startsWith("matrix4.")
  ) {
    return "Transforms & 3D";
  }
  if (item.id.startsWith("group.isolation.")) {
    return "Compositing / masks & isolation";
  }
  if (item.id.startsWith("group.")) return "Groups";
  if (item.id.startsWith("path.")) return "Paths";
  if (
    item.id.startsWith("rectangle.paint.stroke") ||
    item.id.startsWith("ellipse.paint.stroke") ||
    item.id.startsWith("rectangle.paint.stroke-width")
  ) {
    return "Paint / strokes";
  }
  if (item.id.startsWith("rectangle.gradient") || item.id.startsWith("ellipse.gradient")) {
    return "Paint / gradients";
  }
  if (item.id.startsWith("rectangle.paint.opacity")) return "Paint / opacity";
  if (item.id.startsWith("image.")) return "Images";
  if (item.id.startsWith("video.")) return "Video";
  if (item.id.startsWith("audio.")) return "Audio";
  if (item.id.startsWith("text.")) return "Text";
  if (item.id.startsWith("rectangle.timing")) return "Timing";
  if (item.id.startsWith("effect.")) return "Effects";
  if (item.id.startsWith("composite.blend.")) return "Compositing / blend modes";
  if (item.id.startsWith("composite.mask.")) {
    return "Compositing / masks & isolation";
  }
  if (item.id === "rectangle.opacity" || item.id === "rectangle.order") {
    return "Compositing";
  }
  return "Compositing";
}

export function previewLabCaseById(
  id: string | null | undefined,
): PreviewLabCase {
  return (
    PREVIEW_LAB_CASES.find((item) => item.id === id) ??
    PREVIEW_LAB_CASES.find((item) => item.id === PREVIEW_LAB_DEFAULT_CASE) ??
    PREVIEW_LAB_CASES[0]
  );
}

export function previewLabGroups(): Array<{
  label: string;
  cases: PreviewLabCase[];
}> {
  const map = new Map<string, PreviewLabCase[]>();
  for (const item of PREVIEW_LAB_CASES) {
    const group = previewLabGroupLabel(item);
    const cases = map.get(group) ?? [];
    cases.push(item);
    map.set(group, cases);
  }
  return PREVIEW_LAB_GROUP_ORDER
    .filter((label) => map.has(label))
    .map((label) => ({ label, cases: map.get(label)! }));
}
