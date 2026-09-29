CREATE TABLE "project_font_families" (
	"project_id" uuid NOT NULL,
	"font_family_id" uuid NOT NULL,
	"alias" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_font_families_project_id_font_family_id_pk" PRIMARY KEY("project_id","font_family_id"),
	CONSTRAINT "project_font_families_alias_check" CHECK ("project_font_families"."alias" is null or length(btrim("project_font_families"."alias")) between 1 and 160)
);
--> statement-breakpoint
CREATE TABLE "user_font_faces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"font_family_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"face_key" text NOT NULL,
	"version" text DEFAULT 'default' NOT NULL,
	"weight" integer NOT NULL,
	"style" text DEFAULT 'normal' NOT NULL,
	"width_class" text DEFAULT 'normal' NOT NULL,
	"format" text NOT NULL,
	"subfamily_name" text,
	"postscript_name" text,
	"axes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_font_faces_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "user_font_faces_weight_check" CHECK ("user_font_faces"."weight" between 1 and 1000),
	CONSTRAINT "user_font_faces_style_check" CHECK ("user_font_faces"."style" in ('normal', 'italic', 'oblique')),
	CONSTRAINT "user_font_faces_width_class_check" CHECK ("user_font_faces"."width_class" in (
      'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
      'normal',
      'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'
    )),
	CONSTRAINT "user_font_faces_format_check" CHECK ("user_font_faces"."format" in ('woff2', 'woff', 'ttf'))
);
--> statement-breakpoint
CREATE TABLE "user_font_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"slug" text NOT NULL,
	"family_name" text NOT NULL,
	"license" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_font_families_slug_check" CHECK ("user_font_families"."slug" ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
	CONSTRAINT "user_font_families_family_name_check" CHECK (length(btrim("user_font_families"."family_name")) between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "project_font_families" ADD CONSTRAINT "project_font_families_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_font_families" ADD CONSTRAINT "project_font_families_font_family_id_user_font_families_id_fk" FOREIGN KEY ("font_family_id") REFERENCES "public"."user_font_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_font_families" ADD CONSTRAINT "project_font_families_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_font_faces" ADD CONSTRAINT "user_font_faces_font_family_id_user_font_families_id_fk" FOREIGN KEY ("font_family_id") REFERENCES "public"."user_font_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_font_faces" ADD CONSTRAINT "user_font_faces_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_font_families" ADD CONSTRAINT "user_font_families_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_font_families" ADD CONSTRAINT "user_font_families_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_font_families_project_idx" ON "project_font_families" USING btree ("project_id") WHERE "project_font_families"."enabled";--> statement-breakpoint
CREATE UNIQUE INDEX "user_font_faces_family_face_uidx" ON "user_font_faces" USING btree ("font_family_id","face_key");--> statement-breakpoint
CREATE INDEX "user_font_faces_lookup_idx" ON "user_font_faces" USING btree ("font_family_id","width_class","weight","style") WHERE "user_font_faces"."enabled";--> statement-breakpoint
CREATE UNIQUE INDEX "user_font_families_workspace_slug_uidx" ON "user_font_families" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_font_families_workspace_name_uidx" ON "user_font_families" USING btree ("workspace_id",lower("family_name"));--> statement-breakpoint
CREATE INDEX "user_font_families_workspace_idx" ON "user_font_families" USING btree ("workspace_id","family_name") WHERE "user_font_families"."enabled";