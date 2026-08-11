/**
 * Inferred V3 structural node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type {
  AdjustmentNodeV3Schema,
  BoneNodeV3Schema,
  GroupNodeV3Schema,
  SolidNodeV3Schema,
} from "./structural";

export type GroupNodeV3 = z.infer<typeof GroupNodeV3Schema>;
export type BoneNodeV3 = z.infer<typeof BoneNodeV3Schema>;
export type SolidNodeV3 = z.infer<typeof SolidNodeV3Schema>;
export type AdjustmentNodeV3 = z.infer<typeof AdjustmentNodeV3Schema>;
