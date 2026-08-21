import { z } from "zod";
import { V2LayerBaseSchema } from "./base";

/** A hierarchy-only container. Groups do not paint or clip their frame. */
export const V2GroupLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("group"),
}).strict();

export type V2GroupLayer = z.infer<typeof V2GroupLayerSchema>;
