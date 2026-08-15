/**
 * Clip-mask authoring fixtures (Illustrator-style `mode: "clip"`).
 * 400×400 white composition; artwork is a solid color; clip source is an ellipse.
 */

import { visualLayerAtoms } from "../../layer-atoms";

export const CLIP_MASK_SIZE = 400;
export const CLIP_ARTWORK_COLOR = "#cc0000";
export const CLIP_SIBLING_COLOR = "#00aa00";
export const CLIP_BACKGROUND = "#ffffff";

function t(x: number, y: number, width: number, height: number) {
  return visualLayerAtoms({
    x,
    y,
    width,
    height,
    originX: 0,
    originY: 0,
  });
}

const ROOT_TIMING = { start: 0, duration: 1 };

function withLayerTiming(layer: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...layer,
    timing: layer.timing ?? ROOT_TIMING,
  };
  if (Array.isArray(next.children)) {
    next.children = next.children.map((child) =>
      withLayerTiming(child as Record<string, unknown>),
    );
  }
  return next;
}

function clipEllipse(parentLayerId: string | null, zIndex: number) {
  return {
    id: "clip-src",
    type: "shape" as const,
    parentLayerId,
    zIndex,
    ...t(100, 100, 200, 200),
    payload: { shape: "ellipse" as const },
    style: { fill: "#0000ff" },
  };
}

function clipMask(sourceLayerId = "clip-src") {
  return {
    sourceLayerId,
    mode: "clip" as const,
    "source-visibility": "mask-only" as const,
  };
}

function projectShell(
  id: string,
  layers: unknown[],
  extras: Record<string, unknown> = {},
) {
  const components = Array.isArray(extras.components)
    ? extras.components.map((component) => {
        if (!component || typeof component !== "object") return component;
        const next = { ...(component as Record<string, unknown>) };
        if (Array.isArray(next.layers)) {
          next.layers = next.layers.map((layer) =>
            withLayerTiming(layer as Record<string, unknown>),
          );
        }
        return next;
      })
    : extras.components ?? [];
  return {
    format: "motion-project" as const,
    formatVersion: 1 as const,
    metadata: { id, name: id, locale: "vi-VN" },
    composition: {
      width: CLIP_MASK_SIZE,
      height: CLIP_MASK_SIZE,
      fps: 30,
      background: CLIP_BACKGROUND,
      colorSpace: "srgb" as const,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: extras.assets ?? [],
    components,
    timeline: { duration: 1 },
    bindings: [],
    layers: (layers as Array<Record<string, unknown>>).map(withLayerTiming),
  };
}

const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function mediaAsset(id: string, assetType: "image" | "svg" | "video") {
  if (assetType === "video") {
    return {
      id,
      assetType,
      mimeType: "video/mp4",
      uri: "file://clip-mask.mp4",
      width: 400,
      height: 400,
      duration: 1,
      fps: 30,
    };
  }
  if (assetType === "svg") {
    return {
      id,
      assetType,
      mimeType: "image/svg+xml",
      uri: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23cc0000'/></svg>",
      width: 400,
      height: 400,
    };
  }
  return {
    id,
    assetType,
    mimeType: "image/png",
    uri: PIXEL_PNG,
    width: 400,
    height: 400,
  };
}

export type ClipMaskKind =
  | "group"
  | "text"
  | "shape"
  | "path"
  | "solid"
  | "image"
  | "svg"
  | "video"
  | "component";

function artworkLayer(
  kind: ClipMaskKind,
  parentLayerId: string | null,
  zIndex: number,
  mask?: ReturnType<typeof clipMask>,
) {
  const base = {
    id: "artwork",
    parentLayerId,
    zIndex,
    ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
    ...(mask ? { compositing: { mask } } : {}),
  };
  switch (kind) {
    case "text":
      return {
        ...base,
        type: "text",
        payload: {
          content: { kind: "plain", text: "MASK" },
          fontSize: 120,
          color: CLIP_ARTWORK_COLOR,
          alignment: "center",
        },
      };
    case "shape":
      return {
        ...base,
        type: "shape",
        payload: { shape: "rectangle" },
        style: { fill: CLIP_ARTWORK_COLOR },
      };
    case "path":
      return {
        ...base,
        type: "path",
        payload: {
          contours: [
            {
              id: "art-contour",
              start: { x: 0, y: 0 },
              closed: true,
              segments: [
                { kind: "line", to: { x: 400, y: 0 } },
                { kind: "line", to: { x: 400, y: 400 } },
                { kind: "line", to: { x: 0, y: 400 } },
              ],
            },
          ],
        },
        style: { fill: CLIP_ARTWORK_COLOR },
      };
    case "solid":
      return {
        ...base,
        type: "solid",
        payload: {
          color: CLIP_ARTWORK_COLOR,
        },
      };
    case "image":
      return {
        ...base,
        type: "image",
        payload: { assetId: "art-asset" },
      };
    case "svg":
      return {
        ...base,
        type: "svg",
        payload: { assetId: "art-asset" },
      };
    case "video":
      return {
        ...base,
        type: "video",
        payload: { assetId: "art-asset" },
      };
    case "component":
      return {
        ...base,
        type: "component",
        payload: { componentId: "art-comp", props: {} },
      };
    case "group":
      return {
        ...base,
        type: "group",
        children: [
          {
            id: "artwork-child",
            type: "solid",
            parentLayerId: "artwork",
            zIndex: 0,
            ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
            payload: {
              color: CLIP_ARTWORK_COLOR,
            },
          },
        ],
      };
    default:
      return { ...base, type: "solid", payload: { color: CLIP_ARTWORK_COLOR } };
  }
}

function mediaAssetsFor(kind: ClipMaskKind) {
  if (kind === "image") return [mediaAsset("art-asset", "image")];
  if (kind === "svg") return [mediaAsset("art-asset", "svg")];
  if (kind === "video") return [mediaAsset("art-asset", "video")];
  return [];
}

function componentDefs() {
  return [
    {
      id: "art-comp",
      version: "1.0.0",
      integrity: "sha256:art-comp",
      props: [],
      variants: [],
      propBindings: [],
      variables: [],
      layers: [
        {
          id: "comp-fill",
          type: "solid",
          parentLayerId: null,
          zIndex: 0,
          ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
          payload: {
            color: CLIP_ARTWORK_COLOR,
          },
        },
      ],
    },
  ];
}

/** Mask on the named target kind; ellipse clip source is a sibling. */
export function clipMaskTargetProject(kind: ClipMaskKind) {
  const artwork = artworkLayer(kind, null, 1, clipMask());
  const clip = clipEllipse(null, 2);
  return projectShell(`clip-mask-target-${kind}`, [artwork, clip], {
    assets: mediaAssetsFor(kind),
    components: kind === "component" ? componentDefs() : [],
  });
}

/**
 * Mask on a group: children are clipped; sibling outside the group is not.
 */
export function clipMaskGroupIsolationProject() {
  const sibling = {
    id: "sibling",
    type: "solid" as const,
    parentLayerId: null,
    zIndex: 0,
    ...t(0, 0, 80, 80),
    payload: { color: CLIP_SIBLING_COLOR },
  };
  const group = artworkLayer("group", null, 1, clipMask());
  const clip = clipEllipse(null, 2);
  return projectShell("clip-mask-group-isolation", [sibling, group, clip]);
}

/**
 * Mask on a child only: sibling in the same group is not clipped.
 */
export function clipMaskChildIsolationProject() {
  const group = {
    id: "frame",
    type: "group" as const,
    parentLayerId: null,
    zIndex: 0,
    ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
    children: [
      {
        id: "artwork",
        type: "solid" as const,
        parentLayerId: "frame",
        zIndex: 0,
        ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
        compositing: { mask: clipMask() },
        payload: {
          color: CLIP_ARTWORK_COLOR,
        },
      },
      {
        id: "sibling",
        type: "solid" as const,
        parentLayerId: "frame",
        zIndex: 1,
        ...t(0, 0, 80, 80),
        payload: { color: CLIP_SIBLING_COLOR },
      },
      clipEllipse("frame", 2),
    ],
  };
  return projectShell("clip-mask-child-isolation", [group]);
}

/** Component internals: fill is masked by an internal ellipse. */
export function clipMaskComponentInternalProject() {
  const components = [
    {
      id: "masked-comp",
      version: "1.0.0",
      integrity: "sha256:masked-comp",
      props: [],
      variants: [],
      propBindings: [],
      variables: [],
      layers: [
        {
          id: "comp-fill",
          type: "solid",
          parentLayerId: null,
          zIndex: 0,
          ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
          compositing: { mask: clipMask("comp-clip") },
          payload: {
            color: CLIP_ARTWORK_COLOR,
          },
        },
        {
          id: "comp-clip",
          type: "shape",
          parentLayerId: null,
          zIndex: 1,
          ...t(100, 100, 200, 200),
          payload: { shape: "ellipse" },
          style: { fill: "#0000ff" },
        },
      ],
    },
  ];
  const instance = {
    id: "cta",
    type: "component" as const,
    parentLayerId: null,
    zIndex: 0,
    ...t(0, 0, CLIP_MASK_SIZE, CLIP_MASK_SIZE),
    payload: { componentId: "masked-comp", props: {} },
  };
  return projectShell("clip-mask-component-internal", [instance], {
    components,
  });
}

export const CLIP_MASK_TARGET_KINDS: ClipMaskKind[] = [
  "group",
  "text",
  "shape",
  "path",
  "solid",
  "image",
  "svg",
  "video",
  "component",
];
