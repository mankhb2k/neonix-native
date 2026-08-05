import type { MotionBlock } from "../../types";

function exitBlock(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  previewClass: string,
  duration = 0.45,
): MotionBlock {
  return {
    id: `exit.${role}`,
    name,
    nameVi,
    family: "animation",
    kind: "text",
    intent: "exit",
    shelf: "exit",
    description: `${description} Preview-only until exit presets join COMPILED_PRESET_IDS.`,
    duration,
    durationMin: 0.25,
    durationMax: 1,
    tags: ["animation", "exit", role, "preview"],
    sampleText: "Tạm biệt",
    previewClass,
  };
}

export const EXIT_FADE_OUT = exitBlock(
  "fade-out",
  "Fade Out",
  "Mờ dần tắt",
  "Chỉ fade opacity ra. An toàn mọi layer.",
  "mv-block-exit-fade-out",
);

export const EXIT_SCALE_OUT = exitBlock(
  "scale-out",
  "Scale Out",
  "Thu nhỏ tắt",
  "Scale lớn → nhỏ + fade.",
  "mv-block-exit-scale-out",
);

export const EXIT_SLIDE_UP = exitBlock(
  "slide-up",
  "Slide Up Out",
  "Trượt lên tắt",
  "Trượt lên + fade khi rời khung.",
  "mv-block-exit-slide-up",
);

export const EXIT_SLIDE_LEFT = exitBlock(
  "slide-left",
  "Slide Left Out",
  "Trượt trái tắt",
  "Trượt sang trái + fade.",
  "mv-block-exit-slide-left",
);

export const EXIT_SLIDE_RIGHT = exitBlock(
  "slide-right",
  "Slide Right Out",
  "Trượt phải tắt",
  "Trượt sang phải + fade.",
  "mv-block-exit-slide-right",
);

export const EXIT_ZOOM_OUT = exitBlock(
  "zoom-out",
  "Zoom Out",
  "Zoom ra tắt",
  "Zoom mạnh ra + fade (đối xứng enter.zoom-in).",
  "mv-block-exit-zoom-out",
  0.5,
);

export const EXIT_BLOCKS: MotionBlock[] = [
  EXIT_FADE_OUT,
  EXIT_SCALE_OUT,
  EXIT_SLIDE_UP,
  EXIT_SLIDE_LEFT,
  EXIT_SLIDE_RIGHT,
  EXIT_ZOOM_OUT,
];
