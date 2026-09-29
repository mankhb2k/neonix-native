CREATE TABLE "project_html_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"document_html" text NOT NULL,
	"content_hash" text NOT NULL,
	"document_schema_version" integer DEFAULT 2 NOT NULL,
	"composition_json" jsonb NOT NULL,
	"diagnostics_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"byte_size" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"protocol_revision_id" uuid,
	CONSTRAINT "project_html_revisions_revision_no_check" CHECK ("project_html_revisions"."revision_no" >= 1),
	CONSTRAINT "project_html_revisions_document_html_check" CHECK (char_length("project_html_revisions"."document_html") > 0),
	CONSTRAINT "project_html_revisions_document_schema_version_check" CHECK ("project_html_revisions"."document_schema_version" >= 1),
	CONSTRAINT "project_html_revisions_composition_json_check" CHECK (jsonb_typeof("project_html_revisions"."composition_json") = 'object'),
	CONSTRAINT "project_html_revisions_diagnostics_json_check" CHECK (jsonb_typeof("project_html_revisions"."diagnostics_json") = 'array'),
	CONSTRAINT "project_html_revisions_byte_size_check" CHECK ("project_html_revisions"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"document_json" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source_schema_version" integer DEFAULT 1 NOT NULL,
	"reason" text DEFAULT 'manual' NOT NULL,
	"byte_size" integer,
	CONSTRAINT "project_revisions_revision_no_check" CHECK ("project_revisions"."revision_no" >= 1),
	CONSTRAINT "project_revisions_document_json_check" CHECK (jsonb_typeof("project_revisions"."document_json") = 'object'),
	CONSTRAINT "project_revisions_source_schema_version_check" CHECK ("project_revisions"."source_schema_version" >= 1),
	CONSTRAINT "project_revisions_reason_check" CHECK ("project_revisions"."reason" in ('manual', 'autosave', 'mcp', 'import', 'restore', 'asset_replacement', 'html-import')),
	CONSTRAINT "project_revisions_byte_size_check" CHECK ("project_revisions"."byte_size" is null or "project_revisions"."byte_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_ref" text DEFAULT 'prj_' || encode(gen_random_bytes(10), 'hex') NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled project' NOT NULL,
	"current_revision_no" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"purge_after" timestamp,
	"deleted_by" text,
	"deletion_reason" text,
	"storage_quota_bytes" bigint DEFAULT 1073741824 NOT NULL,
	"source_format" text DEFAULT 'protocol-v2' NOT NULL,
	"create_idempotency_key" text,
	"create_idempotency_hash" text,
	CONSTRAINT "projects_public_ref_unique" UNIQUE("public_ref"),
	CONSTRAINT "projects_title_check" CHECK (char_length(btrim("projects"."title")) between 1 and 200),
	CONSTRAINT "projects_current_revision_no_check" CHECK ("projects"."current_revision_no" >= 0),
	CONSTRAINT "projects_storage_quota_bytes_check" CHECK ("projects"."storage_quota_bytes" between 0 and 1073741824),
	CONSTRAINT "projects_source_format_check" CHECK ("projects"."source_format" in ('protocol-v2', 'html')),
	CONSTRAINT "projects_lifecycle_check" CHECK (("projects"."deleted_at" is null and "projects"."purge_after" is null) or ("projects"."deleted_at" is not null and "projects"."purge_after" is not null and "projects"."purge_after" >= "projects"."deleted_at"))
);
--> statement-breakpoint
ALTER TABLE "project_html_revisions" ADD CONSTRAINT "project_html_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_html_revisions" ADD CONSTRAINT "project_html_revisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_revisions_id_project_uidx" ON "project_revisions" USING btree ("id","project_id");--> statement-breakpoint
ALTER TABLE "project_html_revisions" ADD CONSTRAINT "project_html_revisions_protocol_revision_fk" FOREIGN KEY ("protocol_revision_id","project_id") REFERENCES "public"."project_revisions"("id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_html_revisions_project_revision_uidx" ON "project_html_revisions" USING btree ("project_id","revision_no");--> statement-breakpoint
CREATE UNIQUE INDEX "project_html_revisions_protocol_revision_uidx" ON "project_html_revisions" USING btree ("protocol_revision_id") WHERE "project_html_revisions"."protocol_revision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "project_revisions_project_revision_uidx" ON "project_revisions" USING btree ("project_id","revision_no");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_create_idempotency_uidx" ON "projects" USING btree ("workspace_id","create_idempotency_key") WHERE "projects"."create_idempotency_key" is not null and "projects"."deleted_at" is null;
