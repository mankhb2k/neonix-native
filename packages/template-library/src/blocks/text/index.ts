import type { MotionBlock } from "../types";

/**
 * Text — motion chỉ áp dụng được cho chữ (vi-safe).
 * Generic fade/slide/scale sống ở Entrance (kind vẫn có thể = text khi preview).
 */

/** Typewriter — grapheme-safe via JS (also listed under Entrance shelf view) */
export const TEXT_TYPEWRITER: MotionBlock = {
  id: "text.typewriter",
  name: "Typewriter",
  nameVi: "Gõ từng ký tự",
  kind: "text",
  intent: "entrance",
  shelf: "text",
  description:
    "Hiện dần như đang gõ. Intl.Segmenter grapheme — không vỡ dấu tiếng Việt.",
  duration: 1.4,
  durationMin: 0.6,
  durationMax: 3,
  preset: "typewriter",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core", "typing"],
  sampleText: "Xin chào Việt Nam",
  previewClass: "mv-block-text-typewriter",
};

/** @deprecated alias — dùng text.typewriter */
export const TEXT_TYPING = TEXT_TYPEWRITER;

/**
 * Stagger by whitespace — Vietnamese-safe
 * (does NOT split combining marks / per character).
 */
export const TEXT_STAGGER_WORDS: MotionBlock = {
  id: "text.stagger-words",
  name: "Stagger Words",
  nameVi: "Hiện lần lượt theo từ",
  kind: "text",
  intent: "entrance",
  shelf: "text",
  description:
    "Từng từ (tách khoảng trắng) fade-up lần lượt. Không tách dấu tiếng Việt.",
  duration: 0.9,
  durationMin: 0.5,
  durationMax: 2,
  preset: "stagger-words",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core", "stagger"],
  sampleText: "Học nhanh nhớ lâu",
  previewClass: "mv-block-text-stagger-words",
};

/** Underline / highlight sweep — also indexed under Emphasis */
export const TEXT_HIGHLIGHT: MotionBlock = {
  id: "text.highlight",
  name: "Highlight",
  nameVi: "Gạch nhấn chữ",
  kind: "text",
  intent: "emphasis",
  shelf: "text",
  description: "Chữ hiện rồi gạch nhấn bên dưới. Nhấn cụm từ quan trọng.",
  duration: 0.8,
  durationMin: 0.45,
  durationMax: 1.5,
  preset: "highlight",
  tags: ["text", "emphasis", "vi-safe", "core"],
  sampleText: "Điểm then chốt",
  previewClass: "mv-block-text-highlight",
};

/** Count 0 → N — sampleText = number string */
export const TEXT_COUNTER: MotionBlock = {
  id: "text.counter",
  name: "Counter",
  nameVi: "Đếm số tăng dần",
  kind: "text",
  intent: "entrance",
  shelf: "text",
  description:
    "Số đếm 0 → đích. sampleText là số (vd. 100). Hậu tố % gắn ở pattern nếu cần.",
  duration: 1.2,
  durationMin: 0.6,
  durationMax: 2.5,
  preset: "counter",
  tags: ["text", "entrance", "data", "vi-safe", "core", "counter"],
  sampleText: "100",
  previewClass: "mv-block-text-counter",
};

/** Blocks owned by Text shelf (unique ids — no duplicate of Entrance core) */
export const TEXT_BLOCKS: MotionBlock[] = [
  TEXT_TYPEWRITER,
  TEXT_STAGGER_WORDS,
  TEXT_HIGHLIGHT,
  TEXT_COUNTER,
];

/** @deprecated — dùng TEXT_BLOCKS */
export const TEXT_EXTRA_BLOCKS = TEXT_BLOCKS;
