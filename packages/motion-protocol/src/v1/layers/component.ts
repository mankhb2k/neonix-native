/**
 * V1 component layer — a sealed component instance represented as a scene layer.
 *
 * Consumers only touch the component through its public API:
 *   - `payload.variantId` selects an owner-approved variant preset.
 *   - `payload.props` maps prop ids to static, variable, or keyframed values.
 */
import { z } from "zod";
import { IdSchema } from "../common";
import { ComponentPropValueSchema } from "../prop-values";
import { LayerBaseV1Schema } from "./base";

export const ComponentLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      variantId: IdSchema.optional(),
      /** Consumer-supplied values keyed by the component's prop ids. */
      props: z.record(ComponentPropValueSchema).default({}),
    })
    .strict(),
}).strict();

export type ComponentLayerV1 = z.infer<typeof ComponentLayerV1Schema>;
