import { parseMotionProjectV1, type MotionProjectV1 } from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";

function textLayer(
  id: string,
  text: string,
  zIndex: number,
  start: number,
  duration: number,
) {
  return {
    id,
    type: "text" as const,
    parentLayerId: null,
    zIndex,
    timing: { start, duration },
    ...visualLayerAtoms({ x: 540, y: 960, width: 900, height: 180, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
    payload: {
      content: { kind: "plain" as const, text },
      fontSize: 64,
      color: "#FFFFFF",
      alignment: "center" as const,
    },
  };
}

/** Minimal layers-only V1 project for render-worker e2e / benchmark. */
export function createSmokeMotionProject(idSuffix?: string): MotionProjectV1 {
  const id = idSuffix ? `smoke_${idSuffix}` : `smoke_${Date.now()}`;
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
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
    timeline: {},
    bindings: [],
    layers: [
      textLayer("hook-text", "Smoke hook", 0, 0, 2),
      textLayer("offer-text", "Smoke offer", 1, 2, 2),
      textLayer("cta-text", "Smoke CTA", 2, 4, 2),
    ],
  });
}
