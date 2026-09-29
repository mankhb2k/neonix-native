import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { AuthzService } from "../authz/authz.service";
import { ApiError } from "../common/api-error";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { projectRevisions, projects } from "../db/schema/projects";
import { QuotasService } from "../quotas/quotas.service";

function contentHashOf(documentJson: unknown): string {
  return createHash("sha256").update(JSON.stringify(documentJson)).digest("hex");
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
}
