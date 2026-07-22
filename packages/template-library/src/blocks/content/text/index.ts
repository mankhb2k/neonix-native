import type { MotionBlock } from "../../types";

function contentText(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText: string,
  extraTags: string[] = [],
): MotionBlock {
  return {
    id: `text.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "text",
    shelf: "text",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "text", role, "vi-safe", ...extraTags],
    sampleText,
    previewClass: `mv-block-content mv-block-content-${role}`,
  };
}

/** Content Text — loại chữ tĩnh (không phải animation) */
export const TEXT_TITLE = contentText(
  "title",
  "Title",
  "Tiêu đề",
  "Headline chính của scene. Typography lớn, 1–2 dòng.",
  "AI Marketing",
  ["core"],
);

export const TEXT_SUBTITLE = contentText(
  "subtitle",
  "Subtitle",
  "Phụ đề",
  "Dòng hỗ trợ dưới title. Nhỏ hơn, thường 1 câu.",
  "Tiết kiệm 80% thời gian",
  ["core"],
);

export const TEXT_PARAGRAPH = contentText(
  "paragraph",
  "Paragraph",
  "Đoạn văn",
  "Body copy ngắn cho giải thích / benefit.",
  "Tạo video motion chỉ với một câu mô tả.",
);

export const TEXT_CAPTION = contentText(
  "caption",
  "Caption",
  "Chú thích",
  "Chú thích nhỏ dưới ảnh / chart.",
  "Nguồn: khảo sát nội bộ 2026",
);

export const TEXT_QUOTE = contentText(
  "quote",
  "Quote",
  "Trích dẫn",
  "Quote / testimonial. Thường kèm shape speech-bubble.",
  "“Làm nhanh gấp ba lần trước đây.”",
);

export const TEXT_BADGE = contentText(
  "badge",
  "Badge",
  "Huy hiệu",
  "Nhãn ngắn nổi: Mới, Hot, -30%.",
  "Mới",
  ["core"],
);

export const TEXT_LABEL = contentText(
  "label",
  "Label",
  "Nhãn",
  "Nhãn trường / trục / bước quy trình.",
  "Bước 1",
);

export const TEXT_NUMBER = contentText(
  "number",
  "Number",
  "Số",
  "Số tĩnh (không animate). Kết hợp motion text.counter khi cần đếm.",
  "95",
  ["core", "data"],
);

export const TEXT_PERCENTAGE = contentText(
  "percentage",
  "Percentage",
  "Phần trăm",
  "Hiển thị % tĩnh. Format sẵn dấu %.",
  "80%",
  ["core", "data"],
);

export const TEXT_PRICE = contentText(
  "price",
  "Price",
  "Giá",
  "Giá / ưu đãi. Locale vi-VN.",
  "99.000đ",
  ["core", "commerce"],
);

export const TEXT_CTA = contentText(
  "cta",
  "CTA Button",
  "Nút CTA",
  "Lời kêu gọi hành động. Thường + shape rounded-rect.",
  "Dùng thử miễn phí",
  ["core", "cta"],
);

export const TEXT_TAG = contentText(
  "tag",
  "Tag",
  "Tag",
  "Chip chủ đề / hashtag.",
  "#F&B",
);

export const TEXT_BULLET_LIST = contentText(
  "bullet-list",
  "Bullet List",
  "Danh sách",
  "List gạch đầu dòng. Mỗi dòng = item (tách bằng · hoặc xuống dòng).",
  "Nhanh · Rẻ · Dễ dùng",
);

export const TEXT_CHECKLIST = contentText(
  "checklist",
  "Checklist",
  "Checklist",
  "List có dấu check — feature / benefit (tách bằng · hoặc xuống dòng).",
  "Không cần edit tay · Xuất nhanh · Tiếng Việt chuẩn",
);

export const TEXT_CODE = contentText(
  "code",
  "Code",
  "Code",
  "Đoạn code / ID kỹ thuật (hiếm trong TVC SME).",
  "motion.fade-up",
);

/** Content text shelf */
export const TEXT_BLOCKS: MotionBlock[] = [
  TEXT_TITLE,
  TEXT_SUBTITLE,
  TEXT_PARAGRAPH,
  TEXT_CAPTION,
  TEXT_QUOTE,
  TEXT_BADGE,
  TEXT_LABEL,
  TEXT_NUMBER,
  TEXT_PERCENTAGE,
  TEXT_PRICE,
  TEXT_CTA,
  TEXT_TAG,
  TEXT_BULLET_LIST,
  TEXT_CHECKLIST,
  TEXT_CODE,
];
