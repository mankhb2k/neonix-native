/**
 * Inferred V1 geometry node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type { PathLayerV1Schema, ShapeLayerV1Schema } from "./geometry";

export type ShapeLayerV1 = z.infer<typeof ShapeLayerV1Schema>;
export type PathLayerV1 = z.infer<typeof PathLayerV1Schema>;
