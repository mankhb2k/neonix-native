import {
  parseMotionProjectV1,
  visualLayerAtoms,
  type MotionProjectV1,
} from "@motionvideo/motion-protocol";

/** Layers-only HUD card used by compiler / Pixi / worker / editor preview tests. */
export function createNeonEffectsPreviewProject(): MotionProjectV1 {
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "proj_neon_effects_preview",
      name: "Neon effects preview",
      locale: "vi-VN",
    },
    composition: {
      width: 400,
      height: 240,
      fps: 30,
      background: "#07090f",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {
      required: [
        "primitive.shape",
        "effect.glow",
        "effect.inner-glow",
        "effect.noise",
      ],
    },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    timeline: { duration: 2 },
    bindings: [],
    layers: [
      {
        id: "hud-card",
        type: "shape",
        name: "HUD card",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...visualLayerAtoms({
          x: 80,
          y: 50,
          width: 240,
          height: 140,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0,
          originY: 0,
          opacity: 100,
          visible: true,
        }),
        payload: { shape: "rectangle", cornerRadius: 16 },
        style: { fill: "#121218", stroke: "#22d3ee", strokeWidth: 2 },
        effects: [
          {
            id: "fx-glow-1",
            type: "glow",
            radius: 18,
            color: "#22d3ee",
            opacity: 70,
          },
          {
            id: "fx-inner-glow-1",
            type: "inner-glow",
            radius: 18,
            color: "#A855FF",
            opacity: 80,
          },
          {
            id: "fx-noise-1",
            type: "noise",
            amount: 12,
            scale: 1,
            opacity: 28,
            animated: false,
          },
        ],
      },
    ],
  });
}
