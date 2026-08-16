/**
 * Size box local trước transform. Kích thước vẽ = frame * scale.
 *
 * `frame` chỉ trả lời layer rộng/cao bao nhiêu. Không phải timeline frame,
 * không phải container, không clip, không điều khiển children.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";

export const FrameSchema = z
  .object({
    width: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension),
    height: z
      .number()
      .finite()
      .nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension),
  })
  .strict();

export type MotionFrame = z.infer<typeof FrameSchema>;

/** Layers that must have frame.width/height — every visual layer. */
export const FRAME_REQUIRED_LAYER_TYPES = [
  "group",
  "component",
  "text",
  "image",
  "svg",
  "video",
  "shape",
  "path",
  "solid",
  "bone",
  "adjustment",
] as const;

/** Layers that must not have a frame. */
export const FRAME_FORBIDDEN_LAYER_TYPES = ["audio", "camera"] as const;
