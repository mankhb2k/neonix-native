/**
 * Inferred V3 structural node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type {
  AdjustmentLayerV3Schema,
  BoneLayerV3Schema,
  GroupLayerV3Schema,
  SolidLayerV3Schema,
} from "./structural";

export type GroupLayerV3 = z.infer<typeof GroupLayerV3Schema>;
export type BoneLayerV3 = z.infer<typeof BoneLayerV3Schema>;
export type SolidLayerV3 = z.infer<typeof SolidLayerV3Schema>;
export type AdjustmentLayerV3 = z.infer<typeof AdjustmentLayerV3Schema>;
