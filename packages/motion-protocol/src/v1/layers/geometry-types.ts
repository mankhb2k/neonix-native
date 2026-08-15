/**
 * Kiểu infer geometry — tách để tránh circular với union.
 */
import { z } from "zod";
import type { PathLayerV1Schema, ShapeLayerV1Schema } from "./geometry";

export type ShapeLayerV1 = z.infer<typeof ShapeLayerV1Schema>;
export type PathLayerV1 = z.infer<typeof PathLayerV1Schema>;
