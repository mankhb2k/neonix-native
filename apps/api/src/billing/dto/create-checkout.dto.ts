import { IsNumber, Max, Min } from "class-validator";

const MIN_TOPUP_USD = 10;
const MAX_TOPUP_USD = 2000;

export class CreateCheckoutDto {
  @IsNumber()
  @Min(MIN_TOPUP_USD)
  @Max(MAX_TOPUP_USD)
  amountUsd!: number;
}
