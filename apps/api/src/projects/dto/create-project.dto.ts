import { IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateProjectDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;
}
