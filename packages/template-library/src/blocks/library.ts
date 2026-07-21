import { AUDIO_BLOCKS } from "./audio";
import { CAMERA_BLOCKS } from "./camera";
import { CHARACTER_BLOCKS } from "./character";
import { CHART_BLOCKS } from "./chart";
import { EFFECTS_BLOCKS } from "./effects";
import { EMPHASIS_BLOCKS } from "./emphasis";
import { ENTRANCE_BLOCKS, ENTRANCE_CORE_BLOCKS } from "./entrance";
import { EXIT_BLOCKS } from "./exit";
import { MEDIA_BLOCKS } from "./media";
import { SHAPE_BLOCKS } from "./shape";
import { TEXT_BLOCKS } from "./text";
import { TIMING_DEFAULTS, TIMING_FIELDS } from "./timing";
import { TRANSFORM_BLOCKS } from "./transform";
import { TRANSITION_BLOCKS } from "./transition";
import type { MotionBlock, MotionLibrarySection } from "./types";

/**
 * Motion Library shelf order (matches product tree).
 * Timing is schema-only — no blocks.
 * Emphasis re-indexes text.highlight (same id, not duplicated in catalog).
 */
export const motionLibrary: MotionLibrarySection[] = [
  {
    id: "text",
    title: "Text",
    titleVi: "Chữ",
    description:
      "Motion chỉ chữ: typewriter, stagger-words, highlight, counter (vi-safe).",
    isBlockShelf: true,
    blocks: TEXT_BLOCKS,
  },
  {
    id: "shape",
    title: "Shape",
    titleVi: "Hình",
    description: "Draw line, bar grow, progress, shape enter — sắp mở.",
    isBlockShelf: true,
    blocks: SHAPE_BLOCKS,
  },
  {
    id: "media",
    title: "Media",
    titleVi: "Media",
    description: "Ảnh / video / Lottie — sắp mở.",
    isBlockShelf: true,
    blocks: MEDIA_BLOCKS,
  },
  {
    id: "chart",
    title: "Chart",
    titleVi: "Biểu đồ",
    description: "Bar / line / pie motion — sắp mở.",
    isBlockShelf: true,
    blocks: CHART_BLOCKS,
  },
  {
    id: "character",
    title: "Character",
    titleVi: "Nhân vật",
    description: "Character 2D — pha sau.",
    isBlockShelf: true,
    blocks: CHARACTER_BLOCKS,
  },
  {
    id: "camera",
    title: "Camera",
    titleVi: "Camera",
    description: "Hero zoom, Ken Burns, focus — sắp mở.",
    isBlockShelf: true,
    blocks: CAMERA_BLOCKS,
  },
  {
    id: "entrance",
    title: "Entrance",
    titleVi: "Vào khung",
    description: "Fade / slide / scale / pop / flip + typewriter.",
    isBlockShelf: true,
    blocks: ENTRANCE_BLOCKS,
  },
  {
    id: "exit",
    title: "Exit",
    titleVi: "Ra khung",
    description: "Fade out, scale out, slide out — sắp mở.",
    isBlockShelf: true,
    blocks: EXIT_BLOCKS,
  },
  {
    id: "emphasis",
    title: "Emphasis",
    titleVi: "Nhấn mạnh",
    description: "Highlight (text) + pulse/shake sắp mở.",
    isBlockShelf: true,
    blocks: EMPHASIS_BLOCKS,
  },
  {
    id: "transform",
    title: "Transform",
    titleVi: "Biến đổi",
    description:
      "Primitive engine (move/scale/rotate…) — không shelf block MVP.",
    isBlockShelf: true,
    blocks: TRANSFORM_BLOCKS,
  },
  {
    id: "transition",
    title: "Transition",
    titleVi: "Chuyển cảnh",
    description: "Crossfade, swipe, push — sắp mở.",
    isBlockShelf: true,
    blocks: TRANSITION_BLOCKS,
  },
  {
    id: "timing",
    title: "Timing",
    titleVi: "Nhịp",
    description: `Schema chung: ${TIMING_FIELDS.join(", ")}. Default easing=${TIMING_DEFAULTS.easing}.`,
    isBlockShelf: false,
    blocks: [],
  },
  {
    id: "audio",
    title: "Audio",
    titleVi: "Âm thanh",
    description: "SFX / ducking — pha sau.",
    isBlockShelf: true,
    blocks: AUDIO_BLOCKS,
  },
  {
    id: "effects",
    title: "Effects",
    titleVi: "Hiệu ứng",
    description: "Blur, glow, particles — pha sau.",
    isBlockShelf: true,
    blocks: EFFECTS_BLOCKS,
  },
];

function uniqueBlocks(lists: MotionBlock[][]): MotionBlock[] {
  const map = new Map<string, MotionBlock>();
  for (const list of lists) {
    for (const block of list) {
      if (!map.has(block.id)) map.set(block.id, block);
    }
  }
  return [...map.values()];
}

/** Deduped shelf for AI / engine (each id once). */
export const motionBlocks: MotionBlock[] = uniqueBlocks([
  ENTRANCE_CORE_BLOCKS,
  TEXT_BLOCKS,
  SHAPE_BLOCKS,
  MEDIA_BLOCKS,
  CHART_BLOCKS,
  CHARACTER_BLOCKS,
  CAMERA_BLOCKS,
  EXIT_BLOCKS,
  TRANSFORM_BLOCKS,
  TRANSITION_BLOCKS,
  AUDIO_BLOCKS,
  EFFECTS_BLOCKS,
]);
