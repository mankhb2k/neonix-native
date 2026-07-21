import type { MotionBlock } from "../../types";

function contentMedia(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText: string,
): MotionBlock {
  return {
    id: `media.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "media",
    shelf: "media",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "media", role],
    sampleText,
    previewClass: `mv-block-content mv-block-content-media mv-block-content-media-${role}`,
  };
}

export const MEDIA_IMAGE = contentMedia(
  "image",
  "Image",
  "Ảnh",
  "Ảnh sản phẩm / lifestyle. assetId bắt buộc khi render.",
  "Image",
);

export const MEDIA_VIDEO = contentMedia(
  "video",
  "Video",
  "Video",
  "Clip nền / product shot (pha sau).",
  "Video",
);

export const MEDIA_SVG = contentMedia(
  "svg",
  "SVG",
  "SVG",
  "Vector tĩnh — logo path, illustration đơn.",
  "SVG",
);

export const MEDIA_ICON = contentMedia(
  "icon",
  "Icon",
  "Icon",
  "Icon tĩnh (Lucide/Phosphor). Animate bằng Entrance, không Lottie.",
  "Icon",
);

export const MEDIA_LOTTIE = contentMedia(
  "lottie",
  "Lottie",
  "Lottie",
  "Asset Lottie đã animate — dùng khi cần illustration phức tạp.",
  "Lottie",
);

export const MEDIA_BLOCKS: MotionBlock[] = [
  MEDIA_IMAGE,
  MEDIA_VIDEO,
  MEDIA_SVG,
  MEDIA_ICON,
  MEDIA_LOTTIE,
];
