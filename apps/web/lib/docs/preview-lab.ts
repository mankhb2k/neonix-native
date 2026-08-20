import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type RectangleLayer = MotionProtocolV2["layers"][number];
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

function project(
  id: string,
  layers: RectangleLayer[],
  view?: MotionProtocolV2["composition"]["view"],
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
      ...(view ? { view } : {}),
    },
    layers,
  };
}

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
