/**
 * Kiểu infer structural — tách để tránh circular với union.
 */
import { z } from "zod";
import type {
  AdjustmentLayerV1Schema,
  BoneLayerV1Schema,
  SolidLayerV1Schema,
} from "./structural";

export type BoneLayerV1 = z.infer<typeof BoneLayerV1Schema>;
export type SolidLayerV1 = z.infer<typeof SolidLayerV1Schema>;
export type AdjustmentLayerV1 = z.infer<typeof AdjustmentLayerV1Schema>;
