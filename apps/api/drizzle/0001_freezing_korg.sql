CREATE TABLE "account_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"max_active_projects" integer DEFAULT 10 NOT NULL,
	"storage_quota_bytes" bigint DEFAULT 1073741824 NOT NULL,
	"max_upload_bytes" bigint DEFAULT 524288000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_plans_plan_check" CHECK ("account_plans"."plan" in ('free', 'pro')),
	CONSTRAINT "account_plans_max_active_projects_check" CHECK ("account_plans"."max_active_projects" between 1 and 50),
	CONSTRAINT "account_plans_storage_quota_bytes_check" CHECK ("account_plans"."storage_quota_bytes" between 0 and 10737418240),
	CONSTRAINT "account_plans_max_upload_bytes_check" CHECK ("account_plans"."max_upload_bytes" between 1 and 2147483648)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"avatar_path" text,
	"avatar_mime_type" text,
	"avatar_size_bytes" bigint,
	"avatar_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_avatar_size_bytes_check" CHECK ("profiles"."avatar_size_bytes" is null or "profiles"."avatar_size_bytes" between 1 and 5242880)
);
--> statement-breakpoint
CREATE TABLE "team_plans" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"seats_purchased" integer DEFAULT 2 NOT NULL,
	"max_active_projects" integer NOT NULL,
	"storage_quota_bytes" bigint NOT NULL,
	"max_upload_bytes" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_plans_seats_purchased_check" CHECK ("team_plans"."seats_purchased" >= 2)
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "workspace_members_role_check" CHECK ("workspace_members"."role" in ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'team' NOT NULL,
	CONSTRAINT "workspaces_name_check" CHECK (char_length(btrim("workspaces"."name")) between 1 and 120),
	CONSTRAINT "workspaces_kind_check" CHECK ("workspaces"."kind" in ('personal', 'team'))
);
--> statement-breakpoint
ALTER TABLE "account_plans" ADD CONSTRAINT "account_plans_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_plans" ADD CONSTRAINT "team_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner_per_workspace" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_one_personal_per_owner" ON "workspaces" USING btree ("created_by") WHERE "workspaces"."kind" = 'personal';