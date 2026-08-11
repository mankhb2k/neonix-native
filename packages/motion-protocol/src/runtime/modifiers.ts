import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema } from "./common";
import { LayoutConstraintSchema, LayoutItemPolicySchema } from "./layout";
import { ResolvableValueSchema } from "./values";

export const MotionModifierSchema = z.discriminatedUnion("type", [
  z.object({
    id: IdSchema,
    type: z.literal("motion-path"),
    pathNodeId: IdSchema,
    contourId: IdSchema,
    progress: FiniteNumberSchema.min(0).max(1),
    orientToPath: z.boolean(),
    rotationOffset: FiniteNumberSchema,
    startOffset: FiniteNumberSchema.min(0).max(1).default(0),
    endOffset: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("path-morph"),
    from: z.union([z.literal("base"), IdSchema]),
    to: IdSchema,
    progress: ResolvableValueSchema,
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("secondary-motion"),
    driverNodeId: IdSchema,
    chainNodeIds: z.array(IdSchema).min(1).max(MOTION_PROTOCOL_LIMITS.secondaryMotionChainLength),
    stiffness: FiniteNumberSchema.positive(),
    damping: FiniteNumberSchema.nonnegative(),
    lag: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
    amplitude: FiniteNumberSchema,
    axis: z.literal("rotation"), // TODO: implement position axis
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("trim-path"),
    start: FiniteNumberSchema.min(0).max(1),
    end: FiniteNumberSchema.min(0).max(1),
    offset: FiniteNumberSchema.default(0),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("path-bend"),
    amount: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.pathBendAmount).max(MOTION_PROTOCOL_LIMITS.pathBendAmount),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("constraint"),
    kind: z.enum(["look-at", "copy-position", "copy-rotation"]),
    targetNodeId: IdSchema,
    weight: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("parallax"),
    factor: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.parallaxFactor).max(MOTION_PROTOCOL_LIMITS.parallaxFactor).default(1),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("layout"),
    constraint: LayoutConstraintSchema,
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("layout-item"),
    policy: LayoutItemPolicySchema.default({}),
  }).strict(),
]);
