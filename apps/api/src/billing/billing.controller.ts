import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { BillingService } from "./billing.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@UseGuards(CurrentUserGuard)
@Controller("v1/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("balance")
  async balance(@CurrentUser() userId: string) {
    const balanceCents = await this.billing.getBalanceCents(userId);
    return { balanceCents, balanceUsd: balanceCents / 100 };
  }

  @Post("checkout")
  @HttpCode(200)
  async checkout(@CurrentUser() userId: string, @Body() dto: CreateCheckoutDto, @Req() req: Request) {
    const origin = req.headers.origin ?? process.env.WEB_APP_URL ?? "";
    return this.billing.createTopupCheckout(userId, origin, dto.amountUsd);
  }
}
