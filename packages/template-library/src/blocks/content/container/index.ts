import type { MotionBlock } from "../../types";

function contentContainer(
  role: string,
  name: string,
  nameVi: string,
  description: string,
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
    tags: ["content", "container", role, "layout"],
    sampleText: "",
    previewClass: `mv-block-content mv-block-content-container mv-block-content-container-${role}`,
  };
}

export const CONTAINER_CARD = contentContainer(
  "card",
  "Card",
  "Thẻ",
  "Nhóm nội dung có nền — feature card, price card.",
);

export const CONTAINER_GROUP = contentContainer(
  "group",
  "Group",
  "Nhóm",
  "Parent ảo — transform chung, không style riêng.",
);

export const CONTAINER_GRID = contentContainer(
  "grid",
  "Grid",
  "Lưới",
  "Lưới 2×N cho so sánh / feature list.",
);

export const CONTAINER_STACK = contentContainer(
  "stack",
  "Stack",
  "Xếp chồng",
  "Xếp dọc hoặc ngang với gap cố định.",
);

export const CONTAINER_FRAME = contentContainer(
  "frame",
  "Frame",
  "Khung",
  "Safe frame / vùng bố cục / crop nhẹ.",
);

export const CONTAINER_MASK = contentContainer(
  "mask",
  "Mask",
  "Mask",
  "Clip children theo shape/path — dùng cho reveal.",
);

export const CONTAINER_BACKGROUND = contentContainer(
  "background",
  "Background",
  "Nền",
  "Nền scene (màu / gradient / ảnh mờ). Full-bleed.",
);

export const CONTAINER_SECTION = contentContainer(
  "section",
  "Section",
  "Section",
  "Khối section lớn trong scene dài.",
);

/** Content Container shelf — order = README */
export const CONTAINER_BLOCKS: MotionBlock[] = [
  CONTAINER_CARD,
  CONTAINER_GROUP,
  CONTAINER_GRID,
  CONTAINER_STACK,
  CONTAINER_FRAME,
  CONTAINER_MASK,
  CONTAINER_BACKGROUND,
  CONTAINER_SECTION,
];
