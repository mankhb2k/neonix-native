import type { MotionBlock } from "../../types";

function contentShape(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText = "",
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
    tags: ["content", "shape", role, "core"],
    sampleText,
    previewClass: `mv-block-content mv-block-content-shape mv-block-content-shape-${role}`,
  };
}

export const SHAPE_RECTANGLE = contentShape(
  "rectangle",
  "Rectangle",
  "Chữ nhật",
  "Khối chữ nhật — nền card, CTA, bar.",
);

export const SHAPE_ROUNDED_RECT = contentShape(
  "rounded-rect",
  "Rounded Rectangle",
  "Chữ nhật bo góc",
  "Bo góc — button, badge nền.",
);

export const SHAPE_CIRCLE = contentShape(
  "circle",
  "Circle",
  "Tròn",
  "Icon nền / avatar / bullet.",
);

export const SHAPE_ELLIPSE = contentShape(
  "ellipse",
  "Ellipse",
  "Elip",
  "Elip / oval highlight.",
);

export const SHAPE_LINE = contentShape(
  "line",
  "Line",
  "Đường thẳng",
  "Connector / trục / gạch nối bước.",
);

export const SHAPE_ARROW = contentShape(
  "arrow",
  "Arrow",
  "Mũi tên",
  "Chỉ hướng / flow / process.",
);

export const SHAPE_POLYGON = contentShape(
  "polygon",
  "Polygon",
  "Đa giác",
  "Đa giác đều (mặc định 6 cạnh). Accent / badge hình học.",
);

export const SHAPE_TRIANGLE = contentShape(
  "triangle",
  "Triangle",
  "Tam giác",
  "Accent / play-style / mũi nhọn.",
);

export const SHAPE_DIAMOND = contentShape(
  "diamond",
  "Diamond",
  "Hình thoi",
  "Accent geometric / bước quyết định.",
);

export const SHAPE_BLOB = contentShape(
  "blob",
  "Blob",
  "Blob",
  "Hình hữu cơ mềm — nền illustration / highlight.",
);

export const SHAPE_SPEECH_BUBBLE = contentShape(
  "speech-bubble",
  "Speech Bubble",
  "Bong bóng thoại",
  "Quote / chat / testimonial.",
);

export const SHAPE_RIBBON = contentShape(
  "ribbon",
  "Ribbon",
  "Ruy băng",
  "Banner giảm giá / nhãn góc.",
);

export const SHAPE_DIVIDER = contentShape(
  "divider",
  "Divider",
  "Đường phân cách",
  "Tách section trên khung (thường mỏng hơn line).",
);

/** Content Shape shelf — đủ bộ cơ bản */
export const SHAPE_BLOCKS: MotionBlock[] = [
  SHAPE_RECTANGLE,
  SHAPE_ROUNDED_RECT,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_LINE,
  SHAPE_ARROW,
  SHAPE_POLYGON,
  SHAPE_TRIANGLE,
  SHAPE_DIAMOND,
  SHAPE_BLOB,
  SHAPE_SPEECH_BUBBLE,
  SHAPE_RIBBON,
  SHAPE_DIVIDER,
];
