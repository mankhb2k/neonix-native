import type { MotionBlock } from "../../types";

function transitionBlock(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  preset: string,
  previewClass: string,
  duration: number,
): MotionBlock {
  return {
    id: `trans.${role}`,
    name,
    nameVi,
    family: "animation",
    kind: "transition",
    intent: "transition",
    shelf: "transition",
    description,
    duration,
    durationMin: Math.max(0.25, duration * 0.5),
    durationMax: Math.max(duration * 2, 1.5),
    preset,
    tags: ["animation", "transition", role, "core"],
    sampleText: "",
    previewClass,
  };
}

export const TRANS_CROSSFADE = transitionBlock(
  "crossfade",
  "Cross Fade",
  "Chéo mờ",
  "Scene A mờ tắt / B mờ hiện — chuyển cảnh mặc định.",
  "crossfade",
  "mv-block-trans-crossfade",
  0.6,
);

export const TRANS_SWIPE = transitionBlock(
  "swipe",
  "Swipe",
  "Vuốt",
  "Scene mới đẩy từ cạnh (thường từ phải).",
  "swipe",
  "mv-block-trans-swipe",
  0.55,
);

export const TRANS_PUSH = transitionBlock(
  "push",
  "Push",
  "Đẩy",
  "Scene cũ bị đẩy ra khi scene mới vào.",
  "push",
  "mv-block-trans-push",
  0.55,
);

export const TRANSITION_BLOCKS: MotionBlock[] = [
  TRANS_CROSSFADE,
  TRANS_SWIPE,
  TRANS_PUSH,
];
