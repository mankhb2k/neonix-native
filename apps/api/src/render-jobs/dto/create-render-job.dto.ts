import { IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateRenderJobDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  revisionId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsObject()
  presetJson?: Record<string, unknown>;
}
