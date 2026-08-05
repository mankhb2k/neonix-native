import type { MotionBlock } from "../../types";

function emphasisBlock(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  previewClass: string,
  duration: number,
): MotionBlock {
  return {
    id: `emphasis.${role}`,
    name,
    nameVi,
    family: "animation",
    kind: "text",
    intent: "emphasis",
    shelf: "emphasis",
    description: `${description} Preview-only until COMPILED_PRESET_IDS.`,
    duration,
    durationMin: Math.max(0.25, duration * 0.5),
    durationMax: Math.max(duration * 2, 1.5),
    tags: ["animation", "emphasis", role, "preview"],
    sampleText: "Nhấn mạnh",
    previewClass,
  };
}

export const EMPHASIS_PULSE = emphasisBlock(
  "pulse",
  "Pulse",
  "Đập nhẹ",
  "Scale nhịp nhẹ tại chỗ — thu hút chú ý.",
  "mv-block-emphasis-pulse",
  0.8,
);

export const EMPHASIS_SHAKE = emphasisBlock(
  "shake",
  "Shake",
  "Rung",
  "Rung ngang nhẹ — cảnh báo / impact. Dùng sparingly.",
  "mv-block-emphasis-shake",
  0.5,
);

export const EMPHASIS_FLASH = emphasisBlock(
  "flash",
  "Flash",
  "Nháy",
  "Nhấp nháy opacity nhanh.",
  "mv-block-emphasis-flash",
  0.6,
);

export const EMPHASIS_BLOCKS: MotionBlock[] = [
  EMPHASIS_PULSE,
  EMPHASIS_SHAKE,
  EMPHASIS_FLASH,
];
