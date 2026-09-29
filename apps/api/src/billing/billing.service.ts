import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { isUniqueViolation } from "../common/pg-errors";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { user } from "../db/schema/auth";
import { walletLedger } from "../db/schema/misc";
import { PolarService } from "./polar.service";

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly polar: PolarService,
  ) {}

  // Balance is derived by summing the ledger, never stored as a mutable
  // counter - matches the original Supabase `wallet_balance_cents()` design.
  async getBalanceCents(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ sum: sql<string>`coalesce(sum(${walletLedger.amountCents}), 0)` })
      .from(walletLedger)
      .where(eq(walletLedger.userId, userId));
    return Number(row?.sum ?? 0);
  }

  async createTopupCheckout(userId: string, origin: string, amountUsd: number): Promise<{ checkoutUrl: string }> {
    const account = await this.db.query.user.findFirst({ where: eq(user.id, userId) });
    const amountCents = Math.round(amountUsd * 100);
    const { url } = await this.polar.createTopupCheckout({
      userId,
      email: account?.email,
      amountCents,
      successUrl: `${origin}/dashboard/topup?checkout=success`,
    });
    return { checkoutUrl: url };
  }

  // external_ref (the Polar order id) is unique - a retried webhook delivery
  // hits the conflict below and credits nothing twice.
  async creditFromPolarOrder(input: {
    userId: string;
    amountCents: number;
    currency: string;
    orderId: string;
  }): Promise<{ credited: boolean }> {
    try {
      await this.db.insert(walletLedger).values({
        userId: input.userId,
        amountCents: input.amountCents,
        currency: input.currency,
        kind: "topup",
        externalRef: input.orderId,
        metadata: { source: "polar" },
      });
      return { credited: true };
    } catch (error) {
      if (isUniqueViolation(error)) return { credited: false };
      throw error;
    }
  }
}
