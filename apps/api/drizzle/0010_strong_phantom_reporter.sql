CREATE TABLE "system_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"kind" text NOT NULL,
	"variant_kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" bigint,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_font_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"family_name" text NOT NULL,
	"license" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_font_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"font_family_id" uuid NOT NULL,
	"version" text NOT NULL,
	"weight" integer NOT NULL,
	"style" text DEFAULT 'normal' NOT NULL,
	"format" text DEFAULT 'woff2' NOT NULL,
	"storage_bucket" text DEFAULT 'neonix-system-fonts' NOT NULL,
	"r2_key" text NOT NULL,
	"public_url" text,
	"content_hash" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subfamily_name" text,
	"postscript_name" text,
	"width_class" text DEFAULT 'normal' NOT NULL,
	"axes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"face_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_font_files" ADD CONSTRAINT "system_font_files_font_family_id_system_font_families_id_fk" FOREIGN KEY ("font_family_id") REFERENCES "public"."system_font_families"("id") ON DELETE cascade ON UPDATE no action;