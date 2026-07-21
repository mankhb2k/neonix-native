import {
  CAMERA_PRESET_BLOCKS,
  EMPHASIS_BLOCKS,
  ENTRANCE_BLOCKS,
  ENTRANCE_CORE_BLOCKS,
  EXIT_BLOCKS,
  NUMBER_ANIMATION_BLOCKS,
  SHAPE_ANIMATION_BLOCKS,
  TEXT_ANIMATION_BLOCKS,
  TIMING_DEFAULTS,
  TIMING_FIELDS,
  TRANSFORM_BLOCKS,
  TRANSITION_BLOCKS,
} from "./animation";
import {
  CHARACTER_BLOCKS,
  CONTAINER_BLOCKS,
  CONTENT_CAMERA_BLOCKS,
  DATA_BLOCKS,
  MEDIA_BLOCKS,
  SHAPE_BLOCKS,
  TEXT_BLOCKS,
} from "./content";
import type { MotionBlock, MotionLibrarySection } from "./types";

/**
 * Library shelves:
 *   content/  — Text, Shape, Media, Container, Data, Character, Camera
 *   animation/ — Entrance, Exit, Emphasis, Transform, Text/Number/Shape Animation,
 *                Transition, Camera Presets, Timing
 */
export const motionLibrary: MotionLibrarySection[] = [
  // —— Content ——
  {
    id: "text",
    family: "content",
    title: "Text",
    titleVi: "Chữ",
    description: "Loại chữ tĩnh: title, subtitle, number, CTA…",
    isBlockShelf: true,
    blocks: TEXT_BLOCKS,
  },
  {
    id: "shape",
    family: "content",
    title: "Shape",
    titleVi: "Hình",
    description: "Rect, circle, line, arrow…",
    isBlockShelf: true,
    blocks: SHAPE_BLOCKS,
  },
  {
    id: "media",
    family: "content",
    title: "Media",
    titleVi: "Media",
    description: "Image, icon, SVG, Lottie…",
    isBlockShelf: true,
    blocks: MEDIA_BLOCKS,
  },
  {
    id: "container",
    family: "content",
    title: "Container",
    titleVi: "Khung nhóm",
    description: "Card, stack, grid, background…",
    isBlockShelf: true,
    blocks: CONTAINER_BLOCKS,
  },
  {
    id: "data",
    family: "content",
    title: "Data",
    titleVi: "Dữ liệu",
    description: "Bar/pie/progress/comparison — infographic.",
    isBlockShelf: true,
    blocks: DATA_BLOCKS,
  },
  {
    id: "character",
    family: "content",
    title: "Character",
    titleVi: "Nhân vật",
    description: "Person, device, chat — pha sau.",
    isBlockShelf: true,
    blocks: CHARACTER_BLOCKS,
  },
  {
    id: "camera",
    family: "content",
    title: "Camera",
    titleVi: "Camera",
    description: "Shot/frame content placeholder — pha sau.",
    isBlockShelf: true,
    blocks: CONTENT_CAMERA_BLOCKS,
  },
  // —— Animation ——
  {
    id: "entrance",
    family: "animation",
    title: "Entrance",
    titleVi: "Vào khung",
    description: "Fade / slide / scale / pop / flip…",
    isBlockShelf: true,
    blocks: ENTRANCE_BLOCKS,
  },
  {
    id: "exit",
    family: "animation",
    title: "Exit",
    titleVi: "Ra khung",
    description: "Fade out, scale out… — sắp mở.",
    isBlockShelf: true,
    blocks: EXIT_BLOCKS,
  },
  {
    id: "emphasis",
    family: "animation",
    title: "Emphasis",
    titleVi: "Nhấn mạnh",
    description: "Pulse, shake… — sắp mở.",
    isBlockShelf: true,
    blocks: EMPHASIS_BLOCKS,
  },
  {
    id: "transform",
    family: "animation",
    title: "Transform",
    titleVi: "Biến đổi",
    description: "Primitive engine — không shelf MVP.",
    isBlockShelf: true,
    blocks: TRANSFORM_BLOCKS,
  },
  {
    id: "text-animation",
    family: "animation",
    title: "Text Animation",
    titleVi: "Motion chữ",
    description: "Typewriter, stagger-words, highlight (vi-safe).",
    isBlockShelf: true,
    blocks: TEXT_ANIMATION_BLOCKS,
  },
  {
    id: "number-animation",
    family: "animation",
    title: "Number Animation",
    titleVi: "Motion số",
    description: "Counter / rolling number…",
    isBlockShelf: true,
    blocks: NUMBER_ANIMATION_BLOCKS,
  },
  {
    id: "shape-animation",
    family: "animation",
    title: "Shape Animation",
    titleVi: "Motion hình",
    description: "Draw line, bar grow… — sắp mở.",
    isBlockShelf: true,
    blocks: SHAPE_ANIMATION_BLOCKS,
  },
  {
    id: "transition",
    family: "animation",
    title: "Transition",
    titleVi: "Chuyển cảnh",
    description: "Crossfade, swipe… — sắp mở.",
    isBlockShelf: true,
    blocks: TRANSITION_BLOCKS,
  },
  {
    id: "camera-presets",
    family: "animation",
    title: "Camera Presets",
    titleVi: "Preset camera",
    description: "Zoom, pan, focus, Ken Burns — sắp mở.",
    isBlockShelf: true,
    blocks: CAMERA_PRESET_BLOCKS,
  },
  {
    id: "timing",
    family: "meta",
    title: "Timing",
    titleVi: "Nhịp",
    description: `Schema: ${TIMING_FIELDS.join(", ")}. Default easing=${TIMING_DEFAULTS.easing}.`,
    isBlockShelf: false,
    blocks: [],
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

/** Deduped catalog (each id once). */
export const motionBlocks: MotionBlock[] = uniqueBlocks([
  TEXT_BLOCKS,
  SHAPE_BLOCKS,
  MEDIA_BLOCKS,
  CONTAINER_BLOCKS,
  DATA_BLOCKS,
  CHARACTER_BLOCKS,
  CONTENT_CAMERA_BLOCKS,
  ENTRANCE_CORE_BLOCKS,
  EXIT_BLOCKS,
  EMPHASIS_BLOCKS,
  TRANSFORM_BLOCKS,
  TEXT_ANIMATION_BLOCKS,
  NUMBER_ANIMATION_BLOCKS,
  SHAPE_ANIMATION_BLOCKS,
  TRANSITION_BLOCKS,
  CAMERA_PRESET_BLOCKS,
]);
