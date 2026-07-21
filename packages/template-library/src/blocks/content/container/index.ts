import type { MotionBlock } from "../../types";

function contentContainer(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText: string,
): MotionBlock {
  return {
    id: `container.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "container",
    shelf: "container",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "container", role],
    sampleText,
    previewClass: `mv-block-content mv-block-content-container mv-block-content-container-${role}`,
  };
}

export const CONTAINER_CARD = contentContainer(
  "card",
  "Card",
  "Thẻ",
  "Nhóm nội dung có nền — feature card, price card.",
  "Card",
);

export const CONTAINER_GROUP = contentContainer(
  "group",
  "Group",
  "Nhóm",
  "Group layer không style — parent transform chung.",
  "Group",
);

export const CONTAINER_STACK = contentContainer(
  "stack",
  "Stack",
  "Xếp chồng",
  "Xếp dọc/ngang với gap cố định.",
  "Stack",
);

export const CONTAINER_GRID = contentContainer(
  "grid",
  "Grid",
  "Lưới",
  "Lưới 2×N cho so sánh / feature.",
  "Grid",
);

export const CONTAINER_FRAME = contentContainer(
  "frame",
  "Frame",
  "Khung",
  "Safe frame / crop vùng nội dung.",
  "Frame",
);

export const CONTAINER_BACKGROUND = contentContainer(
  "background",
  "Background",
  "Nền",
  "Nền scene (màu / gradient / ảnh mờ).",
  "BG",
);

export const CONTAINER_SECTION = contentContainer(
  "section",
  "Section",
  "Section",
  "Khối section trong scene dài.",
  "Section",
);

export const CONTAINER_BLOCKS: MotionBlock[] = [
  CONTAINER_CARD,
  CONTAINER_GROUP,
  CONTAINER_STACK,
  CONTAINER_GRID,
  CONTAINER_FRAME,
  CONTAINER_BACKGROUND,
  CONTAINER_SECTION,
];
