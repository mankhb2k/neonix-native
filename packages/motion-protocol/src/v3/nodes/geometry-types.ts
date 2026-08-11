/**
 * Inferred V3 geometry node types (kept separate to avoid circular
 * imports between per-kind schema modules and the union index).
 */
import { z } from "zod";
import type { PathNodeV3Schema, ShapeNodeV3Schema } from "./geometry";

export type ShapeNodeV3 = z.infer<typeof ShapeNodeV3Schema>;
export type PathNodeV3 = z.infer<typeof PathNodeV3Schema>;
