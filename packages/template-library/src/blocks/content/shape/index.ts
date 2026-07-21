import type { MotionBlock } from "../../types";

function contentShape(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText: string,
): MotionBlock {
  return {
    id: `shape.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "shape",
    shelf: "shape",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "shape", role],
    sampleText,
    previewClass: `mv-block-content mv-block-content-shape mv-block-content-shape-${role}`,
  };
}

export const SHAPE_RECTANGLE = contentShape(
  "rectangle",
  "Rectangle",
  "Chữ nhật",
  "Khối chữ nhật — nền card, CTA, bar.",
  "Rect",
);

export const SHAPE_ROUNDED_RECT = contentShape(
  "rounded-rect",
  "Rounded Rectangle",
  "Chữ nhật bo góc",
  "Bo góc — button, badge nền.",
  "Round",
);

export const SHAPE_CIRCLE = contentShape(
  "circle",
  "Circle",
  "Tròn",
  "Icon nền / avatar / bullet.",
  "○",
);

export const SHAPE_ELLIPSE = contentShape(
  "ellipse",
  "Ellipse",
  "Elip",
  "Elip / oval highlight.",
  "⬭",
);

export const SHAPE_LINE = contentShape(
  "line",
  "Line",
  "Đường thẳng",
  "Divider / connector process steps.",
  "—",
);

export const SHAPE_ARROW = contentShape(
  "arrow",
  "Arrow",
  "Mũi tên",
  "Chỉ hướng / flow.",
  "→",
);

export const SHAPE_TRIANGLE = contentShape(
  "triangle",
  "Triangle",
  "Tam giác",
  "Accent / play icon style.",
  "▲",
);

export const SHAPE_DIAMOND = contentShape(
  "diamond",
  "Diamond",
  "Hình thoi",
  "Accent geometric.",
  "◆",
);

export const SHAPE_SPEECH_BUBBLE = contentShape(
  "speech-bubble",
  "Speech Bubble",
  "Bong bóng thoại",
  "Quote / chat UI.",
  "💬",
);

export const SHAPE_DIVIDER = contentShape(
  "divider",
  "Divider",
  "Đường phân cách",
  "Tách section trên khung.",
  "────",
);

/** MVP content shapes — polygon/blob/ribbon sau */
export const SHAPE_BLOCKS: MotionBlock[] = [
  SHAPE_RECTANGLE,
  SHAPE_ROUNDED_RECT,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_LINE,
  SHAPE_ARROW,
  SHAPE_TRIANGLE,
  SHAPE_DIAMOND,
  SHAPE_SPEECH_BUBBLE,
  SHAPE_DIVIDER,
];
