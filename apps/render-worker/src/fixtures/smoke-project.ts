import { parseMotionProjectV3, type MotionProjectV3 } from "@motionvideo/motion-protocol";

/** Minimal text+preset project for render-worker e2e / benchmark (replaces template-library seed). */
export function createSmokeMotionProject(idSuffix?: string): MotionProjectV3 {
  const id = idSuffix ? `smoke_${idSuffix}` : `smoke_${Date.now()}`;
  return parseMotionProjectV3({
    format: "motion-project",
    formatVersion: 3,
    metadata: {
      id,
      name: "Smoke Export",
      locale: "vi-VN",
    },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#1A5D3A",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    scenes: [
      {
        id: "hook",
        name: "Hook",
        duration: 2,
        layers: [
          {
            id: "hook-text",
            type: "text",
            parentLayerId: null,
            zIndex: 0,
            transform: {
              x: 540,
              y: 960,
              width: 900,
              height: 180,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              anchorX: 0.5,
              anchorY: 0.5,
              opacity: 1,
              visible: true,
              flipX: false,
              flipY: false,
            },
            payload: {
              content: { kind: "plain", text: "Smoke hook" },
              fontSize: 64,
              color: "#FFFFFF",
              alignment: "center",
            },
          },
        ],
        clips: [
          {
            id: "clip.hook",
            layerId: "hook-text",
            schedule: { kind: "absolute", at: 0 },
            duration: 0.8,
            source: { kind: "preset", presetId: "fade-up" },
          },
        ],
      },
      {
        id: "offer",
        name: "Offer",
        duration: 2,
        layers: [
          {
            id: "offer-text",
            type: "text",
            parentLayerId: null,
            zIndex: 0,
            transform: {
              x: 540,
              y: 960,
              width: 900,
              height: 180,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              anchorX: 0.5,
              anchorY: 0.5,
              opacity: 1,
              visible: true,
              flipX: false,
              flipY: false,
            },
            payload: {
              content: { kind: "plain", text: "Smoke offer" },
              fontSize: 64,
              color: "#FFFFFF",
              alignment: "center",
            },
          },
        ],
        clips: [
          {
            id: "clip.offer",
            layerId: "offer-text",
            schedule: { kind: "absolute", at: 0 },
            duration: 0.6,
            source: { kind: "preset", presetId: "pop" },
          },
        ],
      },
      {
        id: "cta",
        name: "CTA",
        duration: 2,
        layers: [
          {
            id: "cta-text",
            type: "text",
            parentLayerId: null,
            zIndex: 0,
            transform: {
              x: 540,
              y: 960,
              width: 900,
              height: 180,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              anchorX: 0.5,
              anchorY: 0.5,
              opacity: 1,
              visible: true,
              flipX: false,
              flipY: false,
            },
            payload: {
              content: { kind: "plain", text: "Smoke CTA" },
              fontSize: 64,
              color: "#FFFFFF",
              alignment: "center",
            },
          },
        ],
        clips: [
          {
            id: "clip.cta",
            layerId: "cta-text",
            schedule: { kind: "absolute", at: 0 },
            duration: 0.6,
            source: { kind: "preset", presetId: "slide-up" },
          },
        ],
      },
    ],
    timeline: {
      visualTracks: [
        {
          id: "track.main",
          role: "main",
          order: 0,
          clips: [
            { id: "clip.scene.hook", source: { kind: "scene", sceneId: "hook" }, start: 0, duration: 2, opacity: 1, loop: false },
            { id: "clip.scene.offer", source: { kind: "scene", sceneId: "offer" }, start: 2, duration: 2, opacity: 1, loop: false },
            { id: "clip.scene.cta", source: { kind: "scene", sceneId: "cta" }, start: 4, duration: 2, opacity: 1, loop: false },
          ],
        },
      ],
      audioTracks: [],
      captionTracks: [],
    },
    bindings: [],
  });
}
