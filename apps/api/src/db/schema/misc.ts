import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./identity";

// Ported from supabase/migrations (Section F: Misc). Same text-vs-uuid
// user-id fix as the other schema files. wallet_ledger existed once already
// in supabase/migrations/20260929000000_wallet_ledger.sql with a uuid
// user_id - this is the corrected apps/api version, text-typed to match
// Better Auth's user.id; the supabase one is left as historical record only.

export const auditEvents = pgTable("audit_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  actorClientId: text("actor_client_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_events_workspace_idx").on(table.workspaceId, table.createdAt.desc()),
]);

export const playgroundRateLimits = pgTable("playground_rate_limits", {
  bucketKey: text("bucket_key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.bucketKey, table.windowStart] }),
]);

export const waitlistSignups = pgTable("api_waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("api_waitlist_signups_email_idx").on(table.email),
]);

export const walletLedger = pgTable("wallet_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("usd"),
  kind: text("kind").notNull(),
  externalRef: text("external_ref"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("wallet_ledger_amount_cents_check", sql`${table.amountCents} <> 0`),
  check(
    "wallet_ledger_kind_check",
    sql`${table.kind} in ('topup', 'export_charge', 'refund', 'adjustment')`,
  ),
  uniqueIndex("wallet_ledger_external_ref_idx")
    .on(table.externalRef)
    .where(sql`${table.externalRef} is not null`),
  index("wallet_ledger_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
]);
