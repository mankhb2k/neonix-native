import {
  DEFAULT_FRAME_DURATION,
  getFrame,
  type FrameDraft,
} from "@/lib/editor/frame-library";

export type MockLibraryKind =
  | "element"
  | "text"
  | "video"
  | "image"
  | "sticker";

/** Frame-compatible draft + UI metadata for sidebar libraries. */
export type MockLibraryItem = FrameDraft & {
  kind: MockLibraryKind;
  thumbnailUrl?: string;
  subtitle?: string;
};

export const MOCK_ELEMENTS: MockLibraryItem[] = [
  {
    id: "mock_el_rect",
    kind: "element",
    name: "Hình chữ nhật",
    duration: DEFAULT_FRAME_DURATION,
    text: "Hình chữ nhật",
    subtitle: "Shape",
  },
  {
    id: "mock_el_circle",
    kind: "element",
    name: "Hình tròn",
    duration: DEFAULT_FRAME_DURATION,
    text: "Hình tròn",
    subtitle: "Shape",
  },
  {
    id: "mock_el_line",
    kind: "element",
    name: "Đường kẻ",
    duration: DEFAULT_FRAME_DURATION,
    text: "Đường kẻ",
    subtitle: "Shape",
  },
  {
    id: "mock_el_arrow",
    kind: "element",
    name: "Mũi tên",
    duration: DEFAULT_FRAME_DURATION,
    text: "Mũi tên",
    subtitle: "Shape",
  },
  {
    id: "mock_el_star",
    kind: "element",
    name: "Ngôi sao",
    duration: DEFAULT_FRAME_DURATION,
    text: "Ngôi sao",
    subtitle: "Shape",
  },
  {
    id: "mock_el_frame",
    kind: "element",
    name: "Khung ảnh",
    duration: DEFAULT_FRAME_DURATION,
    text: "Khung ảnh",
    subtitle: "Frame",
  },
];

export const MOCK_TEXTS: MockLibraryItem[] = [
  {
    id: "mock_txt_title",
    kind: "text",
    name: "Tiêu đề lớn",
    duration: DEFAULT_FRAME_DURATION,
    text: "Tiêu đề lớn",
    subtitle: "Heading",
  },
  {
    id: "mock_txt_subtitle",
    kind: "text",
    name: "Tiêu đề phụ",
    duration: DEFAULT_FRAME_DURATION,
    text: "Tiêu đề phụ",
    subtitle: "Subheading",
  },
  {
    id: "mock_txt_body",
    kind: "text",
    name: "Nội dung văn bản",
    duration: DEFAULT_FRAME_DURATION,
    text: "Nội dung văn bản mẫu để kéo vào timeline.",
    subtitle: "Body",
  },
  {
    id: "mock_txt_caption",
    kind: "text",
    name: "Phụ đề",
    duration: 3,
    text: "Phụ đề ngắn",
    subtitle: "Caption",
  },
  {
    id: "mock_txt_cta",
    kind: "text",
    name: "Call to action",
    duration: 4,
    text: "Mua ngay",
    subtitle: "CTA",
  },
];

export const MOCK_VIDEOS: MockLibraryItem[] = [
  {
    id: "mock_vid_city",
    kind: "video",
    name: "City walk.mp4",
    duration: 8,
    text: "City walk",
    subtitle: "Video",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=320&h=200&fit=crop",
  },
  {
    id: "mock_vid_nature",
    kind: "video",
    name: "Nature b-roll.mp4",
    duration: 12,
    text: "Nature b-roll",
    subtitle: "Video",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=320&h=200&fit=crop",
  },
  {
    id: "mock_vid_product",
    kind: "video",
    name: "Product demo.mp4",
    duration: 6,
    text: "Product demo",
    subtitle: "Video",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=320&h=200&fit=crop",
  },
];

export const MOCK_IMAGES: MockLibraryItem[] = [
  {
    id: "mock_img_portrait",
    kind: "image",
    name: "Portrait.jpg",
    duration: DEFAULT_FRAME_DURATION,
    text: "Portrait",
    subtitle: "Image",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&h=200&fit=crop",
  },
  {
    id: "mock_img_food",
    kind: "image",
    name: "Food flatlay.jpg",
    duration: DEFAULT_FRAME_DURATION,
    text: "Food flatlay",
    subtitle: "Image",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=320&h=200&fit=crop",
  },
  {
    id: "mock_img_abstract",
    kind: "image",
    name: "Abstract.png",
    duration: DEFAULT_FRAME_DURATION,
    text: "Abstract",
    subtitle: "Image",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=320&h=200&fit=crop",
  },
  {
    id: "mock_img_logo",
    kind: "image",
    name: "Brand mark.png",
    duration: 3,
    text: "Brand mark",
    subtitle: "Image",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1611162617474-5b21e764f281?w=320&h=200&fit=crop",
  },
];

export const MOCK_STICKERS: MockLibraryItem[] = [
  {
    id: "mock_stk_fire",
    kind: "sticker",
    name: "Lửa",
    duration: 3,
    text: "🔥",
    subtitle: "Emoji",
  },
  {
    id: "mock_stk_star",
    kind: "sticker",
    name: "Sao",
    duration: 3,
    text: "⭐",
    subtitle: "Emoji",
  },
  {
    id: "mock_stk_heart",
    kind: "sticker",
    name: "Tim",
    duration: 3,
    text: "❤️",
    subtitle: "Emoji",
  },
  {
    id: "mock_stk_party",
    kind: "sticker",
    name: "Party",
    duration: 3,
    text: "🎉",
    subtitle: "Emoji",
  },
  {
    id: "mock_stk_ok",
    kind: "sticker",
    name: "OK",
    duration: 3,
    text: "👍",
    subtitle: "Emoji",
  },
  {
    id: "mock_stk_sparkle",
    kind: "sticker",
    name: "Lấp lánh",
    duration: 3,
    text: "✨",
    subtitle: "Emoji",
  },
];

const ALL_MOCK_ITEMS: MockLibraryItem[] = [
  ...MOCK_ELEMENTS,
  ...MOCK_TEXTS,
  ...MOCK_VIDEOS,
  ...MOCK_IMAGES,
  ...MOCK_STICKERS,
];

const BY_ID = new Map(ALL_MOCK_ITEMS.map((item) => [item.id, item]));

/** Resolve a mock sidebar item into a FrameDraft for timeline drop. */
export function getMockLibraryDraft(id: string): FrameDraft | null {
  const item = BY_ID.get(id);
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    duration: item.duration,
    text: item.text,
  };
}

export function getMockLibraryItem(id: string): MockLibraryItem | null {
  return BY_ID.get(id) ?? null;
}

/** Project frames first, then sidebar mock library (for DnD tests). */
export function resolveFrameDraft(
  projectId: string,
  frameId: string,
): FrameDraft | null {
  return getFrame(projectId, frameId) ?? getMockLibraryDraft(frameId);
}
