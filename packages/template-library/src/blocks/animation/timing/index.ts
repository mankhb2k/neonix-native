/**
 * Timing — NOT MotionBlocks.
 * delay / duration / easing / repeat live on every animation via shared schema.
 */

export const EasingIdSchema = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "spring",
] as const;

export type EasingId = (typeof EasingIdSchema)[number];

export const TIMING_DEFAULTS = {
  delay: 0,
  duration: 0.6,
  easing: "easeOut" as EasingId,
  repeat: 0,
  loop: false,
  pingPong: false,
  reverse: false,
} as const;

export const TIMING_FIELDS = [
  "delay",
  "duration",
  "repeat",
  "loop",
  "pingPong",
  "reverse",
  "easing",
] as const;
