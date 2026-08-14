/**
 * Layer instance component trên cây project.
 *
 * Consumer chỉ đụng payload.componentId, variantId?, props.
 */
import { z } from "zod";
import { IdSchema } from "../common";
import { ComponentPropValueSchema } from "../components/prop-values";
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
