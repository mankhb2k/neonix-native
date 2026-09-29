import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { and, eq, lt } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { playgroundRateLimits } from "../db/schema/misc";
import { RateLimitModule } from "./rate-limit.module";
import { RateLimitService } from "./rate-limit.service";

const bucketKeys: string[] = [];

afterAll(async () => {
  for (const key of bucketKeys) {
    await db.delete(playgroundRateLimits).where(eq(playgroundRateLimits.bucketKey, key));
  }
});

describe("RateLimitService (Nest, real Neon dev DB)", () => {
  it("allows requests under the limit and blocks once the limit is reached", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, RateLimitModule] }).compile();
    const service = moduleRef.get(RateLimitService);

    const bucketKey = `test-bucket-${randomUUID()}`;
    bucketKeys.push(bucketKey);

    expect(await service.checkAndIncrement(bucketKey, 60, 3)).toBe(true);
    expect(await service.checkAndIncrement(bucketKey, 60, 3)).toBe(true);
    expect(await service.checkAndIncrement(bucketKey, 60, 3)).toBe(true);
    expect(await service.checkAndIncrement(bucketKey, 60, 3)).toBe(false);
  });

  it("cleans up this bucket's windows older than 3x the window size", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, RateLimitModule] }).compile();
    const service = moduleRef.get(RateLimitService);

    const bucketKey = `test-bucket-cleanup-${randomUUID()}`;
    bucketKeys.push(bucketKey);

    await db.insert(playgroundRateLimits).values({
      bucketKey,
      windowStart: new Date(Date.now() - 10 * 60 * 60 * 1000),
      requestCount: 5,
    });

    await service.checkAndIncrement(bucketKey, 60, 100);

    const remainingOldRows = await db.query.playgroundRateLimits.findMany({
      where: and(
        eq(playgroundRateLimits.bucketKey, bucketKey),
        lt(playgroundRateLimits.windowStart, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    });
    expect(remainingOldRows).toHaveLength(0);
  });

  it("tracks separate buckets independently", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, RateLimitModule] }).compile();
    const service = moduleRef.get(RateLimitService);

    const bucketA = `test-bucket-a-${randomUUID()}`;
    const bucketB = `test-bucket-b-${randomUUID()}`;
    bucketKeys.push(bucketA, bucketB);

    expect(await service.checkAndIncrement(bucketA, 60, 1)).toBe(true);
    expect(await service.checkAndIncrement(bucketA, 60, 1)).toBe(false);
    expect(await service.checkAndIncrement(bucketB, 60, 1)).toBe(true);
  });
});
