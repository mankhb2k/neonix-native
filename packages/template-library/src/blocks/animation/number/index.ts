import type { MotionBlock } from "../../types";

/** Number Animation — đếm / rolling số */

export const TEXT_COUNTER: MotionBlock = {
  id: "text.counter",
  name: "Counter",
  nameVi: "Đếm số tăng dần",
  family: "animation",
  kind: "text",
  intent: "entrance",
  shelf: "number-animation",
  description:
    "Animate số 0 → đích trên content text.number / percentage. sampleText = số.",
  duration: 1.2,
  durationMin: 0.6,
  durationMax: 2.5,
  preset: "counter",
  tags: ["animation", "number-animation", "data", "vi-safe", "core", "counter"],
  sampleText: "100",
  previewClass: "mv-block-text-counter",
};

export const NUMBER_ANIMATION_BLOCKS: MotionBlock[] = [TEXT_COUNTER];

/** Planned: count-down, rolling-number, money-counter, percentage-counter */
