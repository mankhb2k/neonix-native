import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
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

export const projectHtmlRevisions = pgTable("project_html_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  revisionNo: integer("revision_no").notNull(),
  documentHtml: text("document_html").notNull(),
  contentHash: text("content_hash").notNull(),
  documentSchemaVersion: integer("document_schema_version").notNull().default(2),
  compositionJson: jsonb("composition_json").notNull(),
  diagnosticsJson: jsonb("diagnostics_json").notNull().default([]),
  byteSize: integer("byte_size").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  protocolRevisionId: uuid("protocol_revision_id"),
}, (table) => [
  check("project_html_revisions_revision_no_check", sql`${table.revisionNo} >= 1`),
  check("project_html_revisions_document_html_check", sql`char_length(${table.documentHtml}) > 0`),
  check("project_html_revisions_document_schema_version_check", sql`${table.documentSchemaVersion} >= 1`),
  check("project_html_revisions_composition_json_check", sql`jsonb_typeof(${table.compositionJson}) = 'object'`),
  check("project_html_revisions_diagnostics_json_check", sql`jsonb_typeof(${table.diagnosticsJson}) = 'array'`),
  check("project_html_revisions_byte_size_check", sql`${table.byteSize} > 0`),
  uniqueIndex("project_html_revisions_project_revision_uidx").on(table.projectId, table.revisionNo),
  uniqueIndex("project_html_revisions_protocol_revision_uidx")
    .on(table.protocolRevisionId)
    .where(sql`${table.protocolRevisionId} is not null`),
  foreignKey({
    columns: [table.protocolRevisionId, table.projectId],
    foreignColumns: [projectRevisions.id, projectRevisions.projectId],
    name: "project_html_revisions_protocol_revision_fk",
  }).onDelete("restrict"),
]);
