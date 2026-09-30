CREATE TABLE "project_html_documents" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"html" text NOT NULL,
	"content_hash" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_html_documents_html_check" CHECK (char_length("project_html_documents"."html") > 0),
	CONSTRAINT "project_html_documents_byte_size_check" CHECK ("project_html_documents"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "project_html_documents" ADD CONSTRAINT "project_html_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_html_documents" ADD CONSTRAINT "project_html_documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;