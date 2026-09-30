import { IsInt, IsNotEmptyObject, Min } from "class-validator";

export class ApplyJsonPatchDto {
  @IsInt()
  @Min(1)
  expectedProtocolRevisionNo!: number;

  // Deep-shape validated by `applyMotionProtocolV2Patch`'s own Zod schema
  // (MotionProtocolV2PatchSchema) - not re-validated here.
  @IsNotEmptyObject()
  patch!: Record<string, unknown>;
}
