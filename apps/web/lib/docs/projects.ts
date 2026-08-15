import { MOTION_PROTOCOL_LIMITS } from "@motionvideo/motion-protocol";

const transform = {
  translate: { x: 0, y: 0 },
  rotate: { z: 0 },
  scale: { x: 1, y: 1 },
  skew: { x: 0, y: 0 },
  origin: { x: 0.5, y: 0.5 },
  depth: 0,
};

export function emptyProject(id: string, name: string) {
  return {
    format: "motion-project" as const,
    formatVersion: 1 as const,
    metadata: { id, name, locale: "vi-VN" },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb" as const,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [] as unknown[],
    components: [] as unknown[],
    timeline: { duration: 6 },
    bindings: [] as unknown[],
    layers: [] as unknown[],
  };
}

export const MINIMAL_EMPTY = emptyProject("docs-minimal-empty", "Minimal empty");

export const SINGLE_ROOT = {
  ...emptyProject("docs-single-root", "Single root text"),
  timeline: { duration: 5 },
  layers: [
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 0,
      transform: {
        ...transform,
        translate: { x: 960, y: 540 },
      },
      frame: { width: 800, height: 120 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 5 },
      payload: {
        text: "Hello MotiClip" ,
        fontSize: 64,
        color: "#000000",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
  ],
};

export const DEPTH_DEMO = {
  ...emptyProject("docs-depth-demo", "Depth demo"),
  layers: [
    {
      id: "bg",
      type: "solid",
      parentLayerId: null,
      zIndex: 0,
      transform: { ...transform, depth: -200 },
      frame: { width: 1920, height: 1080 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 6 },
      payload: { color: "#e8eef5" },
    },
    {
      id: "photo",
      type: "solid",
      parentLayerId: null,
      zIndex: 1,
      transform: {
        ...transform,
        translate: { x: 960, y: 540 },
        depth: 120,
      },
      frame: { width: 640, height: 360 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 1, duration: 4 },
      payload: { color: "#0d9488" },
    },
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 2,
      transform: {
        ...transform,
        translate: { x: 960, y: 200 },
      },
      frame: { width: 900, height: 80 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 1, duration: 3 },
      payload: {
        text: "Parallax title" ,
        fontSize: 48,
        color: "#0f1419",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
  ],
};

export const AUDIO_FADE = {
  ...emptyProject("docs-audio-fade", "Audio with fade"),
  assets: [
    {
      id: "bgm",
      uri: "./assets/audio/background.mp3",
      integrity: "sha256:docs-bgm",
      assetType: "audio",
      mimeType: "audio/mpeg",
      duration: 30,
      codec: "mp3",
      sampleRate: 48000,
      channels: 2,
    },
  ],
  layers: [
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 0,
      transform: {
        ...transform,
        translate: { x: 960, y: 540 },
      },
      frame: { width: 800, height: 120 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 6 },
      payload: {
        text: "With music" ,
        fontSize: 56,
        color: "#0f1419",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
    {
      id: "music",
      type: "audio",
      parentLayerId: null,
      zIndex: -1,
      timing: { start: 0, duration: 6 },
      payload: {
        assetId: "bgm",
        volume: 80,
        fadeIn: 0.5,
        fadeOut: 0.5,
      },
    },
  ],
};

export const INVALID_TRANSFORM_Z = {
  ...emptyProject("docs-invalid-z", "Invalid transform.z"),
  layers: [
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 0,
      transform: { z: 100 },
      frame: { width: 200, height: 80 },
      timing: { start: 0, duration: 3 },
      payload: {
        text: "nope" ,
        fontSize: 32,
        color: "#000000",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
  ],
};

export const INVALID_FORMAT_VERSION = {
  ...MINIMAL_EMPTY,
  metadata: { ...MINIMAL_EMPTY.metadata, id: "docs-bad-version" },
  formatVersion: 2,
};

export const INVALID_EXTRA_KEY = {
  ...MINIMAL_EMPTY,
  metadata: { ...MINIMAL_EMPTY.metadata, id: "docs-extra-key" },
  scenes: [],
};

export const INVALID_DUPLICATE_ID = {
  ...emptyProject("docs-dup-id", "Duplicate layer id"),
  timeline: { duration: 3 },
  layers: [
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 0,
      transform,
      frame: { width: 200, height: 80 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 3 },
      payload: {
        text: "A" ,
        fontSize: 32,
        color: "#000000",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
    {
      id: "title",
      type: "text",
      parentLayerId: null,
      zIndex: 1,
      transform,
      frame: { width: 200, height: 80 },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 3 },
      payload: {
        text: "B" ,
        fontSize: 32,
        color: "#000000",
        alignment: "center",
        wrap: "word",
        overflow: "visible",
      },
    },
  ],
};

export const INVALID_MISSING_REF = {
  ...emptyProject("docs-missing-ref", "Missing asset ref"),
  layers: [
    {
      id: "photo",
      type: "image",
      parentLayerId: null,
      zIndex: 0,
      transform,
      frame: { width: 200, height: 200 },
      timing: { start: 0, duration: 3 },
      payload: { assetId: "does-not-exist" },
    },
  ],
};

export const DEPTH_LIMIT = MOTION_PROTOCOL_LIMITS.zPositionRange;
