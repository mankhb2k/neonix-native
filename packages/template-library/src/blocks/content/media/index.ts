import type { MotionBlock } from "../../types";

function contentMedia(
  role: string,
  name: string,
  nameVi: string,
  description: string,
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
    tags: ["content", "media", role, "core"],
    sampleText: "",
    previewClass: `mv-block-content mv-block-content-media mv-block-content-media-${role}`,
  };
}

export const MEDIA_IMAGE = contentMedia(
  "image",
  "Image",
  "Ảnh",
  "Ảnh sản phẩm / lifestyle. Cần assetId khi render.",
);

export const MEDIA_VIDEO = contentMedia(
  "video",
  "Video",
  "Video",
  "Clip nền / product shot. Loop hoặc scrub theo timeline.",
);

export const MEDIA_SVG = contentMedia(
  "svg",
  "SVG",
  "SVG",
  "Vector tĩnh — logo path, illustration đơn giản.",
);

export const MEDIA_ICON = contentMedia(
  "icon",
  "Icon",
  "Icon",
  "Icon tĩnh (Lucide/Phosphor…). Animate bằng Entrance, không cần Lottie.",
);

export const MEDIA_GIF = contentMedia(
  "gif",
  "GIF",
  "GIF",
  "GIF loop — dùng sparingly (nặng file). Ưu tiên video/WebM khi export.",
);

/** Optional — illustration đã animate sẵn */
export const MEDIA_LOTTIE = contentMedia(
  "lottie",
  "Lottie",
  "Lottie",
  "Asset Lottie — khi cần illustration phức tạp. Không thay Motion Block.",
);

/** Content Media shelf — MVP theo yêu cầu */
export const MEDIA_BLOCKS: MotionBlock[] = [
  MEDIA_IMAGE,
  MEDIA_VIDEO,
  MEDIA_SVG,
  MEDIA_ICON,
  MEDIA_GIF,
];
