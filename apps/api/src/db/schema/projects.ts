import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./identity";

// Ported from supabase/migrations (Section B: Projects & Revisions). Same
// text-vs-uuid user-id fix as identity.ts. `public_ref`/`gen_random_bytes`
// need the pgcrypto extension enabled on the database (see the extension
// statement prepended to this section's migration - gen_random_uuid() is a
// Postgres core builtin and needs nothing, but gen_random_bytes() does not).

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicRef: text("public_ref")
    .notNull()
    .unique()
    .default(sql`'prj_' || encode(gen_random_bytes(10), 'hex')`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled project"),
  currentRevisionNo: integer("current_revision_no").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAfter: timestamp("purge_after", { withTimezone: true }),
  deletedBy: text("deleted_by").references(() => user.id, { onDelete: "set null" }),
  deletionReason: text("deletion_reason"),
  storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" }).notNull().default(1073741824),
  sourceFormat: text("source_format").notNull().default("protocol-v2"),
  createIdempotencyKey: text("create_idempotency_key"),
  createIdempotencyHash: text("create_idempotency_hash"),
}, (table) => [
  check("projects_title_check", sql`char_length(btrim(${table.title})) between 1 and 200`),
  check("projects_current_revision_no_check", sql`${table.currentRevisionNo} >= 0`),
  check("projects_storage_quota_bytes_check", sql`${table.storageQuotaBytes} between 0 and 1073741824`),
  check("projects_source_format_check", sql`${table.sourceFormat} in ('protocol-v2', 'html')`),
  check(
    "projects_lifecycle_check",
    sql`(${table.deletedAt} is null and ${table.purgeAfter} is null) or (${table.deletedAt} is not null and ${table.purgeAfter} is not null and ${table.purgeAfter} >= ${table.deletedAt})`,
  ),
  uniqueIndex("projects_create_idempotency_uidx")
    .on(table.workspaceId, table.createIdempotencyKey)
    .where(sql`${table.createIdempotencyKey} is not null and ${table.deletedAt} is null`),
]);

export const projectRevisions = pgTable("project_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  revisionNo: integer("revision_no").notNull(),
  documentJson: jsonb("document_json").notNull(),
  contentHash: text("content_hash").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sourceSchemaVersion: integer("source_schema_version").notNull().default(1),
  reason: text("reason").notNull().default("manual"),
  byteSize: integer("byte_size"),
}, (table) => [
  check("project_revisions_revision_no_check", sql`${table.revisionNo} >= 1`),
  check("project_revisions_document_json_check", sql`jsonb_typeof(${table.documentJson}) = 'object'`),
  check("project_revisions_source_schema_version_check", sql`${table.sourceSchemaVersion} >= 1`),
  check(
    "project_revisions_reason_check",
    sql`${table.reason} in ('manual', 'autosave', 'mcp', 'import', 'restore', 'asset_replacement', 'html-import')`,
  ),
  check("project_revisions_byte_size_check", sql`${table.byteSize} is null or ${table.byteSize} >= 0`),
  uniqueIndex("project_revisions_project_revision_uidx").on(table.projectId, table.revisionNo),
  uniqueIndex("project_revisions_id_project_uidx").on(table.id, table.projectId),
]);

// Track A (raw HTML) project storage. Deliberately independent from
// `projectRevisions`/Track B - no FK, no revision history, one row per
// track:'html' project, overwritten in place on every update. This replaces
// an earlier `project_html_revisions` design that linked each HTML revision
// to a `project_revisions` row via a composite FK (`protocol_revision_id` +
// `project_id`); that coupling was a deliberate architecture decision to
// remove (see project memory) - Track A and Track B are now fully
// independent project types with no cross-referencing constraint. Bridging
// from Track A to Track B happens via `ProjectsService.convertHtmlToJsonProject`,
// which creates a brand new, separate Track B project rather than mutating
// this one in place.
export const projectHtmlDocuments = pgTable("project_html_documents", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  html: text("html").notNull(),
  contentHash: text("content_hash").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("project_html_documents_html_check", sql`char_length(${table.html}) > 0`),
  check("project_html_documents_byte_size_check", sql`${table.byteSize} > 0`),
]);
