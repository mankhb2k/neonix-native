/**
 * Inferred V3 geometry node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type { PathLayerV3Schema, ShapeLayerV3Schema } from "./geometry";

export type ShapeLayerV3 = z.infer<typeof ShapeLayerV3Schema>;
export type PathLayerV3 = z.infer<typeof PathLayerV3Schema>;
