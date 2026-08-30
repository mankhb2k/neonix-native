import { z } from "zod";
import { V2LayerBaseSchema } from "./base";
import { V2Render3DSchema } from "../render3d";

/** A hierarchy-only container. Groups do not paint or clip their frame. */
export const V2GroupLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("group"),
  /** Optional local 3D context for this group's descendants. */
  render3d: V2Render3DSchema.optional(),
}).strict();

export type V2GroupLayer = z.infer<typeof V2GroupLayerSchema>;
