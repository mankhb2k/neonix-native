import { IsString } from "class-validator";

export class JoinWaitlistDto {
  @IsString()
  email!: string;
}
