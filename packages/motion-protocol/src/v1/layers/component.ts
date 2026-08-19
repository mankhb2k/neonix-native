/**
 * Layer instance component trên cây project — leaf authoring.
 *
 * Wrapper atoms (vỏ): frame, transform, timing, zIndex, opacity,
 * compositing, effects (+ name khi cần đọc/hiển thị).
 * Ruột public: payload.componentId, variantId?, props.
 * Compiler bung thành wrapper group + internals. Consumer không sửa internals.
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
