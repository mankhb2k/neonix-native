import { IsIn, IsObject, IsOptional } from "class-validator";

const REVISION_REASONS = ["manual", "autosave", "mcp", "import", "restore", "asset_replacement", "html-import"];

export class CreateRevisionDto {
  @IsObject()
  documentJson!: Record<string, unknown>;

  @IsOptional()
  @IsIn(REVISION_REASONS)
  reason?: string;
}
