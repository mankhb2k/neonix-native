import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { projectRevisions, projects } from "./projects";
import { workspaces } from "./identity";

// Preserves the legacy Render Pipeline schema contract. Same
// text-vs-uuid user-id fix as the other schema files.
//
// Deliberately NOT ported (per the consolidated migration research, all
// confirmed dead/inapplicable, not a shortcut):
// - `chunk_manifest_json`/`chunk_manifest_checksum`/`chunk_size`/`chunk_count`/
//   `chunk_parallelism` and the whole `render_job_chunks` table: the
//   migrations' own comments mark this an unshipped draft feature, gated by
//   `RENDER_CHUNK_EXECUTION_ENABLED` which is false in every environment.
// - `runtime_manifest_text`/`runtime_manifest_chunk_count`/`runtime_manifest_sha256`
//   and the `render_internal.*` chunked-upload tables: a workaround for
//   PostgREST's payload/statement-size limits. Express talks to Postgres
//   directly (no PostgREST in the path), so a large `runtime_json` can just
//   be written in one `UPDATE render_jobs SET runtime_json = $1`.
// - The `pgmq`-backed `render_queue_*` functions: replaced by BullMQ per this
//   migration's own design (queue is a dispatch signal only; `status`/
//   `lease_owner`/`heartbeat_at` on this table remain the actual state
//   machine and are kept as-is).

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicRef: text("public_ref")
    .notNull()
    .unique()
    .default(sql`'rnd_' || encode(gen_random_bytes(10), 'hex')`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id")
    .notNull()
    .references(() => projectRevisions.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("queued"),
  presetJson: jsonb("preset_json").notNull().default({}),
  idempotencyKey: text("idempotency_key").notNull(),
  providerRenderId: text("provider_render_id"),
  outputKey: text("output_key"),
  errorCode: text("error_code"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  leaseOwner: text("lease_owner"),
  attemptCount: integer("attempt_count").notNull().default(0),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  artifactPath: text("artifact_path"),
  progress: numeric("progress", { mode: "number" }).notNull().default(0),
  stage: text("stage"),
  metricsJson: jsonb("metrics_json").notNull().default({}),
  runtimeJson: jsonb("runtime_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    "render_jobs_status_check",
    sql`${table.status} in ('queued', 'planning', 'rendering', 'encoding', 'muxing', 'publishing', 'done', 'failed', 'cancelled')`,
  ),
  check("render_jobs_attempt_count_check", sql`${table.attemptCount} >= 0`),
  check("render_jobs_progress_check", sql`${table.progress} between 0 and 1`),
  uniqueIndex("render_jobs_workspace_idempotency_uidx").on(table.workspaceId, table.idempotencyKey),
  index("render_jobs_workspace_idx").on(table.workspaceId, table.createdAt.desc()),
  index("render_jobs_lease_recovery_idx")
    .on(table.heartbeatAt)
    .where(sql`${table.leaseOwner} is not null and ${table.status} not in ('done', 'failed', 'cancelled')`),
  index("render_jobs_status_idx").on(table.status, table.updatedAt),
]);

export const htmlRenderJobs = pgTable("html_render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicRef: text("public_ref")
    .notNull()
    .unique()
    .default(sql`'hrj_' || encode(gen_random_bytes(10), 'hex')`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  htmlRevisionNo: integer("html_revision_no").notNull(),
  status: text("status").notNull().default("queued"),
  outputKey: text("output_key"),
  errorMessage: text("error_message"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  check("html_render_jobs_html_revision_no_check", sql`${table.htmlRevisionNo} >= 1`),
  check(
    "html_render_jobs_status_check",
    sql`${table.status} in ('queued', 'rendering', 'done', 'failed', 'cancelled')`,
  ),
  index("html_render_jobs_workspace_idx").on(table.workspaceId, table.createdAt.desc()),
  index("html_render_jobs_project_idx").on(table.projectId, table.createdAt.desc()),
]);
