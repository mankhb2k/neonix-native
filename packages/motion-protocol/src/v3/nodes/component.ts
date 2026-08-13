/**
 * V3 component node — a sealed component instance represented as a scene
 * layer/object.
 *
 * A `component` node places an embedded component definition inside a scene.
 * The node's `transform` acts as the wrapper/group transform for the whole
 * instance; scene-local motion clips may target this node to animate it like
 * a group layer without touching the component's internal nodes.
 *
 * Consumers only touch the component through its public API:
 *   - `payload.variantId` selects an owner-approved variant preset.
 *   - `payload.publicProps` maps publicTarget ids to values (literal or
 *     variable reference) — never raw internal `nodeId.property` paths.
 */
import { z } from "zod";
import { IdSchema } from "../common";
import { ResolvableValueSchema } from "../values";
import { NodeBaseV3Schema } from "./base";

export const ComponentNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      variantId: IdSchema.optional(),
      /** Consumer-supplied values keyed by the component's publicTarget ids. */
      publicProps: z.record(ResolvableValueSchema).default({}),
    })
    .strict(),
}).strict();

export type ComponentNodeV3 = z.infer<typeof ComponentNodeV3Schema>;
