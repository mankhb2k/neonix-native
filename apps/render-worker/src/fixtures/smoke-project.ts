import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";

/** Minimal text+preset project for render-worker e2e / benchmark (replaces template-library seed). */
export function createSmokeMotionProject(idSuffix?: string): MotionProject {
  const id = idSuffix ? `smoke_${idSuffix}` : `smoke_${Date.now()}`;
  return parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id,
      name: "Smoke Export",
      aspectRatio: "9:16",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "MotiClip", primaryColor: "#1A5D3A", fontFamily: "Be Vietnam Pro" },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: { sceneOrder: ["hook", "offer", "cta"], audioTracks: [] },
    scenes: [
      {
        id: "hook",
        name: "Hook",
        duration: 2,
        nodes: [
          {
            id: "hook-text",
            type: "text",
            parentId: null,
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
              text: "Smoke hook",
              fontSize: 64,
              fontWeight: 600,
              align: "center",
            },
            style: { fill: "#FFFFFF" },
          },
        ],
        clips: [
          {
            id: "clip.hook",
            targetId: "hook-text",
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
        nodes: [
          {
            id: "offer-text",
            type: "text",
            parentId: null,
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
              text: "Smoke offer",
              fontSize: 64,
              fontWeight: 600,
              align: "center",
            },
            style: { fill: "#FFFFFF" },
          },
        ],
        clips: [
          {
            id: "clip.offer",
            targetId: "offer-text",
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
        nodes: [
          {
            id: "cta-text",
            type: "text",
            parentId: null,
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
              text: "Smoke CTA",
              fontSize: 64,
              fontWeight: 700,
              align: "center",
            },
            style: { fill: "#FFFFFF" },
          },
        ],
        clips: [
          {
            id: "clip.cta",
            targetId: "cta-text",
            schedule: { kind: "absolute", at: 0 },
            duration: 0.6,
            source: { kind: "preset", presetId: "slide-up" },
          },
        ],
      },
    ],
  });
}
