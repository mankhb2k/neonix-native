import { emptyProject } from "@/lib/docs/projects";

export type DocsVisualVariant = {
  id: string;
  label: string;
  snippet: unknown;
  project: unknown;
};

const TRANSFORM = {
  translate: { x: 0, y: 0 },
  rotate: { z: 0 },
  scale: { x: 1, y: 1 },
  skew: { x: 0, y: 0 },
  origin: { x: 0.5, y: 0.5 },
  depth: 0,
};

export const DOCS_ASSET_PHOTO_SQUARE = {
  id: "docs-photo-square",
  uri: "/docs/example1-1.jpg",
  integrity: "sha256:docs-example1-1",
  assetType: "image" as const,
  mimeType: "image/jpeg" as const,
  width: 1920,
  height: 1920,
};

export const DOCS_ASSET_PHOTO_WIDE = {
  id: "docs-photo-wide",
  uri: "/docs/example16-9.jpg",
  integrity: "sha256:docs-example16-9",
  assetType: "image" as const,
  mimeType: "image/jpeg" as const,
  width: 1920,
  height: 1080,
};

export const DOCS_ASSET_VIDEO = {
  id: "docs-video",
  uri: "/docs/example-video.mp4",
  integrity: "sha256:docs-example-video",
  assetType: "video" as const,
  mimeType: "video/mp4" as const,
  width: 1920,
  height: 1080,
  duration: 422.56,
  fps: 50,
};

export const DOCS_ASSET_TREE = {
  id: "docs-tree",
  uri: "/docs/example-image.svg",
  integrity: "sha256:docs-example-image-svg",
  assetType: "svg" as const,
  mimeType: "image/svg+xml" as const,
  width: 800,
  height: 800,
  viewBox: "0 -2 20 20",
  sanitized: true as const,
};

const STAGE_BG = "#121218";

function squareProject(id: string, name: string) {
  return {
    ...emptyProject(id, name),
    composition: {
      width: 1080,
      height: 1080,
      fps: 30,
      background: STAGE_BG,
      colorSpace: "srgb" as const,
    },
  };
}

function wideProject(id: string, name: string) {
  return {
    ...emptyProject(id, name),
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: STAGE_BG,
      colorSpace: "srgb" as const,
    },
  };
}

function treeLayer(opts: {
  origin?: { x: number; y: number };
  rotateZ?: number;
  translate?: { x: number; y: number };
  animations?: Array<{
    id: string;
    property: string;
    kind: "keyframes";
    keys: Array<{ t: number; value: number }>;
  }>;
}) {
  return {
    id: "tree",
    type: "svg" as const,
    parentLayerId: null,
    zIndex: 0,
    transform: {
      ...TRANSFORM,
      translate: opts.translate ?? { x: 540, y: 540 },
      origin: opts.origin ?? { x: 0.5, y: 0.5 },
      rotate: { z: opts.rotateZ ?? 0 },
    },
    frame: { width: 360, height: 360 },
    opacity: 100,
    timing: { start: 0, duration: 4 },
    payload: { assetId: DOCS_ASSET_TREE.id, fit: "contain" as const },
    ...(opts.animations ? { animations: opts.animations } : {}),
  };
}

function photoSquareLayer(opts: {
  scale?: { x: number; y: number };
  translate?: { x: number; y: number };
  frame?: { width: number; height: number };
}) {
  return {
    id: "photo",
    type: "image" as const,
    parentLayerId: null,
    zIndex: 0,
    transform: {
      ...TRANSFORM,
      translate: opts.translate ?? { x: 540, y: 540 },
      scale: opts.scale ?? { x: 1, y: 1 },
    },
    frame: opts.frame ?? { width: 400, height: 400 },
    opacity: 100,
    timing: { start: 0, duration: 4 },
    payload: { assetId: DOCS_ASSET_PHOTO_SQUARE.id, fit: "cover" as const },
  };
}

function photoWideLayer(frame: { width: number; height: number }) {
  return {
    id: "photo",
    type: "image" as const,
    parentLayerId: null,
    zIndex: 0,
    transform: {
      ...TRANSFORM,
      translate: { x: 960, y: 540 },
    },
    frame,
    opacity: 100,
    timing: { start: 0, duration: 4 },
    payload: { assetId: DOCS_ASSET_PHOTO_WIDE.id, fit: "cover" as const },
  };
}

function originProject(id: string, origin: { x: number; y: number }) {
  return {
    ...squareProject(id, `Origin ${origin.x},${origin.y}`),
    assets: [DOCS_ASSET_TREE],
    layers: [
      treeLayer({
        origin,
        animations: [
          {
            id: "rotate-z",
            property: "transform.rotate.z",
            kind: "keyframes",
            keys: [
              { t: 0, value: 0 },
              { t: 4, value: 360 },
            ],
          },
        ],
      }),
    ],
  };
}

function rotateProject(id: string, rotateZ: number) {
  return {
    ...squareProject(id, `Rotate ${rotateZ}`),
    assets: [DOCS_ASSET_TREE],
    layers: [treeLayer({ rotateZ })],
  };
}

function scaleProject(id: string, scale: { x: number; y: number }) {
  return {
    ...squareProject(id, `Scale ${scale.x},${scale.y}`),
    assets: [DOCS_ASSET_PHOTO_SQUARE],
    layers: [photoSquareLayer({ scale })],
  };
}

function translateProject(id: string, translate: { x: number; y: number }) {
  return {
    ...squareProject(id, `Translate ${translate.x},${translate.y}`),
    assets: [DOCS_ASSET_PHOTO_SQUARE],
    layers: [
      photoSquareLayer({
        translate,
        frame: { width: 320, height: 320 },
      }),
    ],
  };
}

function frameProject(id: string, frame: { width: number; height: number }) {
  return {
    ...wideProject(id, `Frame ${frame.width}x${frame.height}`),
    assets: [DOCS_ASSET_PHOTO_WIDE],
    layers: [photoWideLayer(frame)],
  };
}

export const ORIGIN_VARIANTS: DocsVisualVariant[] = [
  {
    id: "origin-tl",
    label: "0, 0",
    snippet: { transform: { origin: { x: 0, y: 0 } } },
    project: originProject("docs-origin-tl", { x: 0, y: 0 }),
  },
  {
    id: "origin-c",
    label: "0.5, 0.5",
    snippet: { transform: { origin: { x: 0.5, y: 0.5 } } },
    project: originProject("docs-origin-c", { x: 0.5, y: 0.5 }),
  },
  {
    id: "origin-br",
    label: "1, 1",
    snippet: { transform: { origin: { x: 1, y: 1 } } },
    project: originProject("docs-origin-br", { x: 1, y: 1 }),
  },
];

export const ROTATE_VARIANTS: DocsVisualVariant[] = [
  {
    id: "rotate-0",
    label: "rotate.z 0",
    snippet: { transform: { rotate: { z: 0 } } },
    project: rotateProject("docs-rotate-0", 0),
  },
  {
    id: "rotate-15",
    label: "rotate.z 15",
    snippet: { transform: { rotate: { z: 15 } } },
    project: rotateProject("docs-rotate-15", 15),
  },
  {
    id: "rotate-45",
    label: "rotate.z 45",
    snippet: { transform: { rotate: { z: 45 } } },
    project: rotateProject("docs-rotate-45", 45),
  },
];

export const SCALE_VARIANTS: DocsVisualVariant[] = [
  {
    id: "scale-1",
    label: "1, 1",
    snippet: { transform: { scale: { x: 1, y: 1 } } },
    project: scaleProject("docs-scale-1", { x: 1, y: 1 }),
  },
  {
    id: "scale-up",
    label: "1.4, 1.4",
    snippet: { transform: { scale: { x: 1.4, y: 1.4 } } },
    project: scaleProject("docs-scale-up", { x: 1.4, y: 1.4 }),
  },
  {
    id: "scale-flip",
    label: "-1, 1",
    snippet: { transform: { scale: { x: -1, y: 1 } } },
    project: scaleProject("docs-scale-flip", { x: -1, y: 1 }),
  },
];

export const TRANSLATE_VARIANTS: DocsVisualVariant[] = [
  {
    id: "translate-left",
    label: "x 220",
    snippet: { transform: { translate: { x: 220, y: 540 } } },
    project: translateProject("docs-translate-left", { x: 220, y: 540 }),
  },
  {
    id: "translate-center",
    label: "x 540",
    snippet: { transform: { translate: { x: 540, y: 540 } } },
    project: translateProject("docs-translate-center", { x: 540, y: 540 }),
  },
  {
    id: "translate-right",
    label: "x 860",
    snippet: { transform: { translate: { x: 860, y: 540 } } },
    project: translateProject("docs-translate-right", { x: 860, y: 540 }),
  },
];

export const FRAME_VARIANTS: DocsVisualVariant[] = [
  {
    id: "frame-square",
    label: "560 × 560",
    snippet: { frame: { width: 560, height: 560 } },
    project: frameProject("docs-frame-square", { width: 560, height: 560 }),
  },
  {
    id: "frame-wide",
    label: "800 × 450",
    snippet: { frame: { width: 800, height: 450 } },
    project: frameProject("docs-frame-wide", { width: 800, height: 450 }),
  },
  {
    id: "frame-strip",
    label: "960 × 240",
    snippet: { frame: { width: 960, height: 240 } },
    project: frameProject("docs-frame-strip", { width: 960, height: 240 }),
  },
];

export const ALL_VISUAL_PROJECTS: unknown[] = [
  ...ORIGIN_VARIANTS,
  ...ROTATE_VARIANTS,
  ...SCALE_VARIANTS,
  ...TRANSLATE_VARIANTS,
  ...FRAME_VARIANTS,
].map((item) => item.project);
