import type { MotionBlock } from "../../types";

/**
 * Text Animation — motion chỉ chữ (vi-safe).
 * Không phải content text.title / subtitle.
 */

export const TEXT_TYPEWRITER: MotionBlock = {
  id: "text.typewriter",
  name: "Typewriter",
  nameVi: "Gõ từng ký tự",
  family: "animation",
  kind: "text",
  intent: "entrance",
  shelf: "text-animation",
  description:
    "Hiện dần như đang gõ. Intl.Segmenter grapheme — không vỡ dấu tiếng Việt.",
  duration: 1.4,
  durationMin: 0.6,
  durationMax: 3,
  preset: "typewriter",
  tags: ["animation", "text-animation", "kinetic", "vi-safe", "core", "typing"],
  sampleText: "Xin chào Việt Nam",
  previewClass: "mv-block-text-typewriter",
};

/** @deprecated alias */
export const TEXT_TYPING = TEXT_TYPEWRITER;

export const TEXT_STAGGER_WORDS: MotionBlock = {
  id: "text.stagger-words",
  name: "Stagger Words",
  nameVi: "Hiện lần lượt theo từ",
  family: "animation",
  kind: "text",
  intent: "entrance",
  shelf: "text-animation",
  description:
    "Từng từ (tách khoảng trắng) fade-up lần lượt. Không tách dấu tiếng Việt.",
  duration: 0.9,
  durationMin: 0.5,
  durationMax: 2,
  preset: "stagger-words",
  tags: ["animation", "text-animation", "kinetic", "vi-safe", "core", "stagger"],
  sampleText: "Học nhanh nhớ lâu",
  previewClass: "mv-block-text-stagger-words",
};

export const TEXT_HIGHLIGHT: MotionBlock = {
  id: "text.highlight",
  name: "Highlight",
  nameVi: "Gạch nhấn chữ",
  family: "animation",
  kind: "text",
  intent: "emphasis",
  shelf: "text-animation",
  description: "Chữ hiện rồi gạch nhấn bên dưới. Nhấn cụm từ quan trọng.",
  duration: 0.8,
  durationMin: 0.45,
  durationMax: 1.5,
  preset: "highlight",
  tags: ["animation", "text-animation", "emphasis", "vi-safe", "core"],
  sampleText: "Điểm then chốt",
  previewClass: "mv-block-text-highlight",
};

export const TEXT_ANIMATION_BLOCKS: MotionBlock[] = [
  TEXT_TYPEWRITER,
  TEXT_STAGGER_WORDS,
  TEXT_HIGHLIGHT,
];

/** @deprecated */
export const TEXT_MOTION_BLOCKS = TEXT_ANIMATION_BLOCKS;
export const TEXT_EXTRA_BLOCKS = TEXT_ANIMATION_BLOCKS;
