import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const ORTHOGRAPHIC_VIEW: MotionProtocolV2["composition"]["view"] = {
  projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

function transform(
  translate: { x: number; y: number; z: number },
  frame: { width: number; height: number },
): MotionProtocolV2["layers"][number]["transform"] {
  return {
    translate,
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: frame.width / 2, y: frame.height / 2, z: 0 },
  };
}

function shapeLayer(input: {
  id: string;
  order: number;
  fill: string;
  width: number;
  height: number;
  position: { x: number; y: number; z: number };
}): MotionProtocolV2["layers"][number] {
  return {
    id: input.id,
    type: "shape",
    parentLayerId: null,
    order: input.order,
    frame: { width: input.width, height: input.height },
    transform: transform(input.position, { width: input.width, height: input.height }),
    // Protocol V2 stores normalized opacity (0..1), never editor percentages.
    opacity: 1,
    timing: { start: 0, duration: 3 },
    payload: { shape: "rectangle", cornerRadius: 24 },
    style: { fill: input.fill, stroke: "#ffffff", strokeWidth: 4 },
  };
}

function historyTextLayer(input: {
  id: string;
  order: number;
  text: string;
  start: number;
  duration: number;
}): MotionProtocolV2["layers"][number] {
  return {
    id: input.id,
    type: "text",
    parentLayerId: null,
    order: input.order,
    frame: { width: 1440, height: 180 },
    transform: transform({ x: 240, y: 450, z: 0 }, { width: 1440, height: 180 }),
    opacity: 1,
    timing: { start: input.start, duration: input.duration },
    payload: {
      text: input.text.normalize("NFC"),
      fontAssetId: "font-roboto-regular",
      fontSize: 72,
      lineHeight: 86,
      letterSpacing: 0,
      align: "center",
      verticalAlign: "middle",
      wrap: "none",
      overflow: "visible",
      direction: "ltr",
      language: "vi",
    },
    style: { fill: "#f7e7bd" },
  };
}

function historyCardLayer(input: {
  id: string;
  order: number;
  start: number;
  duration: number;
  fill: string;
}): MotionProtocolV2["layers"][number] {
  return {
    id: input.id,
    type: "shape",
    parentLayerId: null,
    order: input.order,
    frame: { width: 1520, height: 360 },
    transform: transform({ x: 200, y: 360, z: 0 }, { width: 1520, height: 360 }),
    opacity: 0.9,
    timing: { start: input.start, duration: input.duration },
    payload: { shape: "rectangle", cornerRadius: 28 },
    style: {
      fill: input.fill,
      stroke: "#d8b56b",
      strokeWidth: 3,
    },
  };
}

const THREE_KINGDOMS_EVENTS = [
  { start: 0, title: "184 · Yellow Turban Rebellion", fill: "#5d1f1f" },
  { start: 10, title: "189 · Dong Zhuo Disrupts the Han Court", fill: "#43234f" },
  { start: 20, title: "200 · Guandu — Cao Cao Unifies Northern China", fill: "#263d59" },
  { start: 30, title: "208 · Red Cliffs — The Sun-Liu Alliance", fill: "#71321f" },
  { start: 40, title: "220–229 · Wei, Shu, and Wu Establish Kingdoms", fill: "#274b3b" },
  { start: 50, title: "280 · Jin Unifies the Three Kingdoms", fill: "#4d3f25" },
] as const;

export function createThreeKingdomsHistoryProject(): MotionProtocolV2 {
  const eventLayers = THREE_KINGDOMS_EVENTS.flatMap((event, index) => {
    const cardOrder = 2 + index * 2;
    return [
      historyCardLayer({
        id: `chapter-${index + 1}-card`,
        order: cardOrder,
        start: event.start,
        duration: 10,
        fill: event.fill,
      }),
      historyTextLayer({
        id: `chapter-${index + 1}-title`,
        order: cardOrder + 1,
        text: event.title,
        start: event.start,
        duration: 10,
      }),
    ];
  });

  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: "history-three-kingdoms-60s",
    assets: [
      {
        id: "font-roboto-regular",
        kind: "font",
        uri: "/fonts/Roboto-Regular.ttf",
        mimeType: "font/ttf",
        family: "Roboto",
        weight: 400,
        style: "normal",
        integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
      },
      {
        id: "three-kingdoms-atmosphere",
        kind: "image",
        uri: "/docs/tuyet-roi.jpg",
        mimeType: "image/jpeg",
        width: 1920,
        height: 1080,
      },
      {
        id: "three-kingdoms-score",
        kind: "audio",
        uri: "/api/docs/audio",
        mimeType: "audio/mpeg",
        duration: 60,
        sampleRate: 48000,
        channels: 2,
      },
    ],
    audio: {
      sampleRate: 48000,
      tracks: [
        {
          id: "music",
          gainDb: -10,
          pan: 0,
          muted: false,
          clips: [
            {
              id: "three-kingdoms-score-clip",
              assetId: "three-kingdoms-score",
              timing: { start: 0, duration: 60 },
              trim: { start: 0, end: 60 },
              playbackRate: 1,
              enabled: true,
              gainDb: 0,
              pan: 0,
              fadeIn: { duration: 2, curve: "equal-power" },
              fadeOut: { duration: 3, curve: "equal-power" },
            },
          ],
        },
      ],
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#100b08",
      colorSpace: "srgb",
      view: ORTHOGRAPHIC_VIEW,
    },
    layers: [
      {
        id: "main-lane",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 1920, height: 1080 },
        transform: transform({ x: 0, y: 0, z: 0 }, { width: 1920, height: 1080 }),
        opacity: 1,
        timing: { start: 0, duration: 60 },
        payload: { shape: "rectangle" },
        style: {
          fill: {
            type: "linear-gradient",
            angle: 20,
            stops: [
              { offset: 0, color: "#130c09" },
              { offset: 1, color: "#3a1712" },
            ],
          },
        },
      },
      {
        id: "historical-atmosphere",
        type: "image",
        parentLayerId: null,
        order: 1,
        frame: { width: 1920, height: 1080 },
        transform: transform({ x: 0, y: 0, z: 0 }, { width: 1920, height: 1080 }),
        opacity: 0.22,
        timing: { start: 0, duration: 60 },
        payload: { assetId: "three-kingdoms-atmosphere", fit: "cover" },
      },
      ...eventLayers,
    ],
  };
}

export function createV2EditorProject(
  projectId: string,
): MotionProtocolV2 {
  if (projectId === "three-kingdoms") {
    return createThreeKingdomsHistoryProject();
  }
  const isOverlap = projectId === "overlap";
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: `web-editor-${projectId}`,
    assets: [],
    audio: { sampleRate: 48000, tracks: [] },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view: ORTHOGRAPHIC_VIEW,
    },
    layers: isOverlap
      ? [
          shapeLayer({
            id: "back",
            order: 0,
            fill: "#00B894",
            width: 1200,
            height: 700,
            position: { x: 360, y: 190, z: 0 },
          }),
          shapeLayer({
            id: "front",
            order: 1,
            fill: "#FF3366",
            width: 760,
            height: 460,
            position: { x: 600, y: 340, z: 0 },
          }),
        ]
      : [
          shapeLayer({
            id: "shape",
            order: 0,
            fill: "#00B894",
            width: 960,
            height: 540,
            position: { x: 480, y: 270, z: 0 },
          }),
        ],
  };
}

export function isV2EditorProjectId(value: string): boolean {
  return value === "shape" || value === "overlap" || value === "three-kingdoms";
}
