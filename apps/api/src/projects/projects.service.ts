import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { compileDocument, stampNodeIds } from "@motionvideo/html-compiler";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { AuthzService } from "../authz/authz.service";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/pg-errors";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { projectHtmlDocuments, projectRevisions, projects } from "../db/schema/projects";
import { QuotasService } from "../quotas/quotas.service";
import { HTML_COMPILER_FONT_ASSETS } from "./html-compiler-font-assets";
import { validateRawHtmlDocument } from "./validate-raw-html";

function contentHashOf(documentJson: unknown): string {
  return createHash("sha256").update(JSON.stringify(documentJson)).digest("hex");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// html-compiler unconditionally rejects any `style="..."` attribute on any
// element (`html-inline-style-unsupported` - it's a hard parser rule, not a
// gap in this port). Track A's own structural validator requires the body
// (or its wrapper) to declare an inline width/height style, purely so a
// future headless-browser renderer can size its viewport without a compile
// step. That inline style is redundant for html-compiler, which already
// reads composition size from the `neonix-document` meta tag, so it's
// stripped from a *copy* of the html right before compiling - the stored
// document (and whatever the caller wrote) is never touched. Any OTHER
// inline style the author used (on content elements) is a genuine
// compiler-compatibility issue and is correctly left to fail with a real
// diagnostic - Track A authors who want a convertible document need to
// style content via <style> blocks + class/tag selectors, matching Track
// B's own supported CSS subset.
function stripBodyInlineStyleForCompile(html: string): string {
  return html.replace(/<body\b([^>]*)>/i, (_full, attrs: string) => {
    const withoutStyle = attrs.replace(/\s*\bstyle\s*=\s*(["'])[^"']*\1/i, "");
    return `<body${withoutStyle}>`;
  });
}

function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  const decoded = match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return decoded || null;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly authz: AuthzService,
    private readonly quotas: QuotasService,
  ) {}

  private async loadForMember(userId: string, projectId: string) {
    const project = await this.db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return null;
    const isMember = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "viewer");
    if (!isMember) return null;
    return project;
  }

  async list(userId: string, workspaceId: string) {
    const canView = await this.authz.hasWorkspaceRole(userId, workspaceId, "viewer");
    if (!canView) throw new ApiError(404, "Workspace not found");
    return this.db.query.projects.findMany({
      where: and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
      orderBy: desc(projects.updatedAt),
    });
  }

  // Replaces `enforce_project_count_limit()` (Postgres trigger, SQLSTATE
  // P0003): resolves the workspace's active-project limit and rejects
  // before inserting if it's already at the ceiling.
  async create(userId: string, workspaceId: string, title: string | undefined) {
    const canEdit = await this.authz.hasWorkspaceRole(userId, workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Workspace not found");

    const workspace = await this.quotas.getWorkspaceOrThrow(workspaceId);
    const limit = await this.quotas.getActiveProjectLimit(workspace);
    const count = await this.db.$count(projects, and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)));
    if (count >= limit) {
      throw new ApiError(409, `Workspace is at its plan limit of ${limit} active projects`, "project_limit_reached");
    }

    const [project] = await this.db
      .insert(projects)
      .values({ workspaceId, title: title?.trim() || "Untitled project", createdBy: userId })
      .returning();
    return project;
  }

  async getForMember(userId: string, projectId: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    return project;
  }

  // Replaces `touch_project_activity()` (BEFORE UPDATE trigger): bumps
  // last_activity_at only when title changes - title is the only field this
  // route can change, so it always bumps it.
  async update(userId: string, projectId: string, title: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");

    const [updated] = await this.db
      .update(projects)
      .set({ title, updatedAt: sql`now()`, lastActivityAt: sql`now()` })
      .where(eq(projects.id, project.id))
      .returning();
    return updated;
  }

  // Replaces `request_project_deletion(project_id)`: soft-delete with a
  // 7-day purge window, matching `projects_lifecycle_check`'s invariant
  // that deleted_at and purge_after are always set together.
  async softDelete(userId: string, projectId: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");

    const [updated] = await this.db
      .update(projects)
      .set({
        deletedAt: sql`now()`,
        purgeAfter: sql`now() + interval '7 days'`,
        deletedBy: userId,
        updatedAt: sql`now()`,
      })
      .where(eq(projects.id, project.id))
      .returning();
    return updated;
  }

  // Replaces `restore_project(project_id)`: undo within the purge window.
  async restore(userId: string, projectId: string) {
    const project = await this.db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Project not found");
    if (!project.deletedAt) throw new ApiError(409, "Project is not deleted");
    if (project.purgeAfter && project.purgeAfter.getTime() < Date.now()) {
      throw new ApiError(410, "Project's restore window has expired");
    }
    const [updated] = await this.db
      .update(projects)
      .set({ deletedAt: null, purgeAfter: null, deletedBy: null, updatedAt: sql`now()` })
      .where(eq(projects.id, project.id))
      .returning();
    return updated;
  }

  async listRevisions(userId: string, projectId: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project) throw new ApiError(404, "Project not found");
    return this.db.query.projectRevisions.findMany({
      where: eq(projectRevisions.projectId, project.id),
      orderBy: desc(projectRevisions.revisionNo),
    });
  }

  async getRevision(userId: string, projectId: string, revisionNo: number) {
    const project = await this.loadForMember(userId, projectId);
    if (!project) throw new ApiError(404, "Project not found");
    const revision = await this.db.query.projectRevisions.findFirst({
      where: and(eq(projectRevisions.projectId, project.id), eq(projectRevisions.revisionNo, revisionNo)),
    });
    if (!revision) throw new ApiError(404, "Revision not found");
    return revision;
  }

  // Replaces `set_project_revision_head()` (AFTER INSERT trigger): bumps
  // the parent project's current_revision_no and last_activity_at in the
  // same transaction as the revision insert.
  async createRevision(userId: string, projectId: string, documentJson: Record<string, unknown>, reason: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");

    return this.db.transaction(async (tx) => {
      const nextRevisionNo = project.currentRevisionNo + 1;
      const [inserted] = await tx
        .insert(projectRevisions)
        .values({
          projectId: project.id,
          revisionNo: nextRevisionNo,
          documentJson,
          contentHash: contentHashOf(documentJson),
          createdBy: userId,
          reason,
        })
        .returning();

      await tx
        .update(projects)
        .set({ currentRevisionNo: nextRevisionNo, lastActivityAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(projects.id, project.id));

      return inserted;
    });
  }

  // ── Track A (raw HTML) projects ──────────────────────────────────────
  // Fully independent from the Track B (JSON) methods above: no revision
  // history, no compile step, no FK to project_revisions. See project
  // memory for why this was deliberately decoupled from the earlier
  // `project_html_revisions.protocol_revision_id`-linked design.

  private async checkActiveProjectLimit(workspaceId: string) {
    const workspace = await this.quotas.getWorkspaceOrThrow(workspaceId);
    const limit = await this.quotas.getActiveProjectLimit(workspace);
    const count = await this.db.$count(projects, and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)));
    if (count >= limit) {
      throw new ApiError(409, `Workspace is at its plan limit of ${limit} active projects`, "project_limit_reached");
    }
  }

  async createHtmlProject(
    userId: string,
    input: { workspaceId: string; title?: string; html: string; idempotencyKey?: string },
  ) {
    if (!input.html.trim()) throw new ApiError(422, "html is required", "invalid_html");
    const validationErrors = validateRawHtmlDocument(input.html);
    if (validationErrors.length > 0) {
      throw new ApiError(422, validationErrors[0]!.message, validationErrors[0]!.code);
    }

    const canEdit = await this.authz.hasWorkspaceRole(userId, input.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Workspace not found");

    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const idempotencyHash = idempotencyKey ? contentHashOf({ title: input.title, html: input.html }) : null;
    if (idempotencyKey) {
      const existing = await this.db.query.projects.findFirst({
        where: and(
          eq(projects.workspaceId, input.workspaceId),
          eq(projects.createIdempotencyKey, idempotencyKey),
          isNull(projects.deletedAt),
        ),
      });
      if (existing) {
        if (existing.createIdempotencyHash && existing.createIdempotencyHash !== idempotencyHash) {
          throw new ApiError(409, "Idempotency key was already used with a different payload", "idempotency_conflict");
        }
        return { project: existing, alreadyCreated: true };
      }
    }

    await this.checkActiveProjectLimit(input.workspaceId);
    const title = input.title?.trim() || extractHtmlTitle(input.html) || "Untitled project";

    try {
      return await this.db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({
            workspaceId: input.workspaceId,
            title,
            createdBy: userId,
            currentRevisionNo: 0,
            sourceFormat: "html",
            ...(idempotencyKey ? { createIdempotencyKey: idempotencyKey, createIdempotencyHash: idempotencyHash } : {}),
          })
          .returning();

        await tx.insert(projectHtmlDocuments).values({
          projectId: project!.id,
          html: input.html,
          contentHash: sha256Hex(input.html),
          byteSize: Buffer.byteLength(input.html, "utf8"),
          createdBy: userId,
        });

        return { project: project!, alreadyCreated: false };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "Idempotency key was already used with a different payload", "idempotency_conflict");
      }
      throw error;
    }
  }

  async getHtmlDocument(userId: string, projectId: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    if (project.sourceFormat !== "html") {
      throw new ApiError(409, "Project is not a Track A (HTML) project", "not_html_track");
    }
    const document = await this.db.query.projectHtmlDocuments.findFirst({
      where: eq(projectHtmlDocuments.projectId, project.id),
    });
    if (!document) throw new ApiError(404, "HTML document not found");
    return { project, html: document.html, updatedAt: document.updatedAt };
  }

  // Overwrites the project's single HTML document in place - no revision
  // history, no optimistic-concurrency check (last write wins). A Track A
  // project is never editable-with-history the way Track B is; to keep a
  // version, convert it to a Track B project first.
  async updateHtmlDocument(userId: string, projectId: string, html: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");
    if (project.sourceFormat !== "html") {
      throw new ApiError(409, "Project is not a Track A (HTML) project", "not_html_track");
    }
    if (!html.trim()) throw new ApiError(422, "html is required", "invalid_html");
    const validationErrors = validateRawHtmlDocument(html);
    if (validationErrors.length > 0) {
      throw new ApiError(422, validationErrors[0]!.message, validationErrors[0]!.code);
    }

    const [updated] = await this.db
      .update(projectHtmlDocuments)
      .set({ html, contentHash: sha256Hex(html), byteSize: Buffer.byteLength(html, "utf8"), updatedAt: sql`now()` })
      .where(eq(projectHtmlDocuments.projectId, project.id))
      .returning();
    if (!updated) throw new ApiError(404, "HTML document not found");

    await this.db
      .update(projects)
      .set({ lastActivityAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(projects.id, project.id));

    return { project, html: updated.html, updatedAt: updated.updatedAt };
  }

  // The only sanctioned crossing point between Track A and Track B: compiles
  // the current HTML and creates a BRAND NEW, separate Track B project (own
  // id, own revision 1) in the same workspace. The source Track A project is
  // never mutated or linked afterward - the two stay fully independent, so
  // this can be called more than once to spin off multiple JSON copies.
  async convertHtmlToJsonProject(userId: string, projectId: string) {
    const project = await this.loadForMember(userId, projectId);
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");
    if (project.sourceFormat !== "html") {
      throw new ApiError(409, "Project is already a Neonix JSON V2 project", "not_html_track");
    }

    const document = await this.db.query.projectHtmlDocuments.findFirst({
      where: eq(projectHtmlDocuments.projectId, project.id),
    });
    if (!document) throw new ApiError(404, "HTML document not found");

    const compiled = compileDocument({
      html: stampNodeIds(stripBodyInlineStyleForCompile(document.html)),
      fontAssets: HTML_COMPILER_FONT_ASSETS,
    });
    const errors = compiled.diagnostics.filter((item) => item.severity === "error");
    if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
      throw new ApiError(422, errors[0]?.message ?? "HTML document could not be compiled", "compile_failed");
    }
    const documentJson = compiled.protocol as unknown as Record<string, unknown>;

    await this.checkActiveProjectLimit(project.workspaceId);

    return this.db.transaction(async (tx) => {
      const [newProject] = await tx
        .insert(projects)
        .values({
          workspaceId: project.workspaceId,
          title: project.title,
          createdBy: userId,
          currentRevisionNo: 1,
          sourceFormat: "protocol-v2",
        })
        .returning();

      const [revision] = await tx
        .insert(projectRevisions)
        .values({
          projectId: newProject!.id,
          revisionNo: 1,
          documentJson,
          contentHash: contentHashOf(documentJson),
          sourceSchemaVersion: compiled.protocol!.formatVersion,
          reason: "html-import",
          byteSize: Buffer.byteLength(JSON.stringify(documentJson), "utf8"),
          createdBy: userId,
        })
        .returning();

      return {
        project: newProject!,
        revision: revision!,
        sourceProjectId: project.id,
        diagnostics: compiled.diagnostics,
      };
    });
  }
}
