import { IsString } from "class-validator";

export class ValidateDocumentDto {
  @IsString()
  html!: string;
}
