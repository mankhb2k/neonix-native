import { identityMatrix4, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export function createNativeExportSmokeProject(durationSeconds = 1): RuntimeProjectV3 {
  const duration = Math.max(1 / 30, durationSeconds);
  // Runtime node matrices are expressed in composition pixels. The renderer
  // consumes a world-to-clip matrix, so map those pixels back to the Skia
  // canvas during replay. Keeping this explicit makes the native command
  // benchmark and the CanvasKit control render the same geometry.
  const worldToClip = new Float64Array([
    2 / 1920, 0, 0, 0,
    0, -2 / 1080, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1,
  ]);
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: "native-export-smoke",
    durationUs: Math.round(duration * 1_000_000),
    visual: {
      composition: { width: 1920, height: 1080, fps: 30, duration, background: "#101827", graphId: "native-export-smoke" },
      view: { worldToClipMatrix: worldToClip },
      nodes: [
        {
          id: "background-card",
          parentId: null,
          order: 0,
          timing: { start: 0, duration },
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
          timing: { start: 0, duration },
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
          timing: { start: 0, duration },
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

export function createNativeColorCardProject(durationSeconds = 1): RuntimeProjectV3 {
  const duration = Math.max(1 / 30, durationSeconds);
  const worldToClip = new Float64Array([
    2 / 1920, 0, 0, 0,
    0, -2 / 1080, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1,
  ]);
  const colors = [
    "#000000", "#ffffff", "#808080", "#ff0000", "#00ff00", "#0000ff",
    "#00ffff", "#ff00ff", "#ffff00", "#101827", "#22d3ee", "#f97316",
    "#7c3aed", "#16a34a", "#dc2626", "#facc15", "#0f172a", "#e2e8f0",
    "#64748b", "#f43f5e", "#14b8a6", "#a855f7", "#fb7185", "#84cc16",
  ];
  const patchWidth = 260;
  const patchHeight = 180;
  const patches = colors.map((fill, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: `color-card-${index}`,
      parentId: null,
      order: index + 1,
      timing: { start: 0, duration },
      opacity: 1,
      visible: true,
      localMatrix: identityMatrix4(),
      worldMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 60 + column * 300, 100 + row * 220, 0, 1]),
      content: { kind: "shape" as const, shape: "rectangle" as const, width: patchWidth, height: patchHeight, fill },
    };
  });
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: "native-color-card",
    durationUs: Math.round(duration * 1_000_000),
    visual: {
      composition: { width: 1920, height: 1080, fps: 30, duration, background: "#202020", graphId: "native-color-card" },
      view: { worldToClipMatrix: worldToClip },
      nodes: [
        {
          id: "color-card-background",
          parentId: null,
          order: 0,
          timing: { start: 0, duration },
          opacity: 1,
          visible: true,
          localMatrix: identityMatrix4(),
          worldMatrix: identityMatrix4(),
          content: { kind: "shape", shape: "rectangle", width: 1920, height: 1080, fill: "#202020" },
        },
        ...patches,
      ],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
  };
}

type ColorSuiteTest = "primary" | "memory" | "grayscale" | "alpha" | "chroma" | "stride";

function suiteNode(
  id: string,
  order: number,
  duration: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  options: { opacity?: number; fillOpacity?: number; cornerRadius?: number; stroke?: string; strokeWidth?: number; shape?: "rectangle" | "ellipse" } = {},
) {
  return {
    id,
    parentId: null,
    order,
    timing: { start: 0, duration },
    opacity: options.opacity ?? 1,
    visible: true,
    localMatrix: identityMatrix4(),
    worldMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1]),
    content: {
      kind: "shape" as const,
      shape: options.shape ?? "rectangle",
      width,
      height,
      fill,
      fillOpacity: options.fillOpacity,
      cornerRadius: options.cornerRadius,
      stroke: options.stroke,
      strokeWidth: options.strokeWidth,
    },
  };
}

/**
 * Static 1080p color fixtures used by the PNG and MP4 color contract suite.
 * The stride case is intentionally paired with the native converter stride
 * test; this scene itself remains even-sized so it can be encoded as yuv420p.
 */
export function createNativeColorSuiteProject(test: ColorSuiteTest, durationSeconds = 5): RuntimeProjectV3 {
  const duration = Math.max(1 / 30, durationSeconds);
  const worldToClip = new Float64Array([
    2 / 1920, 0, 0, 0,
    0, -2 / 1080, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1,
  ]);
  const nodes = [suiteNode("background", 0, duration, 0, 0, 1920, 1080, test === "alpha" ? "#808080" : "#202020")];
  let order = 1;
  if (test === "primary") {
    const colors = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"];
    colors.forEach((fill, index) => nodes.push(suiteNode(`primary-${index}`, order++, duration, 80 + index * 360, 360, 320, 360, fill)));
  } else if (test === "memory") {
    const colors = ["#f6c7a8", "#c68642", "#8d5524", "#4a2c20", "#36a852", "#4aa3df", "#f4d35e", "#d9d9d9"];
    colors.forEach((fill, index) => nodes.push(suiteNode(`memory-${index}`, order++, duration, 100 + (index % 4) * 450, 180 + Math.floor(index / 4) * 380, 360, 280, fill, { cornerRadius: 28 })));
  } else if (test === "grayscale") {
    for (let index = 0; index < 16; index += 1) {
      const value = Math.round(index * 255 / 15).toString(16).padStart(2, "0");
      nodes.push(suiteNode(`gray-${index}`, order++, duration, 48 + index * 114, 360, 100, 360, `#${value}${value}${value}`));
    }
  } else if (test === "alpha") {
    nodes.push(suiteNode("alpha-white-half", order++, duration, 960, 0, 960, 1080, "#ffffff"));
    nodes.push(suiteNode("alpha-red-black", order++, duration, 280, 180, 520, 520, "#ff0000", { fillOpacity: 0.5, cornerRadius: 80, stroke: "#ffffff", strokeWidth: 10 }));
    nodes.push(suiteNode("alpha-blue-white", order++, duration, 1120, 180, 520, 520, "#0000ff", { fillOpacity: 0.5, cornerRadius: 80, stroke: "#000000", strokeWidth: 10 }));
    nodes.push(suiteNode("alpha-green-black", order++, duration, 280, 760, 520, 180, "#00ff00", { fillOpacity: 0.5, cornerRadius: 40 }));
    nodes.push(suiteNode("alpha-magenta-white", order++, duration, 1120, 760, 520, 180, "#ff00ff", { fillOpacity: 0.5, cornerRadius: 40 }));
  } else if (test === "chroma") {
    for (let index = 0; index < 24; index += 1) {
      nodes.push(suiteNode(`chroma-stripe-${index}`, order++, duration, 40 + index * 80, 180, 80, 720, index % 2 === 0 ? "#ff0000" : "#0000ff"));
    }
    nodes.push(suiteNode("chroma-white-line", order++, duration, 40, 920, 1840, 8, "#ffffff"));
    nodes.push(suiteNode("chroma-green-line", order++, duration, 40, 960, 1840, 8, "#00ff00"));
  } else {
    for (let index = 0; index < 8; index += 1) {
      nodes.push(suiteNode(`stride-${index}`, order++, duration, 80 + (index % 4) * 460, 180 + Math.floor(index / 4) * 420, 360, 300, index % 2 === 0 ? "#ff0000" : "#0000ff", { cornerRadius: 17, stroke: "#ffffff", strokeWidth: 3 }));
    }
  }
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: `native-color-suite-${test}`,
    durationUs: Math.round(duration * 1_000_000),
    visual: {
      composition: { width: 1920, height: 1080, fps: 30, duration, background: "#202020", graphId: `native-color-suite-${test}` },
      view: { worldToClipMatrix: worldToClip },
      nodes,
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
  };
}
