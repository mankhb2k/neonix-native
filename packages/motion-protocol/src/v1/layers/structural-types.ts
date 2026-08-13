/**
 * Inferred V1 structural node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type {
  AdjustmentLayerV1Schema,
  BoneLayerV1Schema,
  GroupLayerV1Schema,
  SolidLayerV1Schema,
} from "./structural";

export type GroupLayerV1 = z.infer<typeof GroupLayerV1Schema>;
export type BoneLayerV1 = z.infer<typeof BoneLayerV1Schema>;
export type SolidLayerV1 = z.infer<typeof SolidLayerV1Schema>;
export type AdjustmentLayerV1 = z.infer<typeof AdjustmentLayerV1Schema>;
