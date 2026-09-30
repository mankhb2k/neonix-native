import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { JoinWaitlistDto } from "./dto/join-waitlist.dto";
import { WaitlistService } from "./waitlist.service";

// Public - no CurrentUserGuard. This is the pre-signup marketing-site form,
// called before the visitor has any account at all.
@Controller("v1/waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @HttpCode(200)
  async join(@Body() dto: JoinWaitlistDto, @Res({ passthrough: true }) res: Response) {
    const { alreadySignedUp } = await this.waitlist.join(dto.email);
    res.status(alreadySignedUp ? 200 : 201);
    return {
      message: alreadySignedUp
        ? "This email is already on the list."
        : "You are on the list. We will let you know when the API is ready.",
    };
  }
}
