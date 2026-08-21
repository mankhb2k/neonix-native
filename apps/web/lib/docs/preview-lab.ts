import { MATRIX4_PARITY_CASES } from "@motionvideo/motion-compiler/testing";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type RectangleLayer = Extract<V2Layer, { type: "shape" }>;
type ShapeOptions = {
  id: string;
  zIndex: number;
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
    zIndex: options.zIndex,
    frame: options.frame ?? { width: 96, height: 64 },
    transform: options.transform ?? IDENTITY_TRANSFORM,
    opacity: options.opacity ?? 100,
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
  assets?: NonNullable<MotionProtocolV2["assets"]>,
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
      audioSampleRate: 48000,
      view,
    },
    ...(assets ? { assets } : {}),
    layers,
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
      zIndex: 0,
      frame,
      transform: { ...IDENTITY_TRANSFORM, translate: { ...translate, z: 0 } },
      opacity: 100,
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
    zIndex: 0,
    frame: { width: 960, height: 540 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 480, y: 270, z: 0 } },
    opacity: 100,
    timing: { start: 0, duration: 3 },
    payload: {
      assetId: PREVIEW_VIDEO_ASSET.id,
      fit: "cover",
      trimStart: 0,
      trimEnd: 3,
      loop: false,
      muted: true,
      framePolicy: "floor",
    },
  }],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_VIDEO_ASSET],
);

const RECTANGLE_PROJECT = project("preview-rectangle-v2", [
  rectangle({ id: "rectangle", zIndex: 0, fill: "#00aa88" }),
]);

const ELLIPSE_PROJECT = project("preview-ellipse-v2", [
  ellipse({
    id: "ellipse",
    zIndex: 0,
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
      zIndex: 0,
      frame: { width: 320, height: 240 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 800, y: 400, z: 180 },
        rotate: { x: 0, y: -24, z: 0 },
        anchor: { x: 160, y: 120, z: 0 },
      },
      opacity: 100,
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
      zIndex: 0,
      frame: { width: 1120, height: 320 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 400, y: 360, z: 0 },
      },
      opacity: 100,
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
      zIndex: 0,
      frame: { width: 420, height: 320 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 760, y: 360, z: 0 },
        rotate: { x: 0, y: -12, z: 0 },
        anchor: { x: 210, y: 160, z: 0 },
      },
      opacity: 100,
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
      zIndex: 0,
      frame: { width: 1000, height: 700 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 420, y: 220, z: 240 },
        rotate: { x: 12, y: -18, z: 0 },
        anchor: { x: 500, y: 350, z: 0 },
      },
      opacity: 70,
      timing: { start: 0, duration: 3 },
    },
    {
      id: "group-back",
      type: "shape",
      parentLayerId: "group",
      zIndex: 1,
      frame: { width: 620, height: 420 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 140, y: 140, z: 0 },
      },
      opacity: 100,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
    {
      id: "group-front",
      type: "shape",
      parentLayerId: "group",
      zIndex: 2,
      frame: { width: 400, height: 280 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 320, y: 260, z: 120 },
        rotate: { x: 0, y: 0, z: 12 },
        anchor: { x: 200, y: 140, z: 0 },
      },
      opacity: 80,
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

const PATH_DONUT_INNER_EVENODD = {
  id: "donut-inner-evenodd",
  start: { x: 170, y: 110 },
  segments: [
    { kind: "line" as const, to: { x: 430, y: 110 } },
    { kind: "line" as const, to: { x: 430, y: 290 } },
    { kind: "line" as const, to: { x: 170, y: 290 } },
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
      zIndex: 0,
      frame: { width: 600, height: 400 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 650, y: 300, z: 0 },
      },
      opacity: 100,
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

const PATH_EVENODD_DONUT_PROJECT = pathDonutProject(
  "preview-path-evenodd-donut-v2",
  "evenodd",
  PATH_DONUT_INNER_EVENODD,
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
      zIndex: 0,
      frame: { width: 600, height: 400 },
      transform: {
        ...IDENTITY_TRANSFORM,
        translate: { x: 650, y: 300, z: 0 },
      },
      opacity: 100,
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
    zIndex: 0,
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
      zIndex: 0,
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
    zIndex: 0,
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
      zIndex: 0,
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
      zIndex: 0,
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
      zIndex: 0,
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
      zIndex: 0,
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
      zIndex: 0,
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
    zIndex: 0,
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
      zIndex: 0,
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
    zIndex: 0,
    fill: LINEAR_GRADIENT_FILL,
    frame: { width: 320, height: 180 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 800, y: 420, z: 0 } },
  }),
]);

const RADIAL_GRADIENT_PROJECT = project("preview-radial-gradient-v2", [
  ellipse({
    id: "radial-gradient",
    zIndex: 0,
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
      zIndex: 0,
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
  zIndex: number;
  text: string;
  align: TextLayer["payload"]["align"];
  verticalAlign: TextLayer["payload"]["verticalAlign"];
  transform: TextLayer["transform"];
}): TextLayer {
  return {
    id: options.id,
    type: "text",
    parentLayerId: null,
    zIndex: options.zIndex,
    frame: { width: 1140, height: 220 },
    transform: options.transform,
    opacity: 100,
    timing: { start: 0, duration: 3 },
    payload: {
      text: options.text,
      fontAssetId: PREVIEW_ROBOTO_REGULAR_FONT.id,
      fontSize: 96,
      lineHeight: 120,
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
      zIndex: 0,
      fill: "#173247",
      frame: { width: 1140, height: 220 },
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 390, y: 430, z: 0 } },
    }),
    textLayer({
      id: "text-center-middle",
      zIndex: 1,
      text: "NeonVideo V2 - Xin chao",
      align: "center",
      verticalAlign: "middle",
      transform: { ...IDENTITY_TRANSFORM, translate: { x: 390, y: 430, z: 0 } },
    }),
  ],
  ORTHOGRAPHIC_VIEW,
  [PREVIEW_ROBOTO_REGULAR_FONT],
);

const COLOR_ADJUST_PROJECT = project("preview-effect-color-adjust-v2", [
  rectangle({
    id: "source-red",
    zIndex: 0,
    fill: "#ff0000",
    frame: { width: 360, height: 360 },
    transform: { ...IDENTITY_TRANSFORM, translate: { x: 300, y: 360, z: 0 } },
  }),
  rectangle({
    id: "desaturated-red",
    zIndex: 1,
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

export type PreviewLabCase = {
  id: string;
  label: string;
  group: string;
  hint: string;
  project: MotionProtocolV2;
  previewTime?: number;
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
    id: "effect.color-adjust",
    label: "Effect / color adjust",
    group: "Task 11 / Effects",
    hint: "The right red rectangle is desaturated after its layer has been rasterized.",
    project: COLOR_ADJUST_PROJECT,
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
        zIndex: 0,
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
        zIndex: 0,
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
        zIndex: 0,
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
        zIndex: 0,
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
        zIndex: 0,
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
          zIndex: 0,
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
        zIndex: 0,
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
          zIndex: 0,
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
          zIndex: 0,
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
          zIndex: 0,
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
        zIndex: 0,
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
        zIndex: 0,
        fill: "#00aa88",
        opacity: 50,
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 48, y: 32, z: 0 } },
      }),
    ]),
  },
  {
    id: "rectangle.z-index",
    label: "Order / z-index",
    group: "Rectangle properties (Task 3)",
    hint: "The higher z-index paints last and covers the lower rectangle.",
    project: project("preview-rectangle-z-index-v2", [
      rectangle({
        id: "back",
        zIndex: 0,
        fill: "#00aa88",
        frame: { width: 1200, height: 700 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 360, y: 190, z: 0 } },
      }),
      rectangle({
        id: "front",
        zIndex: 1,
        fill: "#ff3366",
        frame: { width: 760, height: 420 },
        transform: { ...IDENTITY_TRANSFORM, translate: { x: 580, y: 330, z: 0 } },
      }),
    ]),
  },
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
    const cases = map.get(item.group) ?? [];
    cases.push(item);
    map.set(item.group, cases);
  }
  return [...map.entries()].map(([label, cases]) => ({ label, cases }));
}
