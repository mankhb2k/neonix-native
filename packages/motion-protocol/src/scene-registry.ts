import { z } from "zod";

const IdSchema = z.string().min(1).max(128);
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Expected semantic version");

const SceneRoleSchema = z.enum([
  "hook",
  "pain",
  "problem",
  "solution",
  "benefit",
  "demo",
  "offer",
  "proof",
  "cta",
  "logo",
]);

const MapKindSchema = z.enum(["product-tvc", "infographic", "cut-out", "mascot"]);

const DurationRangeSchema = z
  .object({
    min: z.number().positive(),
    default: z.number().positive(),
    max: z.number().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.min > value.default || value.default > value.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recommendedDuration requires min <= default <= max",
      });
    }
  });

export const SceneComponentEntrySchema = z
  .object({
    componentId: IdSchema,
    version: SemverSchema,
    fixturePath: z.string().min(1),
    name: z.string().min(1),
    sceneRoles: z.array(SceneRoleSchema).min(1),
    maps: z.array(MapKindSchema).min(1),
    recommendedDuration: DurationRangeSchema,
    requiredInputs: z.array(IdSchema),
    optionalInputs: z.array(IdSchema),
    demoProjectId: z.string().min(1).nullable(),
    demoProjectPath: z.string().min(1).nullable(),
    patchPath: z.string().min(1).nullable(),
    status: z.enum(["draft", "golden", "accepted"]),
  })
  .strict();

export const SceneComponentRegistrySchema = z
  .object({
    version: z.literal(1),
    components: z.array(SceneComponentEntrySchema).min(1),
  })
  .strict();

export type SceneComponentEntry = z.infer<typeof SceneComponentEntrySchema>;
export type SceneComponentRegistry = z.infer<typeof SceneComponentRegistrySchema>;

export function parseSceneComponentRegistry(input: unknown): SceneComponentRegistry {
  return SceneComponentRegistrySchema.parse(input);
}
