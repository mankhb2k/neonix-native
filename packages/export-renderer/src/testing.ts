import { identityMatrix4, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export function createNativeExportSmokeProject(): RuntimeProjectV3 {
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: "native-export-smoke",
    visual: {
      composition: { width: 1920, height: 1080, fps: 30, duration: 1, background: "#101827", graphId: "native-export-smoke" },
      view: { worldToClipMatrix: identityMatrix4() },
      nodes: [
        {
          id: "background-card",
          parentId: null,
          order: 0,
          timing: { start: 0, duration: 1 },
          opacity: 1,
          visible: true,
          localMatrix: identityMatrix4(),
          worldMatrix: identityMatrix4(),
          content: { kind: "shape", shape: "rectangle", width: 1920, height: 1080, fill: "#101827" },
        },
        {
          id: "accent",
          parentId: null,
          order: 1,
          timing: { start: 0, duration: 1 },
          opacity: 1,
          visible: true,
          localMatrix: identityMatrix4(),
          worldMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 168, 192, 0, 1]),
          content: { kind: "shape", shape: "ellipse", width: 576, height: 576, fill: "#22d3ee", fillOpacity: 0.9 },
        },
        {
          id: "panel",
          parentId: null,
          order: 2,
          timing: { start: 0, duration: 1 },
          opacity: 0.92,
          visible: true,
          localMatrix: identityMatrix4(),
          worldMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 492, 348, 0, 1]),
          content: { kind: "shape", shape: "rectangle", width: 1080, height: 384, cornerRadius: 72, fill: "#172554", stroke: "#60a5fa", strokeWidth: 12 },
        },
      ],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
  };
}
