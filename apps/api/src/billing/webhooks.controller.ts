import { Controller, Post, Req, Res } from "@nestjs/common";
import { webhooks } from "@polar-sh/sdk/2027-01";
import type { Request, Response } from "express";
import { BillingService } from "./billing.service";

interface PolarOrderPaidEvent {
  type: "order.paid";
  data: {
    id: string;
    total_amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  };
}

@Controller()
export class WebhooksController {
  constructor(private readonly billing: BillingService) {}

  // Body arrives as a raw Buffer, not JSON-parsed - see main.ts, which mounts
  // express.raw() for this exact path before the global express.json(). Polar's
  // signature covers the exact bytes it sent; re-serializing would break it.
  @Post("webhooks/polar")
  async polar(@Req() req: Request, @Res() res: Response) {
    const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error("[webhooks/polar] POLAR_WEBHOOK_SECRET is not configured");
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }

    const rawBody = req.body as Buffer;
    let event: PolarOrderPaidEvent;
    try {
      event = (await webhooks.validateEvent(
        rawBody,
        req.headers as Record<string, string>,
        secret,
      )) as PolarOrderPaidEvent;
    } catch {
      res.status(403).json({ error: "invalid_signature" });
      return;
    }

    if (event.type !== "order.paid") {
      res.status(200).json({ received: true });
      return;
    }

    const order = event.data;
    const userId = order.metadata?.userId;
    if (typeof userId !== "string" || !userId) {
      console.error("[webhooks/polar] order.paid missing metadata.userId", { orderId: order.id });
      res.status(200).json({ error: "missing_user_metadata" });
      return;
    }

    try {
      await this.billing.creditFromPolarOrder({
        userId,
        amountCents: order.total_amount,
        currency: order.currency,
        orderId: order.id,
      });
    } catch (error) {
      console.error("[webhooks/polar] failed to credit wallet", error);
      res.status(500).json({ error: "ledger_write_failed" });
      return;
    }

    res.status(200).json({ received: true });
  }
}
