import type { MotionBlock } from "../types";
import { TEXT_TYPEWRITER } from "../text";

/**
 * Entrance — generic enter presets (MVP preview on text layers).
 * Text-only enters (typewriter) live under Text and are appended to ENTRANCE_BLOCKS.
 */

export const TEXT_FADE_IN: MotionBlock = {
  id: "text.fade-in",
  name: "Fade In",
  nameVi: "Hiện mờ dần",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Chỉ fade opacity. An toàn mọi tiêu đề/phụ đề tiếng Việt.",
  duration: 0.5,
  durationMin: 0.25,
  durationMax: 1,
  preset: "fade-in",
  tags: ["text", "entrance", "vi-safe", "core"],
  sampleText: "Giải thích ngắn gọn",
  previewClass: "mv-block-text-fade-in",
};

/** @deprecated alias — dùng text.fade-in */
export const TEXT_FADE = TEXT_FADE_IN;

export const TEXT_FADE_UP: MotionBlock = {
  id: "text.fade-up",
  name: "Fade Up",
  nameVi: "Hiện từ dưới lên",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Fade + dịch nhẹ từ dưới. Hook, tiêu đề scene mặc định.",
  duration: 0.6,
  durationMin: 0.35,
  durationMax: 1.2,
  preset: "fade-up",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Giảm 30% hôm nay",
  previewClass: "mv-block-text-fade-up",
};

export const TEXT_FADE_DOWN: MotionBlock = {
  id: "text.fade-down",
  name: "Fade Down",
  nameVi: "Hiện từ trên xuống",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Fade + dịch nhẹ từ trên. Đối xứng với fade-up.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "fade-down",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Bắt đầu từ đây",
  previewClass: "mv-block-text-fade-down",
};

export const TEXT_FADE_LEFT: MotionBlock = {
  id: "text.fade-left",
  name: "Fade Left",
  nameVi: "Hiện từ trái",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Fade + dịch nhẹ từ trái. Nhẹ hơn slide-left.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "fade-left",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Ưu điểm nổi bật",
  previewClass: "mv-block-text-fade-left",
};

export const TEXT_FADE_RIGHT: MotionBlock = {
  id: "text.fade-right",
  name: "Fade Right",
  nameVi: "Hiện từ phải",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Fade + dịch nhẹ từ phải. Đối xứng với fade-left.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "fade-right",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Lợi ích rõ ràng",
  previewClass: "mv-block-text-fade-right",
};

export const TEXT_SCALE_IN: MotionBlock = {
  id: "text.scale-in",
  name: "Scale In",
  nameVi: "Phóng to vào",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Scale nhỏ → lớn + fade. Big-number, giá, %.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "scale-in",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Giảm 50%",
  previewClass: "mv-block-text-scale-in",
};

export const TEXT_ZOOM_IN: MotionBlock = {
  id: "text.zoom-in",
  name: "Zoom In",
  nameVi: "Zoom vào",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Zoom mạnh hơn scale-in (từ nhỏ hơn). Hook ấn tượng.",
  duration: 0.65,
  durationMin: 0.35,
  durationMax: 1.2,
  preset: "zoom-in",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Ra mắt hôm nay",
  previewClass: "mv-block-text-zoom-in",
};

export const TEXT_SLIDE_UP: MotionBlock = {
  id: "text.slide-up",
  name: "Slide Up",
  nameVi: "Trượt từ dưới lên",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Trượt xa hơn fade-up. CTA, nhãn nổi bật.",
  duration: 0.6,
  durationMin: 0.35,
  durationMax: 1.2,
  preset: "slide-up",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Đặt hàng ngay",
  previewClass: "mv-block-text-slide-up",
};

export const TEXT_SLIDE_LEFT: MotionBlock = {
  id: "text.slide-left",
  name: "Slide Left",
  nameVi: "Trượt vào từ phải",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Trượt từ phải sang trái. Cột so sánh, feature.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "slide-left",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Ưu đãi hôm nay",
  previewClass: "mv-block-text-slide-left",
};

export const TEXT_SLIDE_RIGHT: MotionBlock = {
  id: "text.slide-right",
  name: "Slide Right",
  nameVi: "Trượt vào từ trái",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Trượt từ trái sang phải. Cột so sánh đối xứng.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "slide-right",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Giải pháp của bạn",
  previewClass: "mv-block-text-slide-right",
};

export const TEXT_POP: MotionBlock = {
  id: "text.pop",
  name: "Pop",
  nameVi: "Bật nảy nhẹ",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Scale với overshoot nhẹ. Badge, giá, số ngắn.",
  duration: 0.55,
  durationMin: 0.3,
  durationMax: 1,
  preset: "pop",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Mới",
  previewClass: "mv-block-text-pop",
};

export const TEXT_BOUNCE_IN: MotionBlock = {
  id: "text.bounce-in",
  name: "Bounce In",
  nameVi: "Nảy vào",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Bay lên kèm nảy. Dùng sparingly — cảm giác vui, trẻ.",
  duration: 0.75,
  durationMin: 0.45,
  durationMax: 1.4,
  preset: "bounce-in",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Surprise!",
  previewClass: "mv-block-text-bounce-in",
};

export const TEXT_FLIP: MotionBlock = {
  id: "text.flip",
  name: "Flip",
  nameVi: "Lật vào",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Lật quanh trục ngang (perspective). Tiêu đề ngắn.",
  duration: 0.7,
  durationMin: 0.4,
  durationMax: 1.2,
  preset: "flip",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Bật mí",
  previewClass: "mv-block-text-flip",
};

export const TEXT_ROTATE_IN: MotionBlock = {
  id: "text.rotate-in",
  name: "Rotate In",
  nameVi: "Xoay vào",
  kind: "text",
  intent: "entrance",
  shelf: "entrance",
  description: "Xoay nhẹ + fade + scale. Nhãn, sticker, badge.",
  duration: 0.65,
  durationMin: 0.35,
  durationMax: 1.2,
  preset: "rotate-in",
  tags: ["text", "entrance", "kinetic", "vi-safe", "core"],
  sampleText: "Hot deal",
  previewClass: "mv-block-text-rotate-in",
};

/** Owned by this shelf (generic enters). Typewriter lives under Text. */
export const ENTRANCE_CORE_BLOCKS: MotionBlock[] = [
  TEXT_FADE_IN,
  TEXT_FADE_UP,
  TEXT_FADE_DOWN,
  TEXT_FADE_LEFT,
  TEXT_FADE_RIGHT,
  TEXT_SCALE_IN,
  TEXT_ZOOM_IN,
  TEXT_SLIDE_UP,
  TEXT_SLIDE_LEFT,
  TEXT_SLIDE_RIGHT,
  TEXT_POP,
  TEXT_BOUNCE_IN,
  TEXT_FLIP,
  TEXT_ROTATE_IN,
];

/** Product entrance shelf = core + text typewriter */
export const ENTRANCE_BLOCKS: MotionBlock[] = [
  ...ENTRANCE_CORE_BLOCKS,
  TEXT_TYPEWRITER,
];
