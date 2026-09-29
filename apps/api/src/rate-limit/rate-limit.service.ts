import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";

// Replaces `check_and_increment_rate_limit()`: a fixed-window request
// counter for public/unauthenticated endpoints (e.g. a future HTML
// playground compile route), keyed by caller IP or similar. Ported as one
// SQL statement (not read-then-write in JS) to keep the increment atomic
// under concurrent requests, and computes `now()`/the window boundary in
// Postgres rather than JS - same clock-source rule as every other
// timestamp in this migration (see project memory: never mix an app-clock
// `Date.now()` with a DB-clock comparison).
@Injectable()
export class RateLimitService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async checkAndIncrement(bucketKey: string, windowSeconds: number, maxRequests: number): Promise<boolean> {
    const result = await this.db.execute<{ request_count: number }>(sql`
      with computed as (
        select to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}) as window_start
      ),
      cleanup as (
        delete from playground_rate_limits
        where bucket_key = ${bucketKey}
          and window_start < (select window_start from computed) - (${windowSeconds} * 3) * interval '1 second'
      )
      insert into playground_rate_limits (bucket_key, window_start, request_count)
      select ${bucketKey}, window_start, 1 from computed
      on conflict (bucket_key, window_start)
      do update set request_count = playground_rate_limits.request_count + 1
      returning request_count
    `);
    const row = result.rows[0];
    return Number(row.request_count) <= maxRequests;
  }
}
