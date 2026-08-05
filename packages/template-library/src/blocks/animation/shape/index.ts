import type { MotionBlock } from "../../types";

function shapeAnim(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  previewClass: string,
  duration: number,
): MotionBlock {
  return {
    id: `shape.${role}`,
    name,
    nameVi,
    family: "animation",
    kind: "shape",
    intent: "shape-animation",
    shelf: "shape-animation",
    description: `${description} Preview-only until COMPILED_PRESET_IDS.`,
    duration,
    durationMin: Math.max(0.3, duration * 0.5),
    durationMax: Math.max(duration * 2, 2),
    tags: ["animation", "shape-animation", role, "preview"],
    sampleText: "",
    previewClass,
  };
}

export const SHAPE_DRAW_LINE = shapeAnim(
  "draw-line",
  "Draw Line",
  "Vẽ đường",
  "Stroke length 0→100% — connector / timeline.",
  "mv-block-shape-anim-draw-line",
  0.9,
);

export const SHAPE_BAR_GROW = shapeAnim(
  "bar-grow",
  "Bar Grow",
  "Cột mọc",
  "ScaleY 0→1 từ đáy — bar chart.",
  "mv-block-shape-anim-bar-grow",
  0.8,
);

export const SHAPE_PROGRESS_FILL = shapeAnim(
  "progress-fill",
  "Progress Fill",
  "Thanh đầy",
  "Fill width 0→N% — progress bar / data.progress.",
  "mv-block-shape-anim-progress-fill",
  1,
);

export const SHAPE_FADE = shapeAnim(
  "fade",
  "Shape Fade",
  "Hình hiện mờ",
  "Fade opacity cho shape/icon nền.",
  "mv-block-shape-anim-fade",
  0.45,
);

export const SHAPE_ANIMATION_BLOCKS: MotionBlock[] = [
  SHAPE_DRAW_LINE,
  SHAPE_BAR_GROW,
  SHAPE_PROGRESS_FILL,
  SHAPE_FADE,
];
