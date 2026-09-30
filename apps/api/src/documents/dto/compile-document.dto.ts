import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CompileDocumentDto {
  @IsString()
  html!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(86_400_000)
  durationMs?: number;
}
